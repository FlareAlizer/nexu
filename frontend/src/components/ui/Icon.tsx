// Набор линейных иконок 24×24. Декоративные: текст рядом несёт смысл, поэтому aria-hidden.
import type { ReactNode } from "react";

const PATHS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  "arrow-right": <path d="M4 12h15m-6-6 6 6-6 6" />,
  "arrow-left": <path d="M20 12H5m6-6-6 6 6 6" />,
  "arrow-up": <path d="M12 20V5m-6 6 6-6 6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  cross: <path d="m6 6 12 12M18 6 6 18" />,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="1.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  bolt: <path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6l1-8Z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  redo: <><path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" /><path d="M19.5 4v4.5H15" /></>,
  task: <><path d="M6 3.5h9l4 4V20.5H6z" /><path d="M14.5 3.5v4.5H19M9 12.5h7M9 16h5" /></>,
  test: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="m8 12.5 3 3 5.5-6.5" /></>,
  file: <path d="M19 11.5 12 18.6a4.2 4.2 0 0 1-6-6l7.6-7.6a2.8 2.8 0 0 1 4 4L10 16.6a1.4 1.4 0 0 1-2-2l6.5-6.5" />,
  hint: <><path d="M9 17.5h6M10 20.5h4" /><path d="M8.5 14.5a6 6 0 1 1 7 0c-.6.5-1 1.2-1 2h-5c0-.8-.4-1.5-1-2Z" /></>,
  send: <path d="M3.5 11 20.5 4l-6 16.5-3-7.5-8-2Zm8 2 4-4" />,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  pause: <path d="M8 5.5v13m8-13v13" />,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 19.5c.6-3.3 3.2-5 6.5-5s5.9 1.7 6.5 5M16 5.5a3.5 3.5 0 0 1 0 6.5M18.5 14.8c1.7.7 2.7 2.2 3 4.7" /></>,
  planet: <><circle cx="12" cy="12" r="5.5" /><path d="M4 16.5c-2.5 2-1.5 3.5 2 2.5 3.2-.9 7.5-3.3 11-6.3 3.8-3.2 5.5-6 3-6.2" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export default function Icon({
  name,
  size = 20,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ""}`}
    >
      {PATHS[name]}
    </svg>
  );
}
