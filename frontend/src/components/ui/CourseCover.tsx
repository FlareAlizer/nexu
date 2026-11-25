// Обложка курса. Пока у курса нет картинки (coverUrl пустой), рисуем SVG по названию и id:
// планета, орбиты, карта звёзд. Один курс — всегда один и тот же рисунок.
import { useId, useMemo } from "react";
import type { ReactNode } from "react";

import { hashString, seededRandom } from "../../lib/seed";

interface Palette {
  bg: [string, string];
  planet: [string, string];
  line: string;
  star: string;
  /** Светлая обложка: подписи поверх неё тёмные. */
  light: boolean;
}

const PALETTES: Palette[] = [
  { bg: ["#0c1730", "#1a3156"], planet: ["#8db4de", "#1e3a63"], line: "#74c4e8", star: "#dce6f5", light: false },
  { bg: ["#16122c", "#2c2150"], planet: ["#b8a2e0", "#3e2c6e"], line: "#a996e0", star: "#e4def5", light: false },
  { bg: ["#1c1213", "#3b2019"], planet: ["#e0a074", "#5e2d1e"], line: "#e5c45c", star: "#f3e3cf", light: false },
  { bg: ["#b9c8dd", "#8ea5c6"], planet: ["#eef3fa", "#6f88ac"], line: "#2f4b74", star: "#f7faff", light: true },
  { bg: ["#0a1b1d", "#14393c"], planet: ["#8fd3c4", "#1c514b"], line: "#6ecfa0", star: "#d8f0ea", light: false },
  { bg: ["#d8c8a2", "#bba06f"], planet: ["#f4e9cf", "#9a7646"], line: "#5f4a2b", star: "#fff8e6", light: true },
];

const W = 400;
const H = 240;

/** Параметры рисунка по сиду. Вынесено из компонента, чтобы не пересчитывать на каждый рендер. */
function compose(seed: string, variant?: number) {
  const rnd = seededRandom(hashString(seed));
  const pick = Math.floor(rnd() * PALETTES.length);
  const palette = PALETTES[variant === undefined ? pick : Math.abs(variant) % PALETTES.length];
  const planet = { cx: 255 + rnd() * 85, cy: 120 + rnd() * 80, r: 58 + rnd() * 38 };
  const tilt = -28 + rnd() * 36;
  const hasRing = rnd() > 0.45;
  const bands = Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => ({
    y: planet.cy - planet.r + rnd() * planet.r * 2,
    h: 4 + rnd() * 12,
    o: 0.08 + rnd() * 0.16,
  }));
  const orbits = Array.from({ length: 2 + Math.floor(rnd() * 2) }, (_, i) => {
    const rx = planet.r * (1.55 + i * 0.5 + rnd() * 0.2);
    const angle = rnd() * Math.PI * 2;
    return { rx, ry: rx * 0.3, moon: { a: angle, r: 2.5 + rnd() * 3 } };
  });
  const stars = Array.from({ length: 46 }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.5 + rnd() * 1.1, o: 0.3 + rnd() * 0.6 }));
  // «созвездие»: ломаная из нескольких ярких точек в левой части
  const chart = Array.from({ length: 5 + Math.floor(rnd() * 2) }, (_, i) => ({
    x: 26 + i * 30 + rnd() * 18,
    y: 70 + rnd() * 110,
  }));
  return { palette, planet, tilt, hasRing, bands, orbits, stars, chart };
}

export default function CourseCover({
  seed,
  variant,
  imageUrl,
  children,
  className,
}: {
  /** Строка, от которой зависит рисунок: обычно id и название курса. */
  seed: string;
  /** Номер палитры. Соседние курсы с id подряд получают разные цвета; без него палитра берётся из сида. */
  variant?: number;
  /** Загруженная обложка курса; если есть — показываем её вместо рисунка. */
  imageUrl?: string | null;
  /** Подписи поверх обложки. Функция получает флаг светлой обложки. */
  children?: (light: boolean) => ReactNode;
  className?: string;
}) {
  const uid = useId();
  const art = useMemo(() => compose(seed, variant), [seed, variant]);
  const { palette: p, planet, tilt, hasRing, bands, orbits, stars, chart } = art;
  const id = (name: string) => `${uid}-${name}`;

  if (imageUrl) {
    return (
      <div className={`relative overflow-hidden bg-raised ${className ?? ""}`} style={{ aspectRatio: `${W} / ${H}` }}>
        <img src={imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        {/* затемнение снизу и сверху, чтобы подписи читались на любой картинке */}
        <div className="absolute inset-0 bg-gradient-to-b from-void/50 via-transparent to-void/70" />
        {children && <div className="absolute inset-0">{children(false)}</div>}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={{ aspectRatio: `${W} / ${H}` }}>
      <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={id("bg")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.bg[0]} />
            <stop offset="1" stopColor={p.bg[1]} />
          </linearGradient>
          <radialGradient id={id("planet")} cx="0.32" cy="0.28" r="0.85">
            <stop offset="0" stopColor={p.planet[0]} />
            <stop offset="1" stopColor={p.planet[1]} />
          </radialGradient>
          <clipPath id={id("disc")}>
            <circle cx={planet.cx} cy={planet.cy} r={planet.r} />
          </clipPath>
          {/* передняя половина кольца: всё, что ниже центра планеты */}
          <clipPath id={id("front")}>
            <rect x={-W} y={planet.cy} width={W * 3} height={H * 2} />
          </clipPath>
        </defs>

        <rect width={W} height={H} fill={`url(#${id("bg")})`} />

        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={p.star} opacity={s.o} />
        ))}

        <polyline
          points={chart.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke={p.line}
          strokeWidth="0.8"
          opacity="0.45"
        />
        {chart.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2" fill={p.star} opacity="0.9" />
        ))}

        <g transform={`rotate(${tilt} ${planet.cx} ${planet.cy})`}>
          {orbits.map((o, i) => (
            <ellipse
              key={i}
              cx={planet.cx}
              cy={planet.cy}
              rx={o.rx}
              ry={o.ry}
              fill="none"
              stroke={p.line}
              strokeWidth="0.9"
              strokeDasharray={i % 2 ? "2 5" : undefined}
              opacity="0.4"
            />
          ))}

          <circle cx={planet.cx} cy={planet.cy} r={planet.r} fill={`url(#${id("planet")})`} />
          <g clipPath={`url(#${id("disc")})`}>
            {bands.map((b, i) => (
              <rect key={i} x={planet.cx - planet.r} y={b.y} width={planet.r * 2} height={b.h} fill={p.planet[1]} opacity={b.o} />
            ))}
          </g>

          {hasRing && (
            <ellipse
              cx={planet.cx}
              cy={planet.cy}
              rx={planet.r * 1.42}
              ry={planet.r * 0.26}
              fill="none"
              stroke={p.planet[0]}
              strokeWidth="5"
              opacity="0.55"
              clipPath={`url(#${id("front")})`}
            />
          )}

          {orbits.map((o, i) => (
            <circle
              key={i}
              cx={planet.cx + Math.cos(o.moon.a) * o.rx}
              cy={planet.cy + Math.sin(o.moon.a) * o.ry}
              r={o.moon.r}
              fill={p.planet[0]}
            />
          ))}
        </g>
      </svg>

      {children && <div className="absolute inset-0">{children(p.light)}</div>}
    </div>
  );
}
