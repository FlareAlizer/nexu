// Автопроверка тестов (п.3.5): SINGLE/MULTIPLE считаются автоматически,
// OPEN (развёрнутый текст) в балл не входит — его читает преподаватель.

export interface QuestionForScoring {
  id: number;
  type: "SINGLE" | "MULTIPLE" | "OPEN";
  correctAnswerIds: number[];
}

/** Ответы ученика: questionId → выбранные id (SINGLE/MULTIPLE) или текст (OPEN). */
export type AttemptAnswers = Record<string, number[] | string>;

export interface QuestionResult {
  questionId: number;
  correct: boolean | null; // null = OPEN, автопроверки нет
}

export interface AttemptScore {
  score: number;
  maxScore: number; // число автопроверяемых вопросов
  perQuestion: QuestionResult[];
}

/** Посчитать попытку: балл = число верных SINGLE/MULTIPLE. Ответ верен при точном совпадении набора. */
export function scoreAttempt(questions: QuestionForScoring[], answers: AttemptAnswers): AttemptScore {
  const perQuestion: QuestionResult[] = [];
  let score = 0;
  let maxScore = 0;

  for (const q of questions) {
    if (q.type === "OPEN") {
      perQuestion.push({ questionId: q.id, correct: null });
      continue;
    }
    maxScore += 1;
    const given = answers[String(q.id)];
    const chosen = Array.isArray(given) ? [...new Set(given)] : [];
    const correctSet = new Set(q.correctAnswerIds);
    const correct = chosen.length === correctSet.size && chosen.every((id) => correctSet.has(id));
    if (correct) score += 1;
    perQuestion.push({ questionId: q.id, correct });
  }

  return { score, maxScore, perQuestion };
}

// Порог «тест пройден» (для XP test_passed и разблокировки урока COURSE-04).
// 80%+ даёт дополнительный бонус test_80. ВНИМАНИЕ: 0.6 — рабочее допущение,
// в ТЗ порог не задан; согласовать с Дианой (см. research/комментарии-к-ТЗ.md).
export const TEST_PASS_PCT = 0.6;

/**
 * Тест засчитан как пройденный. Если автопроверяемых вопросов нет (только OPEN),
 * балл посчитать нельзя — считаем пройденным по факту завершения (проверит препод).
 */
export function isPassed(s: Pick<AttemptScore, "score" | "maxScore">): boolean {
  return s.maxScore === 0 || s.score / s.maxScore >= TEST_PASS_PCT;
}

/** Тест на 80%+ (TEST-04): дополнительный бонус. При отсутствии автопроверки не даём. */
export function isPassed80(s: Pick<AttemptScore, "score" | "maxScore">): boolean {
  return s.maxScore > 0 && s.score / s.maxScore >= 0.8;
}
