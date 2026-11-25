// Тесты (п.3.5): фидбэк с объяснениями после завершения, XP.
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errors.js";
import { lessonAccessError } from "../services/access.js";
import { isPassed, isPassed80, scoreAttempt } from "../services/testing.js";
import { grantXp } from "../services/xp.js";

export const testsRouter = Router();
testsRouter.use(requireAuth);

// Вопросы БЕЗ флагов is_correct — правильные ответы придут только после сдачи (TEST-02)
testsRouter.get("/:testId", asyncHandler(async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.testId);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const test = await prisma.test.findUnique({
    where: { id: parsed.data },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          type: true,
          text: true,
          answers: { select: { id: true, text: true } },
        },
      },
    },
  });
  if (!test) {
    res.status(404).json({ error: "тест не найден" });
    return;
  }
  const denied = await lessonAccessError(req.user!, test.lessonId);
  if (denied) {
    res.status(denied.code).json({ error: denied.error });
    return;
  }
  const lastAttempt = await prisma.testAttempt.findFirst({
    where: { testId: test.id, userId: req.user!.id, finishedAt: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, score: true, maxScore: true, finishedAt: true },
  });
  res.json({ ...test, lastAttempt });
}));

// Ответы: questionId → массив id (radio/checkbox) или текст (развёрнутый)
const attemptSchema = z.object({
  answers: z.record(
    z.string().regex(/^\d+$/),
    z.union([z.array(z.number().int().positive()).max(50), z.string().max(10_000)]),
  ),
});

// Сдать тест: автопроверка, итоговый балл, правильные ответы + объяснения (TEST-02/03).
// XP: +20 за прохождение, +10 при 80%+ — идемпотентно, повторные попытки не фармят (TEST-04)
testsRouter.post("/:testId/attempts", asyncHandler(async (req, res) => {
  const parsedId = z.coerce.number().int().positive().safeParse(req.params.testId);
  if (!parsedId.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректный формат ответов" });
    return;
  }

  const test = await prisma.test.findUnique({
    where: { id: parsedId.data },
    include: {
      questions: {
        orderBy: { orderIndex: "asc" },
        include: { answers: { select: { id: true, isCorrect: true, text: true } } },
      },
    },
  });
  if (!test) {
    res.status(404).json({ error: "тест не найден" });
    return;
  }
  const userId = req.user!.id;
  const denied = await lessonAccessError(req.user!, test.lessonId);
  if (denied) {
    res.status(denied.code).json({ error: denied.error });
    return;
  }

  // Правильные ответы считаем один раз и переиспользуем в scoreAttempt и в разборе
  const scoringQuestions = test.questions.map((q) => ({
    id: q.id,
    type: q.type,
    correctAnswerIds: q.answers.filter((a) => a.isCorrect).map((a) => a.id),
  }));
  const result = scoreAttempt(scoringQuestions, parsed.data.answers);

  const attempt = await prisma.testAttempt.create({
    data: {
      testId: test.id,
      userId,
      answers: parsed.data.answers,
      score: result.score,
      maxScore: result.maxScore,
      finishedAt: new Date(),
    },
  });

  // XP только за реально пройденный тест (не за клик по пустым ответам); 80%+ — доп. бонус
  let xp = 0;
  if (isPassed(result)) {
    xp += await grantXp(userId, "test_passed", test.id);
    if (isPassed80(result)) xp += await grantXp(userId, "test_80", test.id);
  }

  // Разбор: правильные ответы и объяснения — только в ответе на сдачу (TEST-02).
  // scoreAttempt сохраняет порядок вопросов, поэтому берём perQuestion по индексу
  const review = test.questions.map((q, i) => ({
    questionId: q.id,
    correct: result.perQuestion[i].correct,
    correctAnswerIds: scoringQuestions[i].correctAnswerIds,
    explanation: q.explanation,
  }));

  res.status(201).json({
    attemptId: attempt.id,
    score: result.score,
    maxScore: result.maxScore,
    xpGranted: xp,
    review,
  });
}));

// Мои попытки (результат сохраняется — критерий приёмки п.09)
testsRouter.get("/:testId/attempts/my", asyncHandler(async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.testId);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const attempts = await prisma.testAttempt.findMany({
    where: { testId: parsed.data, userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, score: true, maxScore: true, finishedAt: true, createdAt: true },
  });
  res.json(attempts);
}));
