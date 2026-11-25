// Верхняя панель: слева знак и название школы, по центру разделы, справа — что передал экран.
import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

export interface NavItem {
  to: string;
  label: string;
}

/** Знак школы: орбита вокруг четырёхлучевой звезды. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" width={size} height={size} fill="none" className="shrink-0">
      <ellipse cx="16" cy="16" rx="14" ry="6" transform="rotate(-28 16 16)" stroke="rgb(var(--c-holo))" strokeWidth="1.4" />
      <path d="M16 5.5 18.3 13.7 26.5 16 18.3 18.3 16 26.5 13.7 18.3 5.5 16 13.7 13.7Z" fill="rgb(var(--c-crawl))" />
      <circle cx="27.6" cy="9.8" r="1.6" fill="rgb(var(--c-holo))" />
    </svg>
  );
}

function navClass({ isActive }: { isActive: boolean }): string {
  return `relative flex min-h-[44px] shrink-0 items-center px-3 font-display text-[0.9375rem] tracking-wide transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:rounded-full after:transition-colors ${
    isActive ? "text-ink after:bg-holo after:shadow-saber" : "text-ink-mute hover:text-ink after:bg-transparent"
  }`;
}

export default function TopBar({ nav = [], children }: { nav?: NavItem[]; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-space/90 md:bg-space/75 md:backdrop-blur-md">
      <div className="mx-auto flex min-h-[60px] max-w-[1200px] items-center gap-3 px-4 md:gap-6 md:px-6">
        <Link to="/" className="flex min-h-[44px] items-center gap-2.5 rounded-ctl" aria-label="NEXU — на главную">
          <Logo />
          <span className="font-display text-xl font-bold tracking-[0.18em] text-ink">NEXU</span>
          <span className="hidden border-l border-line pl-3 text-sm text-ink-mute md:inline">олимпиадная школа</span>
        </Link>

        {nav.length > 1 && (
          <nav aria-label="Разделы" className="hidden md:flex">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2 md:gap-4">{children}</div>
      </div>

      {/* На телефоне разделы уходят второй строкой */}
      {nav.length > 1 && (
        <nav aria-label="Разделы" className="flex overflow-x-auto border-t border-line/60 px-1 md:hidden">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={navClass}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
