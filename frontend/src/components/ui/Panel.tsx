// Панель интерфейса: срезанные углы, тонкая рамка. Тон меняет цвет рамки (стили .hud в index.css).
import { forwardRef } from "react";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

type Tone = "default" | "holo" | "warn" | "good" | "bad";

const TONE: Record<Tone, string> = {
  default: "",
  holo: "hud-holo",
  warn: "hud-warn",
  good: "hud-good",
  bad: "hud-bad",
};

const PAD = { none: "", sm: "p-3", md: "p-4 md:p-5", lg: "p-5 md:p-7" };

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: Tone;
  pad?: keyof typeof PAD;
  children: ReactNode;
}

const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  { as: Tag = "div", tone = "default", pad = "md", className, ...rest },
  ref,
) {
  return <Tag ref={ref} className={`hud ${TONE[tone]} ${PAD[pad]} ${className ?? ""}`} {...rest} />;
});

export default Panel;

/** Заголовок раздела и необязательный блок справа (счётчик, кнопка, поиск). */
export function SectionTitle({
  children,
  aside,
  as: Tag = "h2",
}: {
  children: ReactNode;
  aside?: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <Tag className="font-display text-lg font-semibold tracking-wide text-ink">{children}</Tag>
      {aside}
    </div>
  );
}
