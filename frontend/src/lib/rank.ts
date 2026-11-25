// Ранги по XP. Бэкенд отдаёт только сумму XP (/me), ранг считается на фронте.
// Пороги прикинуты от начислений п.3.6: урок с видео, заданием и тестом даёт до 90 XP,
// закрытый модуль — ещё 50. Перед запуском сверить с заказчиком.

export const RANKS = [
  { title: "Юнлинг", from: 0 },
  { title: "Падаван", from: 100 },
  { title: "Рыцарь", from: 400 },
  { title: "Магистр", from: 1000 },
] as const;

export interface RankInfo {
  title: string;
  /** Номер ранга с единицы. */
  level: number;
  /** Следующий ранг; null — достигнут последний. */
  next: { title: string; from: number } | null;
  /** Сколько XP осталось до следующего ранга. */
  left: number;
  /** Доля пути от текущего ранга к следующему, 0–100. */
  pct: number;
}

/** Ранг и прогресс до следующего по сумме XP. */
export function rankOf(xp: number): RankInfo {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].from) i += 1;
  const current = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  if (!next) return { title: current.title, level: i + 1, next: null, left: 0, pct: 100 };
  const span = next.from - current.from;
  return {
    title: current.title,
    level: i + 1,
    next,
    left: next.from - xp,
    pct: Math.round(((xp - current.from) / span) * 100),
  };
}
