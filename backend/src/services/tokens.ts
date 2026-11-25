// JWT: access 1ч / refresh 30д (AUTH-04, п.4.2). Refresh живёт в httpOnly-cookie.
import jwt from "jsonwebtoken";

import { config } from "../config.js";
import type { Role } from "../middleware/auth.js";

interface AccessPayload {
  sub: string; // userId
  role: Role;
  typ: "access";
}

interface RefreshPayload {
  sub: string;
  typ: "refresh";
}

export function signAccessToken(userId: number, role: Role): string {
  const payload: AccessPayload = { sub: String(userId), role, typ: "access" };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtAccessTtl } as jwt.SignOptions);
}

export function signRefreshToken(userId: number): string {
  const payload: RefreshPayload = { sub: String(userId), typ: "refresh" };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtRefreshTtl } as jwt.SignOptions);
}

/** Вернуть payload access-токена или null (невалиден/просрочен/не тот тип). */
export function verifyAccessToken(token: string): { userId: number; role: Role } | null {
  try {
    const p = jwt.verify(token, config.jwtSecret) as AccessPayload;
    if (p.typ !== "access") return null;
    return { userId: Number(p.sub), role: p.role };
  } catch {
    return null;
  }
}

/** Вернуть userId из refresh-токена или null. */
export function verifyRefreshToken(token: string): number | null {
  try {
    const p = jwt.verify(token, config.jwtSecret) as RefreshPayload;
    if (p.typ !== "refresh") return null;
    return Number(p.sub);
  } catch {
    return null;
  }
}
