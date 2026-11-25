// Обработка ошибок: Express 4 сам не ловит reject в async-хендлерах.
import type { NextFunction, Request, RequestHandler, Response } from "express";

import { captureError } from "../instrument.js";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Обернуть async-хендлер: reject уходит в next() → центральный обработчик. */
export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Центральный обработчик: логируем, наружу — без стектрейса (п.4.2). */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  req.log?.error({ err }, "необработанная ошибка");
  captureError(err);
  if (res.headersSent) return;
  res.status(500).json({ error: "внутренняя ошибка сервера" });
}
