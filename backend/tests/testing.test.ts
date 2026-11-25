// Автопроверка тестов (п.3.5, TEST-04): точное совпадение набора ответов, OPEN вне балла.
import { describe, expect, it } from "vitest";

import { isPassed, isPassed80, scoreAttempt } from "../src/services/testing.js";
import type { QuestionForScoring } from "../src/services/testing.js";

const questions: QuestionForScoring[] = [
  { id: 1, type: "SINGLE", correctAnswerIds: [11] },
  { id: 2, type: "MULTIPLE", correctAnswerIds: [21, 22] },
  { id: 3, type: "OPEN", correctAnswerIds: [] },
];

describe("scoreAttempt", () => {
  it("считает верные SINGLE и MULTIPLE, OPEN вне балла", () => {
    const r = scoreAttempt(questions, { "1": [11], "2": [22, 21], "3": "мой ответ" });
    expect(r.score).toBe(2);
    expect(r.maxScore).toBe(2);
    expect(r.perQuestion).toEqual([
      { questionId: 1, correct: true },
      { questionId: 2, correct: true },
      { questionId: 3, correct: null },
    ]);
  });

  it("MULTIPLE: неполный или лишний выбор — неверно", () => {
    expect(scoreAttempt(questions, { "1": [11], "2": [21] }).score).toBe(1);
    expect(scoreAttempt(questions, { "1": [11], "2": [21, 22, 23] }).score).toBe(1);
  });

  it("дубли в ответе не помогают", () => {
    expect(scoreAttempt(questions, { "2": [21, 21] }).score).toBe(0);
  });

  it("пропущенный вопрос — неверно", () => {
    const r = scoreAttempt(questions, {});
    expect(r.score).toBe(0);
    expect(r.maxScore).toBe(2);
  });

  it("текст вместо массива на закрытом вопросе — неверно, не падает", () => {
    expect(scoreAttempt(questions, { "1": "11" }).score).toBe(0);
  });
});

describe("isPassed80", () => {
  it("80% ровно — пройден", () => {
    expect(isPassed80({ score: 4, maxScore: 5 })).toBe(true);
  });
  it("ниже 80% — нет", () => {
    expect(isPassed80({ score: 3, maxScore: 5 })).toBe(false);
  });
  it("нет автопроверяемых вопросов — бонуса нет", () => {
    expect(isPassed80({ score: 0, maxScore: 0 })).toBe(false);
  });
});

describe("isPassed (порог засчёта теста, COURSE-04)", () => {
  it("0 из 5 — не пройден (клик по пустым ответам не открывает урок)", () => {
    expect(isPassed({ score: 0, maxScore: 5 })).toBe(false);
  });
  it("ниже порога 60% — не пройден", () => {
    expect(isPassed({ score: 2, maxScore: 5 })).toBe(false);
  });
  it("60% ровно — пройден", () => {
    expect(isPassed({ score: 3, maxScore: 5 })).toBe(true);
  });
  it("только OPEN-вопросы (maxScore 0) — засчитываем по завершению", () => {
    expect(isPassed({ score: 0, maxScore: 0 })).toBe(true);
  });
});
