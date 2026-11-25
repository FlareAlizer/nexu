// Задания-эссе (п.3.4): условие, сдача файлом/текстом, версии, комментарии.
import { api } from "./client";

export type SubmissionStatus = "PENDING" | "ACCEPTED" | "NEEDS_REVISION";

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  PENDING: "На проверке",
  ACCEPTED: "Принято",
  NEEDS_REVISION: "На доработке",
};

export interface TaskComment {
  id: number;
  content: string;
  createdAt: string;
  author: { name: string; role: string };
}

export interface Submission {
  id: number;
  fileUrl: string | null;
  text: string | null;
  status: SubmissionStatus;
  version: number;
  createdAt: string;
  comments: TaskComment[];
}

export interface TaskData {
  id: number;
  lessonId: number;
  title: string;
  description: string;
  deadline: string | null;
  submissions: Submission[]; // новые версии первыми
}

export const getTask = (id: number) => api<TaskData>(`/tasks/${id}`);

/** Сдать: файл и/или текст. Возвращает созданную версию + начисленный XP. */
export function submitTask(taskId: number, file: File | null, text: string) {
  const form = new FormData();
  if (file) form.append("file", file);
  if (text) form.append("text", text);
  return api<Submission & { xpGranted: number }>(`/tasks/${taskId}/submissions`, {
    method: "POST",
    body: form,
  });
}

export const getSubmissionFileUrl = (submissionId: number) =>
  api<{ url: string }>(`/tasks/submissions/${submissionId}/file-url`);
