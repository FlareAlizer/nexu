// AUTH-01..04: вход через Telegram, резервный email+пароль, refresh, logout.
import bcrypt from "bcrypt";
import { Router } from "express";
import type { CookieOptions, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import { config } from "../config.js";
import { prisma } from "../db.js";
import { asyncHandler } from "../middleware/errors.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../services/tokens.js";
import { verifyTelegramLogin } from "../services/telegram.js";

export const authRouter = Router();

const REFRESH_COOKIE = "refresh_token";
// SameSite=Strict — cookie не уходит по кросс-сайтовым запросам (CSRF-защита, п.4.2);
// path сужен до /api/auth, чтобы cookie не летал с каждым запросом
const refreshCookieOpts: CookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: "strict",
  path: "/api/auth",
  maxAge: 30 * 24 * 3600 * 1000,
};

function issueTokens(
  res: Response,
  user: { id: number; role: "STUDENT" | "TEACHER" | "ADMIN"; name: string },
): void {
  res.cookie(REFRESH_COOKIE, signRefreshToken(user.id), refreshCookieOpts);
  res.json({
    accessToken: signAccessToken(user.id, user.role),
    user: { id: user.id, name: user.name, role: user.role },
  });
}

// Брутфорс-защита входа: жёстче общего лимита 100/мин
const loginLimiter = rateLimit({ windowMs: 60_000, limit: config.loginRateLimitPerMin });

// Поля, которые присылает Telegram Login Widget
const telegramLoginSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    auth_date: z.union([z.string(), z.number()]).transform(String),
    hash: z.string(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    photo_url: z.string().optional(),
  })
  .strict();

// Telegram Login Widget: проверка hash по bot token → создать/найти user → JWT + refresh (AUTH-01)
authRouter.post("/telegram", asyncHandler(async (req: Request, res: Response) => {
  const parsed = telegramLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректные данные виджета" });
    return;
  }

  // Подпись считается по всем присланным полям как есть
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) data[k] = v;
  if (!verifyTelegramLogin(data)) {
    res.status(401).json({ error: "подпись Telegram не подтверждена" });
    return;
  }

  const d = parsed.data;
  const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || d.username || `tg_${d.id}`;
  const user = await prisma.user.upsert({
    where: { telegramId: BigInt(d.id) },
    create: { telegramId: BigInt(d.id), tgUsername: d.username ?? null, name },
    update: { tgUsername: d.username ?? null, lastSeenAt: new Date() },
  });

  if (user.isBlocked) {
    res.status(403).json({ error: "доступ запрещён" });
    return;
  }
  issueTokens(res, user);
}));

const emailLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Резервный вход email+пароль, bcrypt cost 12 (AUTH-02). Пароль выдаёт админ (ADMIN-04),
// публичной регистрации нет — доступ вручную после оплаты (п.07, ЮKassa v2.0)
authRouter.post("/login", loginLimiter, asyncHandler(async (req: Request, res: Response) => {
  const parsed = emailLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "нужны email и пароль" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // bcrypt.compare и на несуществующем юзере — не выдаём наличие email по таймингу
  const hash = user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await bcrypt.compare(parsed.data.password, hash);
  if (!user || !user.passwordHash || !ok) {
    res.status(401).json({ error: "неверный email или пароль" });
    return;
  }
  if (user.isBlocked) {
    res.status(403).json({ error: "доступ запрещён" });
    return;
  }
  issueTokens(res, user);
}));

// Обмен refresh-токена на новую пару (AUTH-04: access 1ч, refresh 30д, ротация)
authRouter.post("/refresh", asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  const userId = token ? verifyRefreshToken(token) : null;
  if (!userId) {
    res.status(401).json({ error: "refresh-токен невалиден" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isBlocked) {
    res.status(403).json({ error: "доступ запрещён" });
    return;
  }
  issueTokens(res, user);
}));

authRouter.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOpts, maxAge: undefined });
  res.json({ ok: true });
});
