// Auth-флоу AUTH-01..04: telegram-вход, email-вход, refresh, requireAuth. Prisma замокана.
import { createHash, createHmac } from "node:crypto";
import bcrypt from "bcrypt";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/db.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { createApp } from "../src/app.js";
import { prisma } from "../src/db.js";
import { requireAuth, requireRole } from "../src/middleware/auth.js";
import { signAccessToken, signRefreshToken } from "../src/services/tokens.js";

const mocked = vi.mocked(prisma, true);

const BOT_TOKEN = "123456:test_bot_token";

function signAsTelegram(fields: Record<string, string>): Record<string, string> {
  const checkString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  return { ...fields, hash };
}

const student = {
  id: 1,
  telegramId: 42n,
  tgUsername: "vasya",
  email: null,
  passwordHash: null,
  name: "Вася",
  role: "STUDENT" as const,
  isBlocked: false,
  notifyMuted: false,
  lastSeenAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  mocked.user.findUnique.mockReset();
  mocked.user.upsert.mockReset();
});

describe("POST /api/auth/telegram", () => {
  it("вход с валидной подписью: токен + refresh-cookie + user", async () => {
    mocked.user.upsert.mockResolvedValue(student);
    const payload = signAsTelegram({
      id: "42",
      first_name: "Вася",
      username: "vasya",
      auth_date: String(Math.floor(Date.now() / 1000)),
    });

    const res = await request(createApp()).post("/api/auth/telegram").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user).toEqual({ id: 1, name: "Вася", role: "STUDENT" });
    const cookies = res.get("set-cookie") ?? [];
    expect(cookies.join(";")).toContain("refresh_token=");
    expect(cookies.join(";")).toContain("HttpOnly");
    expect(cookies.join(";")).toContain("SameSite=Strict");
  });

  it("подделанная подпись → 401, юзер не создаётся", async () => {
    const payload = {
      ...signAsTelegram({ id: "42", auth_date: String(Math.floor(Date.now() / 1000)) }),
      id: "999",
    };
    const res = await request(createApp()).post("/api/auth/telegram").send(payload);
    expect(res.status).toBe(401);
    expect(mocked.user.upsert).not.toHaveBeenCalled();
  });

  it("заблокированный пользователь → 403", async () => {
    mocked.user.upsert.mockResolvedValue({ ...student, isBlocked: true });
    const payload = signAsTelegram({ id: "42", auth_date: String(Math.floor(Date.now() / 1000)) });
    const res = await request(createApp()).post("/api/auth/telegram").send(payload);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/login (email, резерв AUTH-02)", () => {
  // cost 4 в тесте — скорость; в проде хэши создаются с cost 12 (ADMIN-04)
  const passwordHash = bcrypt.hashSync("secret123", 4);
  const emailUser = { ...student, id: 2, email: "vasya@example.com", passwordHash };

  it("верные email+пароль → 200", async () => {
    mocked.user.findUnique.mockResolvedValue(emailUser);
    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "vasya@example.com", password: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("неверный пароль → 401", async () => {
    mocked.user.findUnique.mockResolvedValue(emailUser);
    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "vasya@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  it("неизвестный email → 401 (не раскрываем наличие)", async () => {
    mocked.user.findUnique.mockResolvedValue(null);
    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "nope@example.com", password: "secret123" });
    expect(res.status).toBe(401);
  });

  it("невалидное тело → 400", async () => {
    const res = await request(createApp()).post("/api/auth/login").send({ email: "не email" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/refresh", () => {
  it("валидный refresh-cookie → новая пара токенов", async () => {
    mocked.user.findUnique.mockResolvedValue(student);
    const res = await request(createApp())
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${signRefreshToken(1)}`);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("без cookie → 401; access-токен вместо refresh → 401", async () => {
    const app = createApp();
    expect((await request(app).post("/api/auth/refresh")).status).toBe(401);
    const wrongType = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${signAccessToken(1, "STUDENT")}`);
    expect(wrongType.status).toBe(401);
  });

  it("заблокированный → 403", async () => {
    mocked.user.findUnique.mockResolvedValue({ ...student, isBlocked: true });
    const res = await request(createApp())
      .post("/api/auth/refresh")
      .set("Cookie", `refresh_token=${signRefreshToken(1)}`);
    expect(res.status).toBe(403);
  });
});

describe("requireAuth / requireRole (AUTH-03)", () => {
  function protectedApp() {
    const app = express();
    app.get("/p", requireAuth, (req, res) => res.json({ userId: req.user!.id }));
    app.get("/admin", requireAuth, requireRole("ADMIN"), (_req, res) => res.json({ ok: true }));
    return app;
  }

  it("валидный access-токен → пускает и кладёт req.user", async () => {
    mocked.user.findUnique.mockResolvedValue({ id: 1, role: "STUDENT", isBlocked: false });
    const res = await request(protectedApp())
      .get("/p")
      .set("Authorization", `Bearer ${signAccessToken(1, "STUDENT")}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(1);
  });

  it("без токена / мусор / refresh вместо access → 401", async () => {
    const app = protectedApp();
    expect((await request(app).get("/p")).status).toBe(401);
    expect((await request(app).get("/p").set("Authorization", "Bearer not.a.jwt")).status).toBe(401);
    expect(
      (await request(app).get("/p").set("Authorization", `Bearer ${signRefreshToken(1)}`)).status,
    ).toBe(401);
  });

  it("заблокированный или удалённый → 403", async () => {
    mocked.user.findUnique.mockResolvedValue({ id: 1, role: "STUDENT", isBlocked: true });
    const app = protectedApp();
    const res = await request(app).get("/p").set("Authorization", `Bearer ${signAccessToken(1, "STUDENT")}`);
    expect(res.status).toBe(403);
  });

  it("STUDENT на админский роут → 403, ADMIN → 200", async () => {
    const app = protectedApp();
    mocked.user.findUnique.mockResolvedValue({ id: 1, role: "STUDENT", isBlocked: false });
    const asStudent = await request(app)
      .get("/admin")
      .set("Authorization", `Bearer ${signAccessToken(1, "STUDENT")}`);
    expect(asStudent.status).toBe(403);

    mocked.user.findUnique.mockResolvedValue({ id: 7, role: "ADMIN", isBlocked: false });
    const asAdmin = await request(app)
      .get("/admin")
      .set("Authorization", `Bearer ${signAccessToken(7, "ADMIN")}`);
    expect(asAdmin.status).toBe(200);
  });
});
