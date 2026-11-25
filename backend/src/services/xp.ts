// XP (п.3.6). Начисление идемпотентно: unique(user_id, reason, ref_id) в xp_log.
import { Prisma } from "@prisma/client";

import { prisma } from "../db.js";

export const XP = {
  lesson_watched: 10, // просмотр урока 80%+
  task_submitted: 20, // сдача задания
  task_accepted: 30, // задание принято преподавателем
  test_passed: 20, // тест пройден
  test_80: 10, // тест на 80%+ (суммируется)
  module_completed: 50, // все уроки модуля закрыты
} as const;

export type XpReason = keyof typeof XP;

/** Начислить XP, если ещё не начислялось за (reason, refId). Возвращает начисленную сумму (0 если дубль). */
export async function grantXp(userId: number, reason: XpReason, refId: number): Promise<number> {
  try {
    await prisma.xpLog.create({ data: { userId, reason, refId, amount: XP[reason] } });
    return XP[reason];
  } catch (e) {
    // P2002 = нарушение unique(userId, reason, refId) — уже начислено, это не ошибка
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return 0;
    throw e;
  }
}

/** Баланс XP пользователя. */
export async function xpBalance(userId: number): Promise<number> {
  const agg = await prisma.xpLog.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}
