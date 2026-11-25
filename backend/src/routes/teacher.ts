// Панель преподавателя/куратора (п.3.9). Всё под requireRole("TEACHER", "ADMIN").
import { Router } from "express";
import { z } from "zod";

import { config } from "../config.js";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errors.js";
import { orderedCourseLessonIds } from "../services/progress.js";
import { notifyUser, templates } from "../services/telegram.js";
import { grantXp } from "../services/xp.js";

export const teacherRouter = Router();
teacherRouter.use(requireAuth, requireRole("TEACHER", "ADMIN"));

// Очередь непроверенных: имя, задание, дата; старые сверху (TEACH-01)
teacherRouter.get("/queue", asyncHandler(async (_req, res) => {
  const queue = await prisma.taskSubmission.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, lesson: { select: { title: true } } } },
    },
  });
  res.json(queue);
}));

// Сдача целиком для проверки: текст/файл + история версий с комментариями (TEACH-02/03)
teacherRouter.get("/submissions/:submissionId", asyncHandler(async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.submissionId);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: parsed.data },
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true, description: true } },
    },
  });
  if (!submission) {
    res.status(404).json({ error: "сдача не найдена" });
    return;
  }
  const history = await prisma.taskSubmission.findMany({
    where: { taskId: submission.taskId, userId: submission.userId },
    orderBy: { version: "desc" },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, role: true } } },
      },
    },
  });
  res.json({ ...submission, history });
}));

const reviewSchema = z.object({
  status: z.enum(["ACCEPTED", "NEEDS_REVISION"]),
  comment: z.string().trim().max(10_000).optional(),
});

// Проверка: комментарий + статус «Принято»/«На доработке» (TEACH-02). ACCEPTED → +30 XP.
teacherRouter.post("/submissions/:submissionId/review", asyncHandler(async (req, res) => {
  const parsedId = z.coerce.number().int().positive().safeParse(req.params.submissionId);
  if (!parsedId.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "нужен status: ACCEPTED или NEEDS_REVISION" });
    return;
  }

  const submission = await prisma.taskSubmission.findUnique({
    where: { id: parsedId.data },
    include: { task: { select: { title: true, lesson: { select: { title: true } } } } },
  });
  if (!submission) {
    res.status(404).json({ error: "сдача не найдена" });
    return;
  }
  if (submission.status !== "PENDING") {
    res.status(409).json({ error: "эта версия уже проверена" });
    return;
  }

  const { status, comment } = parsed.data;
  const [updated] = await prisma.$transaction([
    prisma.taskSubmission.update({ where: { id: submission.id }, data: { status } }),
    ...(comment
      ? [
          prisma.taskComment.create({
            data: { submissionId: submission.id, authorId: req.user!.id, content: comment },
          }),
        ]
      : []),
  ]);

  // Бонус за качество (п.3.6), идемпотентно по заданию — пересдачи не фармят XP
  if (status === "ACCEPTED") {
    await grantXp(submission.userId, "task_accepted", submission.taskId);
  }

  // NOTIF-01/TASK-06: push в Telegram; fire-and-forget — ответ препода не ждёт бота (п.4.4)
  const statusLabel = status === "ACCEPTED" ? "Принято ✅" : "На доработке 🔁";
  void notifyUser(
    submission.userId,
    templates.taskReviewed(
      submission.task.lesson.title,
      statusLabel,
      `${config.frontendOrigin}/tasks/${submission.taskId}`,
    ),
  );

  res.json(updated);
}));

// Ученики потока: имя, прогресс %, last_seen_at; красный = 3+ дня — на фронте (TEACH-04)
teacherRouter.get("/cohorts/:cohortId/students", asyncHandler(async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.cohortId);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const cohort = await prisma.cohort.findUnique({
    where: { id: parsed.data },
    include: { members: { include: { user: { select: { id: true, name: true, lastSeenAt: true } } } } },
  });
  if (!cohort) {
    res.status(404).json({ error: "поток не найден" });
    return;
  }

  const lessonIds = await orderedCourseLessonIds(cohort.courseId);
  const memberIds = cohort.members.map((m) => m.user.id);

  // Один запрос вместо N: число завершённых уроков на каждого ученика (TEACH-04).
  // Прежний Promise.all с запросом на ученика исчерпывал пул при большом потоке.
  const grouped = lessonIds.length
    ? await prisma.lessonProgress.groupBy({
        by: ["userId"],
        where: { userId: { in: memberIds }, lessonId: { in: lessonIds }, isCompleted: true },
        _count: { _all: true },
      })
    : [];
  const completedByUser = new Map(grouped.map((g) => [g.userId, g._count._all]));

  const students = cohort.members.map((m) => ({
    ...m.user,
    progressPct: lessonIds.length
      ? Math.round(((completedByUser.get(m.user.id) ?? 0) / lessonIds.length) * 100)
      : 0,
  }));
  res.json({ cohortId: cohort.id, title: cohort.title, students });
}));

// Список потоков для выбора в панели
teacherRouter.get("/cohorts", asyncHandler(async (_req, res) => {
  const cohorts = await prisma.cohort.findMany({
    orderBy: { id: "asc" },
    include: { course: { select: { title: true } }, _count: { select: { members: true } } },
  });
  res.json(cohorts);
}));
