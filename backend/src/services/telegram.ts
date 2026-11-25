// Интеграция с @nexuu_school_bot: Login Widget + уведомления (п.3.7).
// Graceful degradation (п.4.4): недоступность бота не роняет основной сценарий.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import pino from "pino";

import { config } from "../config.js";
import { prisma } from "../db.js";

const log = pino({ name: "telegram" });

// Данные виджет отправляет сразу после клика; 10 минут покрывают медленную сеть и небольшой skew часов
const AUTH_MAX_AGE_S = 600;

/**
 * Проверить подпись данных Telegram Login Widget. AUTH-01.
 * Алгоритм по https://core.telegram.org/widgets/login#checking-authorization:
 * data_check_string = отсортированные "key=value" через \n (без hash),
 * secret = SHA256(bot_token), подпись = HMAC-SHA256(data_check_string, secret).
 */
export function verifyTelegramLogin(
  data: Record<string, string>,
  botToken: string = config.telegram.botToken,
  nowS: number = Math.floor(Date.now() / 1000),
): boolean {
  const { hash, ...fields } = data;
  if (!hash || !botToken) return false;

  const checkString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

  // Свежесть: защита от повторного использования перехваченных данных
  const authDate = Number(fields.auth_date);
  if (!Number.isFinite(authDate) || nowS - authDate > AUTH_MAX_AGE_S) return false;

  return true;
}

/** Работаем ли на заглушке бота (токен не задан): уведомления пишем в лог. */
export function isStubTelegram(): boolean {
  return !config.telegram.botToken;
}

/**
 * sendMessage через Bot API. true = доставлено. Ошибки (бот не запущен пользователем,
 * сеть) логируем и возвращаем false — платформа работает без бота (п.4.4).
 * Без токена — заглушка: текст уходит в лог, чтобы сценарии уведомлений
 * можно было проверять до подключения реального бота.
 */
export async function sendTelegramMessage(telegramId: bigint, text: string): Promise<boolean> {
  if (isStubTelegram()) {
    log.info({ telegramId: telegramId.toString(), text }, "заглушка бота: сообщение не отправлено, только лог");
    return true;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId.toString(), text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // 403 = пользователь не нажал /start или заблокировал бота — ожидаемо, не ошибка
      log.info({ telegramId: telegramId.toString(), status: res.status }, "sendMessage не доставлен");
      return false;
    }
    return true;
  } catch (e) {
    log.warn({ err: e }, "Bot API недоступен");
    return false;
  }
}

/**
 * Уведомить пользователя платформы (NOTIF-01..03): уважает notify_muted (NOTIF-04),
 * молча пропускает без telegram_id. Не бросает наружу.
 */
export async function notifyUser(userId: number, text: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, notifyMuted: true },
    });
    if (!user?.telegramId || user.notifyMuted) return false;
    return await sendTelegramMessage(user.telegramId, text);
  } catch (e) {
    log.warn({ err: e, userId }, "не удалось отправить уведомление");
    return false;
  }
}

export type BotCommand = "start" | "mute" | "unmute";

/** Разобрать команду из сообщения боту: "/mute", "/mute@nexuu_school_bot", с пробелами. */
export function parseBotCommand(text: string | undefined): BotCommand | null {
  if (!text) return null;
  const m = /^\/(start|mute|unmute)(@\w+)?(\s|$)/.exec(text.trim());
  return (m?.[1] as BotCommand) ?? null;
}

// Шаблоны NOTIF-01..03
export const templates = {
  taskReviewed: (lesson: string, status: string, url: string) =>
    `Преподаватель проверил домашнее задание за урок «${lesson}». Статус: ${status}. Открыть: ${url}`,
  newLesson: (title: string, url: string) => `Открылся урок: «${title}». Перейти: ${url}`,
  deadline48h: (date: string) => `Не забудь сдать задание к ${date}`,
};
