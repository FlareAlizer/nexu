// COURSE-01..05 (п.3.2). Ученик видит только курс своего потока (COURSE-05).
import { Router } from "express";
import { z } from "zod";

import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errors.js";
import { courseAccessError } from "../services/access.js";
import { completedLessonIds, computeLessonStatuses } from "../services/progress.js";

export const coursesRouter = Router();
coursesRouter.use(requireAuth);

/** Структура курса со статусами уроков для конкретного ученика. */
async function courseForStudent(courseId: number, userId: number) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: { lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true } } },
      },
    },
  });
  if (!course) return null;

  const orderedIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const completed = await completedLessonIds(userId, orderedIds);
  const statuses = computeLessonStatuses(orderedIds, completed);

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    coverUrl: course.coverUrl,
    modules: course.modules.map((m) => ({
      id: m.id,
      title: m.title,
      lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, status: statuses.get(l.id) })),
    })),
  };
}

// Курсы моих потоков: модули, уроки, статусы (пройден / доступен / заблокирован COURSE-04)
coursesRouter.get("/my", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const memberships = await prisma.cohortMember.findMany({
    where: { userId },
    include: { cohort: { include: { course: { select: { id: true, isPublished: true } } } } },
  });

  const seen = new Set<number>();
  const courses = [];
  for (const m of memberships) {
    const { course } = m.cohort;
    if (!course.isPublished || seen.has(course.id)) continue;
    seen.add(course.id);
    const full = await courseForStudent(course.id, userId);
    if (full) {
      courses.push({ ...full, cohort: { id: m.cohortId, title: m.cohort.title, tgChatUrl: m.cohort.tgChatUrl } });
    }
  }
  res.json(courses);
}));

coursesRouter.get("/:courseId", asyncHandler(async (req, res) => {
  const parsed = z.coerce.number().int().positive().safeParse(req.params.courseId);
  if (!parsed.success) {
    res.status(400).json({ error: "некорректный id" });
    return;
  }
  const courseId = parsed.data;
  const user = req.user!;

  // Единое правило доступа к курсу (COURSE-05): ученику — опубликованный курс своего
  // потока, преподу/админу — любой. Тот же источник, что и для уроков/заданий/тестов
  const denied = await courseAccessError(user, courseId);
  if (denied) {
    res.status(denied.code).json({ error: denied.error });
    return;
  }

  const course = await courseForStudent(courseId, user.id);
  if (!course) {
    res.status(404).json({ error: "курс не найден" });
    return;
  }
  res.json(course);
}));
