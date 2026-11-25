// Панель преподавателя/куратора (п.3.9): очередь, проверка, ученики потока.
import { api } from "./client";
import type { Submission, SubmissionStatus } from "./tasks";

export interface QueueItem {
  id: number;
  createdAt: string;
  version: number;
  user: { id: number; name: string };
  task: { id: number; title: string; lesson: { title: string } };
}

export interface SubmissionDetail {
  id: number;
  text: string | null;
  fileUrl: string | null;
  status: SubmissionStatus;
  version: number;
  createdAt: string;
  user: { id: number; name: string };
  task: { id: number; title: string; description: string };
  history: Submission[];
}

export interface CohortStudents {
  cohortId: number;
  title: string;
  students: { id: number; name: string; lastSeenAt: string | null; progressPct: number }[];
}

export const getQueue = () => api<QueueItem[]>("/teacher/queue");
export const getSubmission = (id: number) => api<SubmissionDetail>(`/teacher/submissions/${id}`);
export const reviewSubmission = (id: number, status: "ACCEPTED" | "NEEDS_REVISION", comment: string) =>
  api<unknown>(`/teacher/submissions/${id}/review`, {
    method: "POST",
    body: JSON.stringify({ status, comment: comment || undefined }),
  });
export const listTeacherCohorts = () =>
  api<{ id: number; title: string; course: { title: string }; _count: { members: number } }[]>(
    "/teacher/cohorts",
  );
export const getCohortStudents = (cohortId: number) =>
  api<CohortStudents>(`/teacher/cohorts/${cohortId}/students`);
