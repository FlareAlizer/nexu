// Порядок модулей/уроков/блоков (COURSE-02): фронт присылает массив id
// в новом порядке, мы превращаем его в обновления order_index.

export class ReorderError extends Error {}

interface Row {
  id: number;
  parentId: number;
}

/**
 * Построить обновления order_index по новому порядку id.
 * Требования: все id существуют, принадлежат одному родителю и перечислены все без повторов —
 * иначе ReorderError (частичный порядок привёл бы к дырам и дублям order_index).
 * Возвращает [{id, orderIndex}] по позиции в массиве.
 */
export function buildReorderUpdates(
  existing: Row[],
  orderedIds: number[],
): { id: number; orderIndex: number }[] {
  if (existing.length === 0) throw new ReorderError("нечего переупорядочивать");

  const parentId = existing[0].parentId;
  if (existing.some((r) => r.parentId !== parentId)) {
    throw new ReorderError("элементы принадлежат разным родителям");
  }

  const existingIds = new Set(existing.map((r) => r.id));
  if (orderedIds.length !== existingIds.size || new Set(orderedIds).size !== orderedIds.length) {
    throw new ReorderError("нужно перечислить все элементы родителя ровно по одному разу");
  }
  for (const id of orderedIds) {
    if (!existingIds.has(id)) throw new ReorderError(`элемент ${id} не принадлежит родителю`);
  }

  return orderedIds.map((id, i) => ({ id, orderIndex: i }));
}
