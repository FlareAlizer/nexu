// Выдача файлов заглушки хранилища (когда S3 не подключён).
// Доступ — по подписанному токену с TTL 10 мин, как presigned URL в S3,
// поэтому requireAuth здесь нет: сама ссылка и есть пропуск.
import { Router } from "express";

import { asyncHandler } from "../middleware/errors.js";
import { contentTypeOf, isStubStorage, readFileToken, readLocalFile } from "../services/storage.js";

export const filesRouter = Router();

filesRouter.get("/:token", asyncHandler(async (req, res) => {
  if (!isStubStorage()) {
    // На проде файлы отдаёт S3 по presigned URL — этот роут не используется
    res.status(404).json({ error: "не найдено" });
    return;
  }
  const key = readFileToken(req.params.token);
  if (!key) {
    res.status(403).json({ error: "ссылка недействительна или истекла" });
    return;
  }
  const body = await readLocalFile(key);
  if (!body) {
    res.status(404).json({ error: "файл не найден" });
    return;
  }
  res.setHeader("Content-Type", contentTypeOf(key));
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(body);
}));
