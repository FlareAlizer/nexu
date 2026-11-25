// Плотный список строк для панелей препода и админа: рамка, hover, перенос на узком экране.
import type { HTMLAttributes, ReactNode } from "react";

export function RowList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="space-y-1.5">
      {children}
    </ul>
  );
}

export function Row({ className, ...rest }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-ctl border border-line bg-panel/90 px-3 py-2 transition-colors duration-150 hover:border-line hover:bg-raised/70 md:px-4 ${className ?? ""}`}
      {...rest}
    />
  );
}

/** Заголовок экрана: подпись раздела и название. */
export function PageTitle({ label, children }: { label: string; children: ReactNode }) {
  return (
    <header>
      <p className="hud-label text-holo">{label}</p>
      <h1 className="mt-2 break-words font-display text-[clamp(1.75rem,5vw,2.5rem)] font-extrabold leading-tight text-crawl">
        {children}
      </h1>
    </header>
  );
}
