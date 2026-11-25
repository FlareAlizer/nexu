// Студенческие эндпоинты: курс своего потока и страница урока (COURSE-01..05).
import { api } from "./client";

export type LessonStatus = "completed" | "available" | "locked";
export type BlockType = "VIDEO" | "TEXT" | "PDF";

export interface CourseLesson {
  id: number;
  title: string;
  status: LessonStatus;
}

export interface CourseModule {
  id: number;
  title: string;
  lessons: CourseLesson[];
}

export interface MyCourse {
  id: number;
  title: string;
  description: string;
  coverUrl: string | null;
  modules: CourseModule[];
  cohort?: { id: number; title: string; tgChatUrl: string | null };
}

export interface LessonBlock {
  id: number;
  type: BlockType;
  content: string; // VIDEO: id ролика Kinescope; TEXT: markdown; PDF: URL
}

export interface LessonCompletion {
  videoOk: boolean;
  taskOk: boolean;
  testOk: boolean;
  canComplete: boolean;
}

export interface LessonData {
  id: number;
  title: string;
  module: { id: number; title: string; courseId: number };
  blocks: LessonBlock[];
  tasks: { id: number; title: string; deadline: string | null }[];
  tests: { id: number; title: string }[];
  progress: { videoWatchedPct: number; videoPositionS: number; isCompleted: boolean };
  completion: LessonCompletion;
}

export const getMyCourses = () => api<MyCourse[]>("/courses/my");
export const getCourse = (id: number) => api<MyCourse>(`/courses/${id}`);
export const getLesson = (id: number) => api<LessonData>(`/lessons/${id}`);

export const postVideoProgress = (lessonId: number, pct: number, positionS: number) =>
  api<{ pct: number; xpGranted: number }>(`/lessons/${lessonId}/video-progress`, {
    method: "POST",
    body: JSON.stringify({ pct: Math.round(pct), positionS: Math.round(positionS) }),
  });

export const completeLesson = (lessonId: number) =>
  api<{ xpGranted: number; nextLessonId: number | null }>(`/lessons/${lessonId}/complete`, {
    method: "POST",
  });
