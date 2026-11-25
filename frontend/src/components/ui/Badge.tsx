// Бейдж статуса и чип-подпись.
import type { ReactNode } from "react";

import type { SubmissionStatus } from "../../api/tasks";
import { STATUS_LABEL } from "../../api/tasks";

export type BadgeTone = "neutral" | "holo" | "good" | "bad" | "warn" | "crawl";

const TONE: Record<BadgeTone, string> = {
  neutral: "border-line bg-raised/70 text-ink-soft",
  holo: "border-holo/35 bg-holo/[0.12] text-holo",
  good: "border-good/35 bg-good/[0.12] text-good",
  bad: "border-bad/40 bg-bad/[0.12] text-bad",
  warn: "border-warn/40 bg-warn/[0.12] text-warn",
  crawl: "border-crawl/40 bg-crawl/[0.1] text-crawl",
};

export default function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm ${TONE[tone]} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<SubmissionStatus, BadgeTone> = {
  PENDING: "warn",
  ACCEPTED: "good",
  NEEDS_REVISION: "bad",
};

/** Статус сдачи задания (п.3.4). */
export function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
