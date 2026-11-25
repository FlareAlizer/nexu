// Общий каркас: guard авторизации (AUTH-03) + шапка с разделами по роли и XP.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { getMe } from "../api/me";
import { useAuth } from "../auth/AuthContext";
import { rankOf } from "../lib/rank";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { Loader } from "./ui/States";
import TopBar from "./ui/TopBar";
import type { NavItem } from "./ui/TopBar";

export default function Layout() {
  const { user, ready, logout } = useAuth();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe, enabled: Boolean(user) });
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Появление экрана при смене маршрута. Анимируем сам <main>, а не перемонтируем его:
  // переход между уроками не должен сбрасывать состояние страницы.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    mainRef.current?.animate(
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 320, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
    );
  }, [pathname]);

  if (!ready) return <Loader full />;
  if (!user) return <Navigate to="/login" replace />;

  const nav: NavItem[] = [{ to: "/", label: "Кабинет" }];
  if (user.role === "TEACHER" || user.role === "ADMIN") nav.push({ to: "/teacher", label: "Проверка" });
  if (user.role === "ADMIN") nav.push({ to: "/admin", label: "Админка" });

  return (
    <div className="min-h-screen">
      <TopBar nav={nav}>
        {me && user.role === "STUDENT" && (
          <span
            className="flex items-center gap-1.5 rounded-full border border-crawl/40 bg-crawl/[0.08] px-3 py-1 text-sm text-crawl"
            title={`Ранг: ${rankOf(me.xp).title}`}
          >
            <Icon name="bolt" size={16} />
            <span className="font-display font-semibold tracking-wide">{me.xp} XP</span>
            <span className="hidden border-l border-crawl/30 pl-2 text-ink-soft md:inline">{rankOf(me.xp).title}</span>
          </span>
        )}
        <span className="hidden max-w-[14rem] truncate text-ink-soft md:inline">{user.name}</span>
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          Выйти
        </Button>
      </TopBar>
      <main ref={mainRef} className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 md:px-6 md:pt-10">
        <Outlet />
      </main>
    </div>
  );
}
