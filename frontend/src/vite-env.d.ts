/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** DSN Sentry; пусто — мониторинг выключен (M6) */
  readonly VITE_SENTRY_DSN?: string;
  /** username Telegram-бота для Login Widget */
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
