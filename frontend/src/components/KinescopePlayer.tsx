// Плеер Kinescope (COURSE-01/02): iframe player JS API — трекинг % просмотра,
// восстановление позиции. Прогресс шлём наверх с троттлингом ~10 с и на паузе/финале.
// ВНИМАНИЕ: сверить имена событий с docs.kinescope.io при первом реальном видео;
// при недоступности API — фолбэк на обычный embed-iframe без трекинга.
import { useEffect, useRef } from "react";

import StubVideoPlayer from "./StubVideoPlayer";

// Пока Kinescope не подключён, уроки заводятся с id вида "demo-*" → показываем заглушку
const STUB_PREFIX = "demo-";

type Props = {
  videoId: string;
  title?: string;
  initialPositionS?: number;
  onProgress?: (pct: number, positionS: number) => void;
};

// Минимальный контракт iframe player API (полный тип у Kinescope не публикуется)
interface KinescopePlayerApi {
  on(event: string, cb: (ev: { data?: { currentTime?: number; duration?: number } }) => void): void;
  seekTo?(t: number): void;
  destroy?(): void;
  Events?: Record<string, string>;
}

declare global {
  interface Window {
    Kinescope?: {
      IframePlayer: {
        create(el: HTMLElement | string, opts: unknown): Promise<KinescopePlayerApi>;
      };
    };
  }
}

let scriptPromise: Promise<boolean> | null = null;

/** Однократная загрузка iframe.player.js; false = не загрузился (работаем без трекинга). */
function loadPlayerScript(): Promise<boolean> {
  scriptPromise ??= new Promise((resolve) => {
    if (window.Kinescope?.IframePlayer) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://player.kinescope.io/latest/iframe.player.js";
    s.async = true;
    s.onload = () => resolve(Boolean(window.Kinescope?.IframePlayer));
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return scriptPromise;
}

const REPORT_EVERY_MS = 10_000;

export default function KinescopePlayer({ videoId, title, initialPositionS, onProgress }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Живые значения для колбэков плеера без пересоздания подписок
  const stateRef = useRef({ maxSeen: 0, duration: 0, lastSentAt: 0, fallback: false });
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const titleRef = useRef(title);
  titleRef.current = title;
  // Начальную позицию фиксируем один раз (первый рендер): рефетч урока после
  // обновления прогресса не должен пересоздавать плеер и перематывать назад
  const initialPositionRef = useRef(initialPositionS);

  const isStub = videoId.startsWith(STUB_PREFIX);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isStub) return;
    let player: KinescopePlayerApi | null = null;
    let cancelled = false;

    const report = (positionS: number, force = false) => {
      const st = stateRef.current;
      const now = Date.now();
      if (!force && now - st.lastSentAt < REPORT_EVERY_MS) return;
      if (!st.duration) return;
      st.lastSentAt = now;
      const pct = Math.min(100, (st.maxSeen / st.duration) * 100);
      onProgressRef.current?.(pct, positionS);
    };

    void loadPlayerScript().then((ok) => {
      if (cancelled) return;
      if (!ok || !window.Kinescope) {
        // Фолбэк: обычный embed без трекинга (graceful degradation, п.4.4)
        stateRef.current.fallback = true;
        el.innerHTML = "";
        const iframe = document.createElement("iframe");
        iframe.src = `https://kinescope.io/embed/${videoId}`;
        iframe.title = titleRef.current ?? "Видео";
        iframe.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
        iframe.className = "w-full aspect-video border-0";
        el.appendChild(iframe);
        return;
      }
      void window.Kinescope.IframePlayer.create(el, {
        url: `https://kinescope.io/${videoId}`,
        size: { width: "100%", height: "auto" },
      }).then((p) => {
        if (cancelled) {
          p.destroy?.();
          return;
        }
        player = p;
        const startAt = initialPositionRef.current;
        if (startAt && startAt > 3) p.seekTo?.(startAt);
        const ev = p.Events ?? {};
        p.on(ev.TimeUpdate ?? "timeupdate", ({ data }) => {
          const st = stateRef.current;
          const t = data?.currentTime ?? 0;
          if (data?.duration) st.duration = data.duration;
          if (t > st.maxSeen) st.maxSeen = t;
          report(t);
        });
        p.on(ev.Pause ?? "pause", ({ data }) => report(data?.currentTime ?? stateRef.current.maxSeen, true));
        p.on(ev.Ended ?? "ended", () => {
          stateRef.current.maxSeen = stateRef.current.duration || stateRef.current.maxSeen;
          report(stateRef.current.maxSeen, true);
        });
      });
    });

    return () => {
      cancelled = true;
      player?.destroy?.();
    };
    // Только videoId (isStub из него же выведен): title и позиция читаются через ref,
    // чтобы рефетч урока не пересоздавал плеер и не перематывал видео посреди просмотра
  }, [videoId, isStub]);

  if (isStub) {
    return (
      <StubVideoPlayer
        videoId={videoId}
        title={title}
        initialPositionS={initialPositionS}
        onProgress={onProgress}
      />
    );
  }

  return <div ref={containerRef} className="w-full aspect-video" />;
}
