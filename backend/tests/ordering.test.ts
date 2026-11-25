// Логика reorder (COURSE-02): полный список одного родителя, без дублей и чужих id.
import { describe, expect, it } from "vitest";

import { buildReorderUpdates, ReorderError } from "../src/services/ordering.js";

const siblings = [
  { id: 1, parentId: 10 },
  { id: 2, parentId: 10 },
  { id: 3, parentId: 10 },
];

describe("buildReorderUpdates", () => {
  it("присваивает order_index по позиции в массиве", () => {
    expect(buildReorderUpdates(siblings, [3, 1, 2])).toEqual([
      { id: 3, orderIndex: 0 },
      { id: 1, orderIndex: 1 },
      { id: 2, orderIndex: 2 },
    ]);
  });

  it("отклоняет неполный список", () => {
    expect(() => buildReorderUpdates(siblings, [3, 1])).toThrow(ReorderError);
  });

  it("отклоняет дубли", () => {
    expect(() => buildReorderUpdates(siblings, [3, 1, 1])).toThrow(ReorderError);
  });

  it("отклоняет чужой id", () => {
    expect(() => buildReorderUpdates(siblings, [3, 1, 99])).toThrow(ReorderError);
  });

  it("отклоняет элементы разных родителей", () => {
    const mixed = [...siblings, { id: 4, parentId: 20 }];
    expect(() => buildReorderUpdates(mixed, [1, 2, 3, 4])).toThrow(ReorderError);
  });

  it("отклоняет пустой список", () => {
    expect(() => buildReorderUpdates([], [])).toThrow(ReorderError);
  });
});
