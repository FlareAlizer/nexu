// Хранилище файлов на заглушке (локальный диск) — TASK-02 и п.4.2.
import { rm } from "node:fs/promises";

import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import {
  FileValidationError,
  getSignedUrl,
  isStubStorage,
  makeFileToken,
  readFileToken,
  readLocalFile,
  uploadSubmission,
  validateSubmissionFile,
} from "../src/services/storage.js";

const app = createApp();

afterAll(async () => {
  await rm("./.storage-test", { recursive: true, force: true });
});

describe("валидация файла сдачи", () => {
  it("пропускает .docx, .pdf, .txt", () => {
    for (const name of ["эссе.docx", "работа.PDF", "a.txt"]) {
      expect(() => validateSubmissionFile({ originalname: name, size: 100 })).not.toThrow();
    }
  });

  it("отклоняет чужое расширение", () => {
    expect(() => validateSubmissionFile({ originalname: "photo.jpg", size: 100 })).toThrow(
      FileValidationError,
    );
  });

  it("отклоняет файл больше 10 МБ", () => {
    expect(() =>
      validateSubmissionFile({ originalname: "a.pdf", size: 10 * 1024 * 1024 + 1 }),
    ).toThrow(FileValidationError);
  });
});

describe("заглушка хранилища", () => {
  it("без ключей S3 включается локальный драйвер", () => {
    expect(isStubStorage()).toBe(true);
  });

  it("файл сохраняется на диск, ключ без оригинального имени", async () => {
    const key = await uploadSubmission(7, 3, {
      buffer: Buffer.from("текст эссе"),
      originalname: "Иванов Иван 9А.txt", // ПДн в имени не должны попасть в ключ
      size: 10,
    });
    expect(key).toMatch(/^submissions\/task-3\/user-7\/[0-9a-f-]{36}\.txt$/);
    expect((await readLocalFile(key))?.toString()).toBe("текст эссе");
  });

  it("ссылка на файл — временный токен вместо presigned URL", async () => {
    const url = await getSignedUrl("submissions/task-1/user-1/x.pdf");
    expect(url).toMatch(/^\/api\/files\//);
  });
});

describe("токен доступа к файлу", () => {
  const key = "submissions/task-1/user-1/x.pdf";

  it("читается обратно, пока не истёк", () => {
    const now = 1_000_000;
    expect(readFileToken(makeFileToken(key, now + 600), now)).toBe(key);
  });

  it("после истечения срока не принимается", () => {
    const now = 1_000_000;
    expect(readFileToken(makeFileToken(key, now + 600), now + 601)).toBeNull();
  });

  it("подделанная подпись не принимается", () => {
    const token = makeFileToken(key, Math.floor(Date.now() / 1000) + 600);
    const [payload] = token.split(".");
    expect(readFileToken(`${payload}.подделка`)).toBeNull();
  });

  it("подменённый payload не принимается", () => {
    const token = makeFileToken(key, Math.floor(Date.now() / 1000) + 600);
    const [, sig] = token.split(".");
    const evil = Buffer.from(
      JSON.stringify({ key: "../../.env", exp: 9_999_999_999 }),
    ).toString("base64url");
    expect(readFileToken(`${evil}.${sig}`)).toBeNull();
  });

  it("мусор вместо токена не роняет разбор", () => {
    for (const t of ["", "abc", "a.b.c", "...."]) expect(readFileToken(t)).toBeNull();
  });
});

describe("GET /api/files/:token", () => {
  it("отдаёт файл по валидной ссылке", async () => {
    const key = await uploadSubmission(1, 1, {
      buffer: Buffer.from("hello"),
      originalname: "a.txt",
      size: 5,
    });
    const url = await getSignedUrl(key);
    const res = await request(app).get(url);
    expect(res.status).toBe(200);
    expect(res.text).toBe("hello");
  });

  it("не выпускает за пределы каталога хранилища", async () => {
    const token = makeFileToken("../../../etc/passwd", Math.floor(Date.now() / 1000) + 600);
    const res = await request(app).get(`/api/files/${token}`);
    expect(res.status).toBe(404); // ключ вне каталога → файла нет
  });

  it("битый токен — 403", async () => {
    const res = await request(app).get("/api/files/не-токен");
    expect(res.status).toBe(403);
  });
});
