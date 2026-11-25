// Личный кабинет (п.3.8): профиль + XP, прогресс курсов, напоминания о заданиях.
import { api } from "./client";
import type { SubmissionStatus } from "./tasks";

export interface MeProfile {
  id: number;
  name: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  email: string | null;
  tgUsername: string | null;
  xp: number;
}

export interface CourseProgress {
  courseId: number;
  title: string;
  totalLessons: number;
  completedLessons: number;
  pct: number;
  continueLessonId: number | null; // первый доступный незавершённый — кнопка «Продолжить»
}

export interface PendingTask {
  taskId: number;
  title: string;
  lessonId: number;
  deadline: string | null;
  status: SubmissionStatus;
}

export const getMe = () => api<MeProfile>("/me");
export const getMyProgress = () => api<CourseProgress[]>("/me/progress");
export const getPendingTasks = () => api<PendingTask[]>("/me/pending-tasks");
