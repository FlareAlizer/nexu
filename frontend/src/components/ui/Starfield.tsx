// Звёздное небо на весь экран под интерфейсом: canvas, три слоя глубины, медленный дрейф.
// Дёшево для телефона: до 140 звёзд, ~30 кадров/с, остановка на скрытой вкладке.
// При prefers-reduced-motion рисуется один неподвижный кадр.
import { useEffect, useRef } from "react";

import { seededRandom } from "../../lib/seed";

interface Star {
  x: number; // 0–1 по ширине
  y: number; // 0–1 по высоте
  z: number; // глубина 0.15–1: чем больше, тем ближе, ярче и быстрее
  tint: string; // "r g b"
  phase: number; // сдвиг мерцания
}

const TINTS = ["214 226 245", "214 226 245", "214 226 245", "168 208 236", "240 222 176"];
const FRAME_MS = 33;
const WARP_MS = 520;

// Время последнего запуска «гиперпрыжка»; читается циклом отрисовки
let warpStartedAt = -Infinity;

/** Короткая вспышка полос от центра — при переходе между экранами. */
export function triggerWarp(): void {
  warpStartedAt = performance.now();
}

function makeStars(count: number): Star[] {
  const rnd = seededRandom(20260901);
  return Array.from({ length: count }, () => ({
    x: rnd(),
    y: rnd(),
    z: 0.15 + rnd() ** 2 * 0.85,
    tint: TINTS[Math.floor(rnd() * TINTS.length)],
    phase: rnd() * Math.PI * 2,
  }));
}

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let raf = 0;
    let last = 0;
    let drift = 0; // накопленный сдвиг дрейфа, px
    // сдвиг от указателя: текущий и целевой
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(Math.min(Math.round((w * h) / 4200), w < 768 ? 140 : 380));
      draw(performance.now());
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      const warp = reduce.matches ? 0 : Math.max(0, 1 - (now - warpStartedAt) / WARP_MS);
      const scrollY = window.scrollY;
      const cx = w / 2;
      const cy = h / 2;

      for (const s of stars) {
        // дрейф влево-вниз, параллакс от прокрутки и указателя; координаты зациклены
        let x = (s.x * w - drift * s.z + pointer.x * s.z) % w;
        let y = (s.y * h + drift * 0.35 * s.z - scrollY * 0.06 * s.z + pointer.y * s.z) % h;
        if (x < 0) x += w;
        if (y < 0) y += h;

        const twinkle = reduce.matches ? 1 : 0.82 + 0.18 * Math.sin(now / 1400 + s.phase);
        const alpha = (0.22 + s.z * 0.6) * twinkle;
        const r = 0.45 + s.z * 0.95;

        if (warp > 0.02) {
          const dx = x - cx;
          const dy = y - cy;
          const k = warp * warp * 0.16 * s.z;
          ctx.strokeStyle = `rgb(${s.tint} / ${alpha * 0.9})`;
          ctx.lineWidth = r;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + dx * k, y + dy * k);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgb(${s.tint} / ${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = now - last;
      if (dt < FRAME_MS) return;
      last = now;
      drift += Math.min(dt, 100) * 0.0045;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      draw(now);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce.matches || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return; // на тач-экранах параллакс от пальца мешает
      pointer.tx = (0.5 - e.clientX / w) * 26;
      pointer.ty = (0.5 - e.clientY / h) * 26;
    };
    const onScroll = () => {
      if (reduce.matches) draw(performance.now());
    };
    const onMotionPref = () => {
      draw(performance.now());
      start();
    };

    resize();
    start();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", start);
    reduce.addEventListener("change", onMotionPref);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", start);
      reduce.removeEventListener("change", onMotionPref);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
