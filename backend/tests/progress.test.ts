// Блокировка уроков (COURSE-04): первый доступен, N+1 открывается после завершения N.
import { describe, expect, it } from "vitest";

import { computeLessonStatuses } from "../src/services/progress.js";

describe("computeLessonStatuses", () => {
  it("без прогресса: первый доступен, остальные заблокированы", () => {
    const s = computeLessonStatuses([1, 2, 3], new Set());
    expect(s.get(1)).toBe("available");
    expect(s.get(2)).toBe("locked");
    expect(s.get(3)).toBe("locked");
  });

  it("после завершения первого открывается второй", () => {
    const s = computeLessonStatuses([1, 2, 3], new Set([1]));
    expect(s.get(1)).toBe("completed");
    expect(s.get(2)).toBe("available");
    expect(s.get(3)).toBe("locked");
  });

  it("все завершены", () => {
    const s = computeLessonStatuses([1, 2], new Set([1, 2]));
    expect(s.get(1)).toBe("completed");
    expect(s.get(2)).toBe("completed");
  });

  it("пустой курс — пустой результат", () => {
    expect(computeLessonStatuses([], new Set()).size).toBe(0);
  });
});
