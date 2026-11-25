// Доступ ученика к контенту: поток (COURSE-05), публикация, блокировка (COURSE-04).
// Единый источник правды — используется страницей курса, урока, заданиями и тестами.
import { prisma } from "../db.js";
import type { AuthUser } from "../middleware/auth.js";
import { isLessonUnlocked } from "./progress.js";

export interface AccessDenied {
  code: 403 | 404;
  error: string;
}

/**
 * Доступ ученика к курсу: член потока этого курса + курс опубликован.
 * Преподаватель и админ видят любой курс. Не проверяет существование курса
 * (для 404 используйте отдельную проверку по данным роута).
 */
export async function courseAccessError(user: AuthUser, courseId: number): Promise<AccessDenied | null> {
  if (user.role !== "STUDENT") return null;
  const member = await prisma.cohortMember.findFirst({
    where: { userId: user.id, cohort: { courseId, course: { isPublished: true } } },
  });
  return member ? null : { code: 403, error: "курс недоступен" };
}

/**
 * Полный доступ к уроку: курс доступен ученику (COURSE-05) И урок разблокирован (COURSE-04).
 * Для чтения контента урока/задания/теста. Преподаватель и админ видят всё.
 */
export async function lessonAccessError(user: AuthUser, lessonId: number): Promise<AccessDenied | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) return { code: 404, error: "урок не найден" };

  const courseDenied = await courseAccessError(user, lesson.module.courseId);
  if (courseDenied) return { code: 403, error: "урок недоступен" };
  if (user.role !== "STUDENT") return null;

  if (!(await isLessonUnlocked(user.id, lessonId))) {
    return { code: 403, error: "урок откроется после завершения предыдущего" };
  }
  return null;
}

/**
 * Лёгкая проверка для записи прогресса видео (горячий путь): курс доступен ученику.
 * Проверку блокировки (COURSE-04) не делаем — запись прогресса на заблокированный
 * урок безвредна (разблокировка считается от завершений, не от прогресса), а полный
 * пересчёт порядка уроков на каждый пинг плеера съедал бы бюджет 300 мс (п.4.1).
 * Возвращает { courseId } если доступ есть, иначе AccessDenied.
 */
export async function lessonWriteAccess(
  user: AuthUser,
  lessonId: number,
): Promise<AccessDenied | { courseId: number }> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { module: { select: { courseId: true } } },
  });
  if (!lesson) return { code: 404, error: "урок не найден" };
  const denied = await courseAccessError(user, lesson.module.courseId);
  return denied ?? { courseId: lesson.module.courseId };
}
