// Конфиг из .env. Секреты — только здесь, не в коде.
import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} не задан`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 8000),
  isProd: process.env.NODE_ENV === "production",
  // Origin фронта для CORS; в проде фронт и API на одном домене за Caddy
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "1h",
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? "nexuu_school_bot",
    // secret_token из setWebhook: Telegram шлёт его в заголовке, чужие запросы отсекаем
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  },
  kinescope: {
    apiToken: process.env.KINESCOPE_API_TOKEN ?? "",
    projectId: process.env.KINESCOPE_PROJECT_ID ?? "",
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "ru-1",
    bucket: process.env.S3_BUCKET ?? "nexu-submissions",
    accessKey: process.env.S3_ACCESS_KEY ?? "",
    secretKey: process.env.S3_SECRET_KEY ?? "",
  },
  // Лимиты запросов с одного IP (п.4.2). Значения по умолчанию — прод.
  // Поднимаются только для нагрузочного теста: 500 виртуальных пользователей идут с одного IP.
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN ?? 100),
  loginRateLimitPerMin: Number(process.env.LOGIN_RATE_LIMIT_PER_MIN ?? 10),
  // Куда класть файлы, пока S3 не подключён (заглушка хранилища, см. services/storage.ts)
  storageLocalDir: process.env.STORAGE_LOCAL_DIR ?? "./.storage",
  sentryDsn: process.env.SENTRY_DSN ?? "",
};
