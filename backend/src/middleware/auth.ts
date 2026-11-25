// JWT-аутентификация и проверка ролей (AUTH-03/04).
import type { NextFunction, Request, Response } from "express";

import { prisma } from "../db.js";
import { verifyAccessToken } from "../services/tokens.js";

export type Role = "STUDENT" | "TEACHER" | "ADMIN";

export interface AuthUser {
  id: number;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

// Троттлинг записи last_seen_at: не чаще раза в минуту на пользователя,
// иначе каждый запрос = лишний UPDATE (бюджет API 300 мс, п.4.1)
const LAST_SEEN_THROTTLE_MS = 60_000;
const lastSeenWrites = new Map<number, number>();

function touchLastSeen(req: Request, userId: number): void {
  const now = Date.now();
  const prev = lastSeenWrites.get(userId) ?? 0;
  if (now - prev < LAST_SEEN_THROTTLE_MS) return;
  lastSeenWrites.set(userId, now);
  // fire-and-forget: недоступность записи не должна ломать запрос
  prisma.user
    .update({ where: { id: userId }, data: { lastSeenAt: new Date() } })
    .catch((e) => req.log?.warn({ err: e, userId }, "не удалось обновить last_seen_at"));
}

/** Проверить access-токен (Authorization: Bearer), положить req.user, обновить last_seen_at. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token ? verifyAccessToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "не авторизован" });
    return;
  }

  try {
    // isBlocked проверяем по БД, чтобы блокировка действовала сразу, не дожидаясь истечения токена
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, isBlocked: true },
    });
    if (!user || user.isBlocked) {
      res.status(403).json({ error: "доступ запрещён" });
      return;
    }

    req.user = { id: user.id, role: user.role };
    touchLastSeen(req, user.id);
    next();
  } catch (err) {
    next(err); // Express 4 не ловит reject в async middleware сам
  }
}

/** Пускать только указанные роли. Использовать после requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "недостаточно прав" });
      return;
    }
    next();
  };
}
