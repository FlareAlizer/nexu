// Состояние сессии: access-токен в памяти, восстановление через refresh-cookie при загрузке.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { api, setAccessToken, tryRefresh } from "../api/client";
import type { AuthResponse, AuthUser } from "../api/client";

interface AuthState {
  user: AuthUser | null;
  ready: boolean; // false, пока не попробовали восстановить сессию
  loginTelegram: (widgetData: Record<string, unknown>) => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Восстановление сессии при открытии вкладки (AUTH-04: refresh 30 дней)
  useEffect(() => {
    tryRefresh()
      .then((data) => setUser(data?.user ?? null))
      .finally(() => setReady(true));
  }, []);

  const applyAuth = useCallback((data: AuthResponse) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const loginTelegram = useCallback(
    async (widgetData: Record<string, unknown>) => {
      applyAuth(
        await api<AuthResponse>("/auth/telegram", {
          method: "POST",
          body: JSON.stringify(widgetData),
        }),
      );
    },
    [applyAuth],
  );

  const loginEmail = useCallback(
    async (email: string, password: string) => {
      applyAuth(
        await api<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }),
      );
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, loginTelegram, loginEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth вне <AuthProvider>");
  return ctx;
}
