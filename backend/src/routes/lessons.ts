// Страница урока (п.3.3): блоки контента, прогресс видео, завершение.
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errors.js";
import { lessonAccessError, lessonWriteAccess } from "../services/access.js";
import { completeLesson, lessonCompletionState, NotCompletableError } from "../services/progress.js";
import { grantXp } from "../services/xp.js";

export const lessonsRouter = Router();
lessonsRouter.use(requireAuth);

// Урок с блоками (video/text/pdf по order_index). 403 если урок заблокирован (COURSE-04)
lessonsRouter.get("/:lessonId", asyncHandler(async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.lessonId);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const lessonId = parsed.data;
  const user = req.user!;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { select: { id: true, title: true, courseId: true, course: { select: { isPublished: true } } } },
      blocks: { orderBy: { orderIndex: "asc" }, select: { id: true, type: true, content: true } },
      tasks: { select: { id: true, title: true, deadline: true } },
      tests: { select: { id: true, title: true } },
    },
  });
  if (!lesson) {
    res.status(404).json({ error: "урок не найден" });
    return;
  }

  const denied = await lessonAccessError(user, lessonId);
  if (denied) {
    res.status(denied.code).json({ error: denied.error });
    return;
  }

  const [progress, completion] = await Promise.all([
    prisma.lessonProgress.findUnique({
      where: { lessonId_userId: { lessonId, userId: user.id } },
      select: { videoWatchedPct: true, videoPositionS: true, isCompleted: true },
    }),
    lessonCompletionState(user.id, lessonId),
  ]);

  res.json({
    id: lesson.id,
    title: lesson.title,
    module: { id: lesson.module.id, title: lesson.module.title, courseId: lesson.module.courseId },
    blocks: lesson.blocks, // VIDEO: content = id ролика Kinescope; TEXT: markdown; PDF: URL (signed URL — M3)
    tasks: lesson.tasks,
    tests: lesson.tests,
    progress: progress ?? { videoWatchedPct: 0, videoPositionS: 0, isCompleted: false },
    completion, // условия кнопки «Завершить урок» (COURSE-05 п.3.3)
  });
}));

const videoProgressSchema = z.object({
  pct: z.number().int().min(0).max(100),
  positionS: z.number().int().min(0).max(24 * 3600),
});

// Трекинг видео (COURSE-01/02): pct только растёт, позиция запоминается.
// При 80%+ автоматически +10 XP (п.3.6 «Просмотр урока 80%+»), идемпотентно.
lessonsRouter.post("/:lessonId/video-progress", asyncHandler(async (req, res) => {
  const parsedId = z.coerce.number().int().positive().safeParse(req.params.lessonId);
  if (!parsedId.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const parsed = videoProgressSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "нужны pct (0–100) и positionS" });
    return;
  }
  const lessonId = parsedId.data;
  const userId = req.user!.id;
  // Лёгкая проверка (без пересчёта блокировки) — это горячий путь плеера
  const access = await lessonWriteAccess(req.user!, lessonId);
  if ("code" in access) {
    res.status(access.code).json({ error: access.error });
    return;
  }

  // Прогресс видео принимаем только для урока, где реально есть VIDEO-блок —
  // иначе клиент мог бы фармить XP и «просмотр» на текстовых уроках (COURSE-01)
  const videoBlock = await prisma.lessonBlock.findFirst({
    where: { lessonId, type: "VIDEO" },
    select: { id: true },
  });
  if (!videoBlock) {
    res.status(400).json({ error: "в уроке нет видео" });
    return;
  }

  // Атомарно: pct = GREATEST(старый, новый), чтобы гонка/перемотка не откатывала прогресс.
  // RETURNING даёт итоговый pct для решения о начислении XP.
  const [row] = await prisma.$queryRaw<{ video_watched_pct: number }[]>`
    INSERT INTO lesson_progress (lesson_id, user_id, video_watched_pct, video_position_s, is_completed)
    VALUES (${lessonId}, ${userId}, ${parsed.data.pct}, ${parsed.data.positionS}, false)
    ON CONFLICT (lesson_id, user_id) DO UPDATE
      SET video_watched_pct = GREATEST(lesson_progress.video_watched_pct, EXCLUDED.video_watched_pct),
          video_position_s = EXCLUDED.video_position_s
    RETURNING video_watched_pct`;
  const pct = row.video_watched_pct;

  // +10 «просмотр урока 80%+» (п.3.6), идемпотентно
  const xpGranted = pct >= 80 ? await grantXp(userId, "lesson_watched", lessonId) : 0;
  res.json({ pct, xpGranted });
}));

// «Завершить урок»: (видео ≥80% ИЛИ нет) И (задание сдано ИЛИ нет) И (тест пройден ИЛИ нет).
// Открывает следующий урок, +50 XP если модуль закрыт целиком.
lessonsRouter.post("/:lessonId/complete", asyncHandler(async (req, res) => {
  const parsedId = z.coerce.number().int().positive().safeParse(req.params.lessonId);
  if (!parsedId.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const denied = await lessonAccessError(req.user!, parsedId.data);
  if (denied) {
    res.status(denied.code).json({ error: denied.error });
    return;
  }
  try {
    const result = await completeLesson(req.user!.id, parsedId.data);
    res.json(result);
  } catch (e) {
    if (e instanceof NotCompletableError) {
      res.status(409).json({ error: e.message });
      return;
    }
    throw e;
  }
}));
