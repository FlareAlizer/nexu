// Админские эндпоинты: структура курса (ADMIN-02) и потоки (ADMIN-03/04).
import { api } from "./client";
import type { BlockType } from "./courses";

export interface AdminCourseListItem {
  id: number;
  title: string;
  isPublished: boolean;
  _count: { modules: number; cohorts: number };
}

export interface AdminBlock {
  id: number;
  type: BlockType;
  content: string;
  orderIndex: number;
}

export interface AdminTaskRef {
  id: number;
  title: string;
  deadline: string | null;
}

export interface AdminTestRef {
  id: number;
  title: string;
  _count: { questions: number };
}

export interface AdminLesson {
  id: number;
  title: string;
  orderIndex: number;
  blocks: AdminBlock[];
  tasks: AdminTaskRef[];
  tests: AdminTestRef[];
}

export interface AdminModule {
  id: number;
  title: string;
  orderIndex: number;
  lessons: AdminLesson[];
}

export interface AdminCourse {
  id: number;
  title: string;
  description: string;
  coverUrl: string | null;
  isPublished: boolean;
  modules: AdminModule[];
}

export interface AdminCohort {
  id: number;
  title: string;
  startDate: string;
  course: { title: string };
  _count: { members: number };
}

const post = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = <T>(path: string) => api<T>(path, { method: "DELETE" });

export const listCourses = () => api<AdminCourseListItem[]>("/admin/courses");
export const getAdminCourse = (id: number) => api<AdminCourse>(`/admin/courses/${id}`);
export const createCourse = (title: string) => post<AdminCourse>("/admin/courses", { title });
export const updateCourse = (id: number, data: Partial<Pick<AdminCourse, "title" | "description" | "isPublished">>) =>
  patch<AdminCourse>(`/admin/courses/${id}`, data);
export const deleteCourse = (id: number) => del<{ ok: true }>(`/admin/courses/${id}`);

export const createModule = (courseId: number, title: string) =>
  post<AdminModule>("/admin/modules", { courseId, title });
export const renameModule = (id: number, title: string) => patch<AdminModule>(`/admin/modules/${id}`, { title });
export const deleteModule = (id: number) => del<{ ok: true }>(`/admin/modules/${id}`);

export const createLesson = (moduleId: number, title: string) =>
  post<AdminLesson>("/admin/lessons", { moduleId, title });
export const renameLesson = (id: number, title: string) => patch<AdminLesson>(`/admin/lessons/${id}`, { title });
export const deleteLesson = (id: number) => del<{ ok: true }>(`/admin/lessons/${id}`);

export const createBlock = (lessonId: number, type: BlockType, content: string) =>
  post<AdminBlock>(`/admin/lessons/${lessonId}/blocks`, { type, content });
export const updateBlock = (id: number, type: BlockType, content: string) =>
  patch<AdminBlock>(`/admin/blocks/${id}`, { type, content });
export const deleteBlock = (id: number) => del<{ ok: true }>(`/admin/blocks/${id}`);

export const reorder = (entity: "modules" | "lessons" | "blocks", ids: number[]) =>
  post<{ ok: true }>("/admin/reorder", { entity, ids });

export interface TaskInput {
  title: string;
  description: string;
  deadline?: string | null;
}

export const createTask = (lessonId: number, data: TaskInput) =>
  post<AdminTaskRef>("/admin/tasks", { lessonId, ...data });
export const updateTask = (id: number, data: TaskInput) => patch<AdminTaskRef>(`/admin/tasks/${id}`, data);
export const deleteTask = (id: number) => del<{ ok: true }>(`/admin/tasks/${id}`);
export const getAdminTask = (id: number) =>
  api<{ id: number; title: string; description: string; deadline: string | null }>(`/tasks/${id}`);

export interface QuestionInput {
  type: "SINGLE" | "MULTIPLE" | "OPEN";
  text: string;
  explanation: string;
  answers: { text: string; isCorrect: boolean }[];
}

export interface AdminTestFull {
  id: number;
  title: string;
  questions: {
    id: number;
    type: QuestionInput["type"];
    text: string;
    explanation: string;
    answers: { id: number; text: string; isCorrect: boolean }[];
  }[];
  _count: { attempts: number };
}

export const getAdminTest = (id: number) => api<AdminTestFull>(`/admin/tests/${id}`);
export const createTest = (lessonId: number, title: string, questions: QuestionInput[]) =>
  post<{ id: number }>("/admin/tests", { lessonId, title, questions });
export const replaceTest = (id: number, title: string, questions: QuestionInput[]) =>
  api<{ ok: true }>(`/admin/tests/${id}`, { method: "PUT", body: JSON.stringify({ title, questions }) });
export const deleteTest = (id: number) => del<{ ok: true }>(`/admin/tests/${id}`);

export interface AdminUser {
  id: number;
  name: string;
  email: string | null;
  tgUsername: string | null;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  isBlocked: boolean;
  lastSeenAt: string | null;
  cohorts: { id: number; title: string }[];
}

export interface AdminDashboard {
  dau: number;
  weeklyActive: number;
  pendingSubmissions: number;
  totalStudents: number;
}

export const listUsers = () => api<AdminUser[]>("/admin/users");
export const patchUser = (
  id: number,
  data: Partial<Pick<AdminUser, "role" | "isBlocked" | "name" | "email">> & { password?: string },
) => patch<AdminUser>(`/admin/users/${id}`, data);
export const getDashboard = () => api<AdminDashboard>("/admin/dashboard");

export const listCohorts = () => api<AdminCohort[]>("/admin/cohorts");
export const createCohort = (courseId: number, title: string, startDate: string) =>
  post<AdminCohort>("/admin/cohorts", { courseId, title, startDate });
export const addCohortMember = (cohortId: number, member: { email?: string; tgUsername?: string }) =>
  post<{ ok: true }>(`/admin/cohorts/${cohortId}/members`, member);

// ADMIN-06: рассылка потоку через TG-бота
// Рассылка уходит в фон; ответ — сколько получателей принято в отправку
export const broadcastToCohort = (cohortId: number, text: string) =>
  post<{ accepted: number; total: number }>(`/admin/cohorts/${cohortId}/broadcast`, { text });
