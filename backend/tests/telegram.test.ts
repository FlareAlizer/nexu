// Проверка подписи Telegram Login Widget (AUTH-01)
import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyTelegramLogin } from "../src/services/telegram.js";

const BOT_TOKEN = "123456:test_bot_token";

/** Подписать данные так, как это делает Telegram. */
function signAsTelegram(fields: Record<string, string>, botToken = BOT_TOKEN): Record<string, string> {
  const checkString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const hash = createHmac("sha256", secret).update(checkString).digest("hex");
  return { ...fields, hash };
}

const nowS = 1_752_300_000;

function validPayload() {
  return signAsTelegram({
    id: "42",
    first_name: "Вася",
    username: "vasya",
    auth_date: String(nowS - 30),
  });
}

describe("verifyTelegramLogin", () => {
  it("принимает корректно подписанные свежие данные", () => {
    expect(verifyTelegramLogin(validPayload(), BOT_TOKEN, nowS)).toBe(true);
  });

  it("отклоняет подмену поля после подписи", () => {
    const data = { ...validPayload(), id: "999" };
    expect(verifyTelegramLogin(data, BOT_TOKEN, nowS)).toBe(false);
  });

  it("отклоняет подпись чужим bot token", () => {
    const data = signAsTelegram({ id: "42", auth_date: String(nowS) }, "999:other_token");
    expect(verifyTelegramLogin(data, BOT_TOKEN, nowS)).toBe(false);
  });

  it("отклоняет устаревшие данные (replay)", () => {
    const data = signAsTelegram({ id: "42", auth_date: String(nowS - 3600) });
    expect(verifyTelegramLogin(data, BOT_TOKEN, nowS)).toBe(false);
  });

  it("отклоняет без hash и с пустым токеном", () => {
    expect(verifyTelegramLogin({ id: "42", auth_date: String(nowS) }, BOT_TOKEN, nowS)).toBe(false);
    expect(verifyTelegramLogin(validPayload(), "", nowS)).toBe(false);
  });

  it("отклоняет hash неверной длины (не роняя timingSafeEqual)", () => {
    const data = { ...validPayload(), hash: "abcd" };
    expect(verifyTelegramLogin(data, BOT_TOKEN, nowS)).toBe(false);
  });
});
