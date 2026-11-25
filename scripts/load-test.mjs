// Нагрузочный тест (п.8.2 ТЗ; цель — 500 одновременных пользователей, решение от 12.07).
// Без зависимостей: node scripts/load-test.mjs
//
// Перед запуском:
//   1) наполнить БД:   cd backend && SEED_STUDENTS=500 npm run seed
//   2) поднять API с ослабленными лимитами — 500 VU идут с одного IP:
//      RATE_LIMIT_PER_MIN=100000 LOGIN_RATE_LIMIT_PER_MIN=100000 npm start
//
// Параметры (env): BASE_URL, VUS, DURATION_S, RAMP_S, STUDENTS, SEED_PASSWORD, P95_BUDGET_MS.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8000";
const VUS = Number(process.env.VUS ?? 500);
const DURATION_S = Number(process.env.DURATION_S ?? 60);
const RAMP_S = Number(process.env.RAMP_S ?? 15);
const STUDENTS = Number(process.env.STUDENTS ?? VUS);
const PASSWORD = process.env.SEED_PASSWORD ?? "demo-nexu-2026";
// Бюджет ответа API из п.4.1 ТЗ
const P95_BUDGET_MS = Number(process.env.P95_BUDGET_MS ?? 300);
const ERROR_BUDGET = Number(process.env.ERROR_BUDGET ?? 0.01);

/** @type {Map<string, {lat: number[], count: number, errors: number, statuses: Map<number, number>}>} */
const metrics = new Map();

function track(name, ms, status, failed) {
  let m = metrics.get(name);
  if (!m) {
    m = { lat: [], count: 0, errors: 0, statuses: new Map() };
    metrics.set(name, m);
  }
  m.lat.push(ms);
  m.count++;
  if (failed) m.errors++;
  if (status) m.statuses.set(status, (m.statuses.get(status) ?? 0) + 1);
}

/** Запрос с замером времени. Возвращает {status, body} либо null при сетевой ошибке. */
async function call(name, path, { method = "GET", token, body } = {}) {
  const started = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    track(name, performance.now() - started, res.status, !res.ok);
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // не-JSON ответ (например, HTML ошибки прокси) — тело не нужно
    }
    return { status: res.status, body: parsed };
  } catch {
    track(name, performance.now() - started, 0, true); // сеть недоступна / соединение оборвано
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(index) {
  const email = `student${(index % STUDENTS) + 1}@nexu.local`;
  const res = await call("POST /auth/login", "/api/auth/login", {
    method: "POST",
    body: { email, password: PASSWORD },
  });
  return res?.body?.accessToken ?? null;
}

/** Найти доступный ученику урок — по нему и будем бить. */
async function discoverLessonId(token) {
  const res = await call("GET /courses/my", "/api/courses/my", { token });
  const courses = res?.body;
  if (!Array.isArray(courses) || courses.length === 0) return null;
  for (const course of courses) {
    for (const module of course.modules ?? []) {
      for (const lesson of module.lessons ?? []) {
        if (lesson.status !== "locked") return lesson.id; // completed | available
      }
    }
  }
  return courses[0]?.modules?.[0]?.lessons?.[0]?.id ?? null;
}

/** Один виртуальный пользователь: типичный вечерний сценарий ученика. */
async function virtualUser(index, deadline) {
  await sleep((RAMP_S * 1000 * index) / VUS); // плавный разгон, а не 500 логинов в одну секунду
  const token = await login(index);
  if (!token) return;
  let lessonId = null;
  let pct = 0;

  while (performance.now() < deadline) {
    await call("GET /me", "/api/me", { token });
    lessonId ??= await discoverLessonId(token);
    if (lessonId) {
      await call("GET /lessons/:id", `/api/lessons/${lessonId}`, { token });
      pct = Math.min(100, pct + 5);
      await call("POST /lessons/:id/video-progress", `/api/lessons/${lessonId}/video-progress`, {
        method: "POST",
        token,
        body: { pct, positionS: Math.round((pct / 100) * 300) },
      });
    } else {
      await call("GET /courses/my", "/api/courses/my", { token });
    }
    // Плеер шлёт прогресс раз в 10 с; пауза с разбросом, чтобы запросы не били в такт
    await sleep(2000 + Math.random() * 2000);
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[i];
}

function report() {
  console.log(`\nНагрузочный тест: ${VUS} пользователей, ${DURATION_S} c, ${BASE_URL}\n`);
  console.log(
    "эндпоинт".padEnd(34) +
      "запросов".padStart(9) +
      "ошибок".padStart(8) +
      "p50".padStart(8) +
      "p95".padStart(8) +
      "p99".padStart(8),
  );

  let total = 0;
  let totalErrors = 0;
  let worstP95 = 0;
  let rateLimited = 0;

  for (const [name, m] of metrics) {
    const sorted = [...m.lat].sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);
    total += m.count;
    totalErrors += m.errors;
    worstP95 = Math.max(worstP95, p95);
    rateLimited += m.statuses.get(429) ?? 0;
    console.log(
      name.padEnd(34) +
        String(m.count).padStart(9) +
        String(m.errors).padStart(8) +
        `${percentile(sorted, 50).toFixed(0)}мс`.padStart(8) +
        `${p95.toFixed(0)}мс`.padStart(8) +
        `${percentile(sorted, 99).toFixed(0)}мс`.padStart(8),
    );
  }

  const errorRate = total ? totalErrors / total : 1;
  console.log(
    `\nВсего запросов: ${total}, RPS: ${(total / DURATION_S).toFixed(1)}, ` +
      `ошибок: ${(errorRate * 100).toFixed(2)}%`,
  );
  if (rateLimited > 0) {
    console.log(
      `\nВнимание: ${rateLimited} ответов 429 — сработал rate limit. Тест с одного IP; ` +
        "поднимите RATE_LIMIT_PER_MIN и LOGIN_RATE_LIMIT_PER_MIN на время теста.",
    );
  }

  const okLatency = worstP95 <= P95_BUDGET_MS;
  const okErrors = errorRate <= ERROR_BUDGET;
  console.log(
    `\nПорог p95 ≤ ${P95_BUDGET_MS} мс (п.4.1): ${okLatency ? "ок" : `не пройден (${worstP95.toFixed(0)} мс)`}`,
  );
  console.log(
    `Порог ошибок ≤ ${(ERROR_BUDGET * 100).toFixed(0)}%: ${okErrors ? "ок" : "не пройден"}`,
  );
  return okLatency && okErrors;
}

async function main() {
  const health = await fetch(`${BASE_URL}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`API недоступен на ${BASE_URL} — сначала запустите бэкенд.`);
    process.exit(1);
  }
  metrics.clear(); // health в статистику не идёт

  const deadline = performance.now() + (RAMP_S + DURATION_S) * 1000;
  const users = [];
  for (let i = 0; i < VUS; i++) users.push(virtualUser(i, deadline));
  await Promise.all(users);

  process.exit(report() ? 0 : 1);
}

void main();
