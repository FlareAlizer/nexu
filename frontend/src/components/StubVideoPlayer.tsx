// Заглушка видео на время, пока не подключён Kinescope (нет аккаунта/загруженных роликов).
// Включается для блоков VIDEO с id вида "demo-*": имитирует таймлайн и шлёт те же
// события прогресса, что и настоящий плеер, — так QA прогоняет правило «видео ≥80%».
import { useEffect, useRef, useState } from "react";

import Button from "./ui/Button";
import Icon from "./ui/Icon";
import ProgressBar from "./ui/ProgressBar";

type Props = {
  videoId: string;
  title?: string;
  initialPositionS?: number;
  onProgress?: (pct: number, positionS: number) => void;
};

/** Условная длительность демо-ролика. */
const DURATION_S = 300;
const REPORT_EVERY_MS = 10_000;

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function StubVideoPlayer({ videoId, title, initialPositionS, onProgress }: Props) {
  const [positionS, setPositionS] = useState(Math.min(initialPositionS ?? 0, DURATION_S));
  const [playing, setPlaying] = useState(false);
  const maxSeenRef = useRef(Math.min(initialPositionS ?? 0, DURATION_S));
  const lastSentAtRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  /** Отправить прогресс наверх: не чаще раза в 10 с, force — на паузе и в конце. */
  const report = (pos: number, force = false) => {
    const now = Date.now();
    if (!force && now - lastSentAtRef.current < REPORT_EVERY_MS) return;
    lastSentAtRef.current = now;
    onProgressRef.current?.(Math.min(100, (maxSeenRef.current / DURATION_S) * 100), pos);
  };

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPositionS((prev) => {
        const next = Math.min(prev + 1, DURATION_S);
        if (next > maxSeenRef.current) maxSeenRef.current = next;
        if (next >= DURATION_S) {
          setPlaying(false);
          report(next, true);
        } else {
          report(next);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
    // report читает актуальные значения через ref
  }, [playing]);

  /** Перемотка (в т.ч. кнопками QA): просмотренным считаем всё до новой точки. */
  const seek = (to: number) => {
    const pos = Math.max(0, Math.min(to, DURATION_S));
    setPositionS(pos);
    if (pos > maxSeenRef.current) maxSeenRef.current = pos;
    report(pos, true);
  };

  const pct = Math.round((maxSeenRef.current / DURATION_S) * 100);

  return (
    <div className="flex aspect-video min-h-[20rem] w-full flex-col items-center justify-center gap-5 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(var(--c-holo)/0.12),transparent)] p-5 text-center md:p-8">
      <div>
        <p className="hud-label text-warn">Демо-видео (заглушка)</p>
        <p className="mt-2 font-display text-lg font-semibold">{title ?? videoId}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
          Kinescope ещё не подключён — плеер имитирует просмотр, чтобы проверить прогресс и
          завершение урока
        </p>
      </div>

      <div className="w-full max-w-md">
        <ProgressBar value={(positionS / DURATION_S) * 100} tone="crawl" label="Позиция в демо-видео" />
        <div className="mt-2 flex justify-between text-sm text-ink-soft">
          <span>
            {mmss(positionS)} / {mmss(DURATION_S)}
          </span>
          <span>просмотрено {pct}%</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            const next = !playing;
            setPlaying(next);
            if (!next) report(positionS, true);
          }}
        >
          <Icon name={playing ? "pause" : "play"} size={18} />
          {playing ? "Пауза" : "Смотреть"}
        </Button>
        <Button variant="ghost" onClick={() => seek(DURATION_S * 0.8)}>
          Промотать к 80%
        </Button>
        <Button variant="ghost" onClick={() => seek(DURATION_S)}>
          В конец
        </Button>
      </div>
    </div>
  );
}
