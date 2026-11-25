// AUTH-03: закрытые роуты без токена → 401; requireRole пускает только нужные роли.
import type { Request, Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { requireRole } from "../src/middleware/auth.js";

describe("защита роутов", () => {
  it.each([
    ["GET", "/api/courses/my"],
    ["GET", "/api/lessons/1"],
    ["GET", "/api/admin/courses"],
    ["POST", "/api/admin/courses"],
    ["POST", "/api/admin/reorder"],
  ])("%s %s без токена → 401", async (method, path) => {
    const app = createApp();
    const res = await (method === "GET" ? request(app).get(path) : request(app).post(path));
    expect(res.status).toBe(401);
  });
});

describe("requireRole", () => {
  function run(role: "STUDENT" | "TEACHER" | "ADMIN" | null, allowed: ("STUDENT" | "TEACHER" | "ADMIN")[]) {
    const req = { user: role ? { id: 1, role } : undefined } as Request;
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const res = { status, json } as unknown as Response;
    const next = vi.fn();
    requireRole(...allowed)(req, res, next);
    return { next, status };
  }

  it("пускает разрешённую роль", () => {
    const { next, status } = run("ADMIN", ["ADMIN"]);
    expect(next).toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it("не пускает чужую роль", () => {
    const { next, status } = run("STUDENT", ["ADMIN"]);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it("не пускает без req.user", () => {
    const { next, status } = run(null, ["ADMIN"]);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });
});
