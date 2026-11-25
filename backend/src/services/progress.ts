// Блокировка уроков (COURSE-04) и завершение (п.3.3).
// Правило завершения урока (зафиксировано с Дианой в комментариях к ТЗ):
//   (видео ≥80% ИЛИ нет видео) И (задание сдано ИЛИ нет задания) И (тест пройден ИЛИ нет теста)
import { config } from "../config.js";
import { prisma } from "../db.js";
import { notifyUser, templates } from "./telegram.js";
import { isPassed } from "./testing.js";
import { grantXp } from "./xp.js";

export type LessonStatus = "completed" | "available" | "locked";

/**
 * Статусы уроков курса по порядку (модули и уроки уже отсортированы по order_index):
 * первый урок доступен, урок N+1 доступен когда N завершён.
 * Чистая функция — под unit-тест (п.8.2).
 */
export function computeLessonStatuses(
  orderedLessonIds: number[],
  completedIds: ReadonlySet<number>,
): Map<number, LessonStatus> {
  const result = new Map<number, LessonStatus>();
  let prevCompleted = true; // «нулевой» урок считается завершённым — первый всегда доступен
  for (const id of orderedLessonIds) {
    const done = completedIds.has(id);
    result.set(id, done ? "completed" : prevCompleted ? "available" : "locked");
    prevCompleted = done;
  }
  return result;
}

/** Уроки курса в сквозном порядке: по order_index модуля, затем урока. */
export async function orderedCourseLessonIds(courseId: number): Promise<number[]> {
  const modules = await prisma.module.findMany({
    where: { courseId },
    orderBy: { orderIndex: "asc" },
    select: { lessons: { orderBy: { orderIndex: "asc" }, select: { id: true } } },
  });
  return modules.flatMap((m) => m.lessons.map((l) => l.id));
}

/** Завершённые учеником уроки курса. */
export async function completedLessonIds(userId: number, lessonIds: number[]): Promise<Set<number>> {
  const rows = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: lessonIds }, isCompleted: true },
    select: { lessonId: true },
  });
  return new Set(rows.map((r) => r.lessonId));
}

/** Доступен ли урок ученику: первый урок курса или предыдущий по сквозному порядку завершён. */
export async function isLessonUnlocked(userId: number, lessonId: number): Promise<boolean> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) return false;
  const ordered = await orderedCourseLessonIds(lesson.module.courseId);
  const completed = await completedLessonIds(userId, ordered);
  return computeLessonStatuses(ordered, completed).get(lessonId) !== "locked";
}

// ---------- завершение урока (п.3.3, COURSE-05 «кнопка завершения») ----------

export interface CompletionState {
  videoOk: boolean; // видео ≥80% или видео в уроке нет
  taskOk: boolean; // все задания урока сданы (хотя бы одна версия) или заданий нет
  testOk: boolean; // по всем тестам есть завершённая попытка или тестов нет
  canComplete: boolean;
}

/** Чистая проверка правила завершения (зафиксировано с Дианой): все части — «или нет». */
export function computeCompletion(input: {
  hasVideo: boolean;
  videoPct: number;
  taskIds: number[];
  submittedTaskIds: ReadonlySet<number>;
  testIds: number[];
  passedTestIds: ReadonlySet<number>;
}): CompletionState {
  const videoOk = !input.hasVideo || input.videoPct >= 80;
  const taskOk = input.taskIds.every((id) => input.submittedTaskIds.has(id));
  const testOk = input.testIds.every((id) => input.passedTestIds.has(id));
  return { videoOk, taskOk, testOk, canComplete: videoOk && taskOk && testOk };
}

/** Состояние условий завершения урока для ученика (для кнопки на фронте и для complete). */
export async function lessonCompletionState(userId: number, lessonId: number): Promise<CompletionState> {
  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    select: {
      blocks: { where: { type: "VIDEO" }, select: { id: true }, take: 1 },
      tasks: { select: { id: true } },
      tests: { select: { id: true } },
    },
  });
  const taskIds = lesson.tasks.map((t) => t.id);
  const testIds = lesson.tests.map((t) => t.id);

  const [progress, submitted, passed] = await Promise.all([
    prisma.lessonProgress.findUnique({
      where: { lessonId_userId: { lessonId, userId } },
      select: { videoWatchedPct: true },
    }),
    taskIds.length
      ? prisma.taskSubmission.findMany({
          where: { userId, taskId: { in: taskIds } },
          select: { taskId: true },
          distinct: ["taskId"],
        })
      : [],
    testIds.length
      ? prisma.testAttempt.findMany({
          where: { userId, testId: { in: testIds }, finishedAt: { not: null } },
          select: { testId: true, score: true, maxScore: true },
        })
      : [],
  ]);

  // Тест засчитан, если ХОТЯ БЫ одна попытка прошла порог (COURSE-04): завершение ≠ прохождение
  const passedTestIds = new Set<number>();
  for (const a of passed) {
    if (isPassed({ score: a.score ?? 0, maxScore: a.maxScore ?? 0 })) passedTestIds.add(a.testId);
  }

  return computeCompletion({
    hasVideo: lesson.blocks.length > 0,
    videoPct: progress?.videoWatchedPct ?? 0,
    taskIds,
    submittedTaskIds: new Set(submitted.map((s) => s.taskId)),
    testIds,
    passedTestIds,
  });
}

export class NotCompletableError extends Error {}

/**
 * Завершить урок: проверка условий, is_completed, +50 XP если модуль закрыт.
 * Возвращает начисленный XP и следующий доступный урок (для «перейти дальше»).
 */
export async function completeLesson(
  userId: number,
  lessonId: number,
): Promise<{ xpGranted: number; nextLessonId: number | null }> {
  const state = await lessonCompletionState(userId, lessonId);
  if (!state.canComplete) throw new NotCompletableError("условия завершения ещё не выполнены");

  const lesson = await prisma.lesson.findUniqueOrThrow({
    where: { id: lessonId },
    select: { moduleId: true, module: { select: { courseId: true } } },
  });

  // Было ли уже завершено — чтобы не слать NOTIF-02 повторно при ретрае/двух вкладках
  const before = await prisma.lessonProgress.findUnique({
    where: { lessonId_userId: { lessonId, userId } },
    select: { isCompleted: true },
  });
  const wasCompleted = before?.isCompleted ?? false;

  await prisma.lessonProgress.upsert({
    where: { lessonId_userId: { lessonId, userId } },
    create: { lessonId, userId, isCompleted: true },
    update: { isCompleted: true },
  });

  // +10 за прохождение урока (п.3.6). Идемпотентно: для видео-урока уже начислено
  // в video-progress при 80%, здесь no-op; для текстового урока начисляем тут
  let xpGranted = await grantXp(userId, "lesson_watched", lessonId);

  // +50, когда закрыт весь модуль (п.3.6), идемпотентно по moduleId
  const moduleLessons = await prisma.lesson.findMany({
    where: { moduleId: lesson.moduleId },
    select: { id: true },
  });
  const completedInModule = await completedLessonIds(userId, moduleLessons.map((l) => l.id));
  if (moduleLessons.every((l) => completedInModule.has(l.id))) {
    xpGranted += await grantXp(userId, "module_completed", lesson.moduleId);
  }

  // Следующий урок по сквозному порядку курса — теперь он разблокирован
  const ordered = await orderedCourseLessonIds(lesson.module.courseId);
  const nextLessonId = ordered[ordered.indexOf(lessonId) + 1] ?? null;

  // NOTIF-02 «открылся урок»: только при первом завершении (без спама), fire-and-forget
  if (nextLessonId && !wasCompleted) {
    const next = await prisma.lesson.findUnique({ where: { id: nextLessonId }, select: { title: true } });
    if (next) {
      void notifyUser(
        userId,
        templates.newLesson(next.title, `${config.frontendOrigin}/lessons/${nextLessonId}`),
      );
    }
  }

  return { xpGranted, nextLessonId };
}
