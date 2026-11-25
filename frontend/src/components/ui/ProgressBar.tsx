// Полоса прогресса в виде клинка: тёмная дорожка, светящаяся заливка.
// Используется для прогресса курса, теста, видео и XP.

type Tone = "holo" | "good" | "crawl";

const FILL: Record<Tone, string> = {
  holo: "bg-holo [--saber:rgb(var(--c-holo)/0.7)]",
  good: "bg-good [--saber:rgb(var(--c-good)/0.7)]",
  crawl: "bg-crawl [--saber:rgb(var(--c-crawl)/0.6)]",
};

export default function ProgressBar({
  value,
  label,
  tone = "holo",
  size = "md",
  className,
}: {
  /** 0–100 */
  value: number;
  /** Что измеряет полоса — для скринридера. */
  label: string;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`relative w-full rounded-full bg-raised ring-1 ring-inset ring-line/70 ${size === "sm" ? "h-1.5" : "h-2.5"} ${className ?? ""}`}
    >
      <div
        className={`h-full rounded-full shadow-saber transition-[width] duration-500 ease-out ${FILL[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
