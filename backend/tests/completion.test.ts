// Правило «Завершить урок» (п.3.3, зафиксировано с Дианой):
// (видео ≥80% ИЛИ нет) И (задание сдано ИЛИ нет) И (тест пройден ИЛИ нет).
import { describe, expect, it } from "vitest";

import { computeCompletion } from "../src/services/progress.js";

const base = {
  hasVideo: false,
  videoPct: 0,
  taskIds: [] as number[],
  submittedTaskIds: new Set<number>(),
  testIds: [] as number[],
  passedTestIds: new Set<number>(),
};

describe("computeCompletion", () => {
  it("пустой урок (только текст) завершается сразу", () => {
    expect(computeCompletion(base).canComplete).toBe(true);
  });

  it("видео 79% — нельзя, 80% — можно", () => {
    expect(computeCompletion({ ...base, hasVideo: true, videoPct: 79 }).canComplete).toBe(false);
    expect(computeCompletion({ ...base, hasVideo: true, videoPct: 80 }).canComplete).toBe(true);
  });

  it("несданное задание блокирует", () => {
    const s = computeCompletion({ ...base, taskIds: [1] });
    expect(s.taskOk).toBe(false);
    expect(s.canComplete).toBe(false);
  });

  it("сданы все задания из нескольких", () => {
    expect(
      computeCompletion({ ...base, taskIds: [1, 2], submittedTaskIds: new Set([1]) }).canComplete,
    ).toBe(false);
    expect(
      computeCompletion({ ...base, taskIds: [1, 2], submittedTaskIds: new Set([1, 2]) }).canComplete,
    ).toBe(true);
  });

  it("непройденный тест блокирует, пройденный — нет", () => {
    expect(computeCompletion({ ...base, testIds: [5] }).canComplete).toBe(false);
    expect(
      computeCompletion({ ...base, testIds: [5], passedTestIds: new Set([5]) }).canComplete,
    ).toBe(true);
  });

  it("все три условия сразу", () => {
    const s = computeCompletion({
      hasVideo: true,
      videoPct: 95,
      taskIds: [1],
      submittedTaskIds: new Set([1]),
      testIds: [2],
      passedTestIds: new Set([2]),
    });
    expect(s).toEqual({ videoOk: true, taskOk: true, testOk: true, canComplete: true });
  });
});
