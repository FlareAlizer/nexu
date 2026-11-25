// Состояния экрана: загрузка, пусто, ошибка.
import type { ReactNode } from "react";

import Icon from "./Icon";
import type { IconName } from "./Icon";

/** Индикатор загрузки: точка на орбите и подпись. */
export function Loader({ label = "Загрузка…", full }: { label?: string; full?: boolean }) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-ink-soft ${full ? "min-h-screen" : "py-10"}`}
    >
      <span className="relative block h-6 w-6 rounded-full border border-line">
        <span className="absolute inset-0 animate-orbit">
          <span className="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-holo shadow-saber" />
        </span>
      </span>
      {label}
    </div>
  );
}

/** Пустой список или раздел без данных. */
export function EmptyState({
  icon = "planet",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-ctl border border-dashed border-line px-4 py-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-raised/60 text-ink-mute">
        <Icon name={icon} size={24} />
      </span>
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="max-w-md text-ink-soft">{children}</p>}
      {action}
    </div>
  );
}

/** Сообщение об ошибке внутри экрана. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-ctl border border-bad/40 bg-bad/[0.1] px-3 py-2 text-bad">
      {children}
    </p>
  );
}
