// M5: парсер команд бота и защита вебхука secret_token.
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { parseBotCommand, templates } from "../src/services/telegram.js";

describe("parseBotCommand", () => {
  it.each([
    ["/start", "start"],
    ["/mute", "mute"],
    ["/unmute", "unmute"],
    ["/mute@nexuu_school_bot", "mute"],
    ["  /start hello", "start"],
  ])("%s → %s", (text, cmd) => {
    expect(parseBotCommand(text)).toBe(cmd);
  });

  it.each(["привет", "/stop", "/muted", "", undefined])("не команда: %s", (text) => {
    expect(parseBotCommand(text as string | undefined)).toBeNull();
  });
});

describe("вебхук бота", () => {
  it("без секрета в конфиге/заголовке → 403", async () => {
    const res = await request(createApp())
      .post("/api/telegram/webhook")
      .send({ message: { chat: { id: 1 }, from: { id: 1 }, text: "/mute" } });
    expect(res.status).toBe(403);
  });

  it("рассылка без токена авторизации → 401", async () => {
    const res = await request(createApp()).post("/api/admin/cohorts/1/broadcast").send({ text: "hi" });
    expect(res.status).toBe(401);
  });
});

describe("шаблоны уведомлений (п.3.7)", () => {
  it("NOTIF-01 содержит урок, статус и ссылку", () => {
    const t = templates.taskReviewed("Урок 1", "Принято ✅", "https://x/tasks/5");
    expect(t).toContain("Урок 1");
    expect(t).toContain("Принято");
    expect(t).toContain("https://x/tasks/5");
  });
});
