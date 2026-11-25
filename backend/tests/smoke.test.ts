// Смоук: приложение собирается, /health отвечает. Запуск: npm test
import { describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../src/app.js";

describe("health", () => {
  it("GET /health -> 200 ok", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
