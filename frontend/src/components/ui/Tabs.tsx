// Вкладки с клавиатурой: стрелки влево/вправо, Home, End (паттерн WAI-ARIA tabs).
import { useId, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Счётчик рядом с названием, например длина очереди. */
  count?: number;
}

export default function Tabs<T extends string>({
  items,
  active,
  onChange,
  label,
  children,
}: {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  /** Что переключают вкладки — для скринридера. */
  label: string;
  /** Содержимое активной вкладки. */
  children: ReactNode;
}) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: KeyboardEvent) {
    const i = items.findIndex((t) => t.id === active);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    onChange(items[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }

  return (
    <div>
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0"
      >
        {items.map((t) => {
          const selected = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={`relative -mb-px flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3 font-display text-[0.9375rem] tracking-wide transition-colors duration-150 md:px-4 ${
                selected
                  ? "border-holo text-ink"
                  : "border-transparent text-ink-mute hover:border-line hover:text-ink-soft"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={`rounded-full px-2 text-sm ${selected ? "bg-holo/15 text-holo" : "bg-raised text-ink-mute"}`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`} className="pt-5">
        {children}
      </div>
    </div>
  );
}
