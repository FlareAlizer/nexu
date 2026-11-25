// Тесты (п.3.5): вопросы без правильных ответов, сдача, разбор с объяснениями.
import { api } from "./client";

export type QuestionType = "SINGLE" | "MULTIPLE" | "OPEN";

export interface TestQuestion {
  id: number;
  type: QuestionType;
  text: string;
  answers: { id: number; text: string }[];
}

export interface TestData {
  id: number;
  lessonId: number;
  title: string;
  questions: TestQuestion[];
  lastAttempt: { id: number; score: number | null; maxScore: number | null; finishedAt: string } | null;
}

/** questionId → выбранные id вариантов или текст (OPEN). */
export type AttemptAnswers = Record<string, number[] | string>;

export interface AttemptResult {
  attemptId: number;
  score: number;
  maxScore: number;
  xpGranted: number;
  review: {
    questionId: number;
    correct: boolean | null;
    correctAnswerIds: number[];
    explanation: string;
  }[];
}

export const getTest = (id: number) => api<TestData>(`/tests/${id}`);

export const submitAttempt = (testId: number, answers: AttemptAnswers) =>
  api<AttemptResult>(`/tests/${testId}/attempts`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
