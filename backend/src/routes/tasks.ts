// Задания-эссе (п.3.4). Файлы — закрытый S3, доступ по signed URL.
import { Prisma } from "@prisma/client";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";

import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errors.js";
import { lessonAccessError } from "../services/access.js";
import {
  FileValidationError,
  getSignedUrl,
  MAX_FILE_BYTES,
  uploadSubmission,
} from "../services/storage.js";
import { grantXp } from "../services/xp.js";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } });

/** multer.single c человеческой ошибкой при превышении 10 МБ (TASK-02). */
function uploadSingleFile(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "файл больше 10 МБ" });
      return;
    }
    next(err);
  });
}

const submissionInclude = {
  comments: {
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, role: true } } },
  },
} as const;

// Условие + мои сдачи (все версии с комментариями — история TEACH-03 у ученика тоже видна)
tasksRouter.get("/:taskId", asyncHandler(async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.taskId);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const task = await prisma.task.findUnique({ where: { id: parsed.data } });
  if (!task) {
    res.status(404).json({ error: "задание не найдено" });
    return;
  }
  const denied = await lessonAccessError(req.user!, task.lessonId);
  if (denied) {
    res.status(denied.code).json({ error: denied.error });
    return;
  }
  const submissions = await prisma.taskSubmission.findMany({
    where: { taskId: task.id, userId: req.user!.id },
    orderBy: { version: "desc" },
    include: submissionInclude,
  });
  res.json({ ...task, submissions });
}));

// Сдача: файл (.docx/.pdf/.txt, ≤10MB → S3) или текст прямо в форме (TASK-02).
// Пересдача при «На доработке» — новая версия (TASK-05). +20 XP при первой сдаче.
tasksRouter.post("/:taskId/submissions", uploadSingleFile, asyncHandler(async (req, res) => {
  const parsedId = z.coerce.number().int().positive().safeParse(req.params.taskId);
  if (!parsedId.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!req.file && !text) {
    res.status(400).json({ error: "прикрепи файл или напиши текст ответа" });
    return;
  }
  if (text.length > 50_000) {
    res.status(400).json({ error: "текст ответа слишком длинный" });
    return;
  }

  const task = await prisma.task.findUnique({ where: { id: parsedId.data } });
  if (!task) {
    res.status(404).json({ error: "задание не найдено" });
    return;
  }
  const userId = req.user!.id;
  const denied = await lessonAccessError(req.user!, task.lessonId);
  if (denied) {
    res.status(denied.code).json({ error: denied.error });
    return;
  }

  // Новая версия допустима только для первой сдачи или после «На доработке» (TASK-05)
  const latest = await prisma.taskSubmission.findFirst({
    where: { taskId: task.id, userId },
    orderBy: { version: "desc" },
  });
  if (latest && latest.status !== "NEEDS_REVISION") {
    res.status(409).json({
      error: latest.status === "PENDING" ? "работа уже на проверке" : "задание уже принято",
    });
    return;
  }

  let fileUrl: string | null = null;
  if (req.file) {
    try {
      fileUrl = await uploadSubmission(userId, task.id, req.file);
    } catch (e) {
      if (e instanceof FileValidationError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  }

  let submission;
  try {
    submission = await prisma.taskSubmission.create({
      data: {
        taskId: task.id,
        userId,
        fileUrl,
        text: text || null,
        version: (latest?.version ?? 0) + 1,
      },
      include: submissionInclude,
    });
  } catch (e) {
    // Гонка: параллельный запрос уже создал эту версию (unique task+user+version)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      res.status(409).json({ error: "работа уже отправлена, обновите страницу" });
      return;
    }
    throw e;
  }
  const xp = await grantXp(userId, "task_submitted", task.id);
  res.status(201).json({ ...submission, xpGranted: xp });
}));

// Signed URL на файл сдачи: только автор, преподаватель или админ (п.4.2)
tasksRouter.get("/submissions/:submissionId/file-url", asyncHandler(async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.submissionId);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const submission = await prisma.taskSubmission.findUnique({ where: { id: parsed.data } });
  if (!submission || !submission.fileUrl) {
    res.status(404).json({ error: "файл не найден" });
    return;
  }
  const u = req.user!;
  if (u.role === "STUDENT" && submission.userId !== u.id) {
    res.status(403).json({ error: "нет доступа к файлу" });
    return;
  }
  res.json({ url: await getSignedUrl(submission.fileUrl) });
}));
