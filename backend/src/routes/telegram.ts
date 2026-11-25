// Вебхук @nexuu_school_bot: /start (активация уведомлений), /mute, /unmute (NOTIF-04).
// Настройка: setWebhook на https://ДОМЕН/api/telegram/webhook с secret_token из .env.
import { Router } from "express";
import { z } from "zod";

import { config } from "../config.js";
import { prisma } from "../db.js";
import { asyncHandler } from "../middleware/errors.js";
import { parseBotCommand, sendTelegramMessage } from "../services/telegram.js";

export const telegramRouter = Router();

const updateSchema = z.object({
  message: z
    .object({
      text: z.string().optional(),
      from: z.object({ id: z.number() }).optional(),
      chat: z.object({ id: z.number() }),
    })
    .optional(),
});

const REPLIES = {
  startKnown: "Уведомления подключены: проверка заданий, новые уроки, дедлайны. Отключить: /mute",
  startUnknown: `Привет! Это бот NEXU. Войди на платформу через Telegram — и я буду присылать уведомления о проверке заданий и новых уроках.`,
  muted: "Уведомления выключены. Включить обратно: /unmute",
  unmuted: "Уведомления снова включены 👌",
} as const;

telegramRouter.post("/webhook", asyncHandler(async (req, res) => {
  // Без настроенного секрета вебхук закрыт; Telegram шлёт секрет в этом заголовке
  const given = req.headers["x-telegram-bot-api-secret-token"];
  if (!config.telegram.webhookSecret || given !== config.telegram.webhookSecret) {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  // Telegram ретраит не-200 — на некомандные апдейты тоже отвечаем ok
  const parsed = updateSchema.safeParse(req.body);
  const msg = parsed.success ? parsed.data.message : undefined;
  const command = parseBotCommand(msg?.text);
  if (!msg?.from || !command) {
    res.json({ ok: true });
    return;
  }

  const telegramId = BigInt(msg.from.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  let reply: string;
  if (command === "start") {
    reply = user ? REPLIES.startKnown : REPLIES.startUnknown;
  } else if (!user) {
    reply = REPLIES.startUnknown;
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { notifyMuted: command === "mute" } });
    reply = command === "mute" ? REPLIES.muted : REPLIES.unmuted;
  }
  await sendTelegramMessage(BigInt(msg.chat.id), reply);
  res.json({ ok: true });
}));
