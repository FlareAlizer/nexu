// NOTIF-03: «Не забудь сдать задание к [дата]» за ≤48 ч до дедлайна.
// Джоб ежечасный; повтор блокирует запись в notification_log — но пишем её
// ТОЛЬКО после успешной доставки, иначе неудача первой попытки убила бы напоминание.
import { Prisma } from "@prisma/client";
import pino from "pino";

import { prisma } from "../db.js";
import { sendTelegramMessage, templates } from "./telegram.js";

const log = pino({ name: "reminders" });

const WINDOW_MS = 48 * 3600 * 1000;
export const REMINDER_KIND = "deadline_48h";

/** Прогнать напоминания один раз. Возвращает число отправленных (для логов/тестов). */
export async function sendDeadlineReminders(now: Date = new Date()): Promise<number> {
  // Дедлайн ещё не прошёл и наступит в ближайшие 48 часов
  const tasks = await prisma.task.findMany({
    where: { deadline: { gt: now, lte: new Date(now.getTime() + WINDOW_MS) } },
    select: {
      id: true,
      deadline: true,
      lesson: { select: { module: { select: { courseId: true } } } },
    },
  });
  if (tasks.length === 0) return 0;

  let sent = 0;
  for (const task of tasks) {
    // Ученики потоков курса сразу с TG-полями — без findUnique на каждого (прежний N+1)
    const members = await prisma.cohortMember.findMany({
      where: {
        cohort: { courseId: task.lesson.module.courseId },
        user: { role: "STUDENT", isBlocked: false },
      },
      select: { user: { select: { id: true, telegramId: true, notifyMuted: true } } },
    });
    if (members.length === 0) continue;
    const userIds = members.map((m) => m.user.id);

    // Батчем: кто уже сдал и кому уже напоминали — два запроса вместо цикла
    const [submitted, alreadyNotified] = await Promise.all([
      prisma.taskSubmission.findMany({
        where: { taskId: task.id, userId: { in: userIds } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.notificationLog.findMany({
        where: { kind: REMINDER_KIND, refId: task.id, userId: { in: userIds } },
        select: { userId: true },
      }),
    ]);
    const skip = new Set([...submitted, ...alreadyNotified].map((r) => r.userId));

    const deadlineText = task.deadline!.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });

    for (const { user } of members) {
      if (skip.has(user.id) || !user.telegramId || user.notifyMuted) continue;
      const ok = await sendTelegramMessage(user.telegramId, templates.deadline48h(deadlineText));
      if (!ok) continue; // не доставлено — не логируем, следующий прогон повторит

      try {
        await prisma.notificationLog.create({ data: { userId: user.id, kind: REMINDER_KIND, refId: task.id } });
      } catch (e) {
        // Параллельный прогон мог записать первым — это не ошибка
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
      sent += 1;
    }
  }
  return sent;
}

/** Запустить ежечасный цикл напоминаний. Ошибки цикла логируются, не роняют процесс. */
export function startDeadlineReminders(): void {
  const run = () =>
    sendDeadlineReminders()
      .then((n) => {
        if (n > 0) log.info({ sent: n }, "напоминания о дедлайнах отправлены");
      })
      .catch((e) => log.error({ err: e }, "джоб напоминаний упал"));
  void run();
  setInterval(run, 3600 * 1000).unref(); // unref: не держим процесс при graceful shutdown
}
