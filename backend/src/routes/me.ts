// Личный кабинет ученика (п.3.8): профиль + XP, прогресс, напоминания о заданиях.
import { Router } from "express";

import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errors.js";
import { completedLessonIds, computeLessonStatuses, orderedCourseLessonIds } from "../services/progress.js";
import { xpBalance } from "../services/xp.js";

export const meRouter = Router();
meRouter.use(requireAuth);

// Профиль + XP-баланс (SUM xp_log)
meRouter.get("/", asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { id: true, name: true, role: true, email: true, tgUsername: true },
  });
  res.json({ ...user, xp: await xpBalance(user.id) });
}));

// Прогресс по курсам моих потоков: % завершено и первый доступный незавершённый
// урок — для кнопки «Продолжить»
meRouter.get("/progress", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const memberships = await prisma.cohortMember.findMany({
    where: { userId, cohort: { course: { isPublished: true } } },
    include: { cohort: { select: { courseId: true, course: { select: { title: true } } } } },
  });

  const seen = new Set<number>();
  const courses = [];
  for (const m of memberships) {
    const { courseId, course } = m.cohort;
    if (seen.has(courseId)) continue;
    seen.add(courseId);

    const ordered = await orderedCourseLessonIds(courseId);
    const completed = await completedLessonIds(userId, ordered);
    const statuses = computeLessonStatuses(ordered, completed);
    const continueLessonId = ordered.find((id) => statuses.get(id) === "available") ?? null;

    courses.push({
      courseId,
      title: course.title,
      totalLessons: ordered.length,
      completedLessons: completed.size,
      pct: ordered.length ? Math.round((completed.size / ordered.length) * 100) : 0,
      continueLessonId,
    });
  }
  res.json(courses);
}));

// Блок-напоминание: возвращённые на доработку и ожидающие проверки работы
meRouter.get("/pending-tasks", asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  // Берём последнюю версию по каждому заданию и оставляем требующие внимания
  const submissions = await prisma.taskSubmission.findMany({
    where: { userId },
    orderBy: { version: "desc" },
    distinct: ["taskId"],
    include: { task: { select: { id: true, title: true, lessonId: true, deadline: true } } },
  });
  res.json(
    submissions
      .filter((s) => s.status !== "ACCEPTED")
      .map((s) => ({
        taskId: s.task.id,
        title: s.task.title,
        lessonId: s.task.lessonId,
        deadline: s.task.deadline,
        status: s.status,
      })),
  );
}));
