// Клиент API: fetch + JWT (access в памяти, refresh в httpOnly cookie).
// При 401 — одна попытка обновить access через /auth/refresh и повторить запрос.

export interface AuthUser {
  id: number;
  name: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  // FormData (загрузка файла) — Content-Type ставит браузер (boundary)
  const isFormData = init?.body instanceof FormData;
  return fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
    credentials: "include", // refresh token в httpOnly cookie
  });
}

// Single-flight: параллельные 401 не должны дёргать /refresh наперегонки
let refreshing: Promise<AuthResponse | null> | null = null;

/** Обновить access-токен по refresh-cookie. Вернёт данные сессии или null. */
export async function tryRefresh(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) return null;
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return data;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await rawFetch(path, init);
  if (res.status === 401 && (await tryRefresh())) {
    res = await rawFetch(path, init);
  }
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}
