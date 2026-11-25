// Sentry (п.8.1, M6). Импортируется первым в index.ts — до создания приложения.
// Без SENTRY_DSN не инициализируется: локально и в тестах ничего наружу не уходит.
import * as Sentry from "@sentry/node";
import pino from "pino";

import { config } from "./config.js";

const log = pino({ name: "sentry" });

let enabled = false;

if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.isProd ? "production" : "development",
    // Ученики — школьники: тела запросов, куки и IP в Sentry не отправляем (152-ФЗ)
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
  enabled = true;
  log.info("Sentry подключён");
}

/** Отправить ошибку в Sentry, если он настроен. Никогда не бросает. */
export function captureError(err: unknown): void {
  if (!enabled) return;
  try {
    Sentry.captureException(err);
  } catch (e) {
    log.warn({ err: e }, "не удалось отправить ошибку в Sentry");
  }
}

export function isSentryEnabled(): boolean {
  return enabled;
}
