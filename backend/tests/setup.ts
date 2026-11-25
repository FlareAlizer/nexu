// Env для тестов — до импорта config (он требует DATABASE_URL и JWT_SECRET)
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test_jwt_secret";
process.env.TELEGRAM_BOT_TOKEN = "123456:test_bot_token";
// S3 не настроен → хранилище работает на заглушке, файлы в отдельный каталог
process.env.STORAGE_LOCAL_DIR = "./.storage-test";
