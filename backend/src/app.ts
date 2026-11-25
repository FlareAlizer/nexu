import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";

import { config } from "./config.js";
import { errorHandler } from "./middleware/errors.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { coursesRouter } from "./routes/courses.js";
import { filesRouter } from "./routes/files.js";
import { lessonsRouter } from "./routes/lessons.js";
import { meRouter } from "./routes/me.js";
import { tasksRouter } from "./routes/tasks.js";
import { teacherRouter } from "./routes/teacher.js";
import { telegramRouter } from "./routes/telegram.js";
import { testsRouter } from "./routes/tests.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // за Caddy: реальный IP клиента для rate limit
  app.disable("x-powered-by");
  app.use(pinoHttp());
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(cors({ origin: [config.frontendOrigin], credentials: true }));
  app.use(rateLimit({ windowMs: 60_000, limit: config.rateLimitPerMin })); // п.4.2: 100 req/min с IP

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/lessons", lessonsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/tests", testsRouter);
  app.use("/api/teacher", teacherRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/telegram", telegramRouter); // вебхук бота, защищён secret_token
  app.use("/api/files", filesRouter); // заглушка хранилища: файлы с диска по подписанной ссылке

  app.use(errorHandler);

  return app;
}
