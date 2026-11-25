// Хранилище файлов заданий. Два драйвера с одинаковым контрактом:
//   S3 (прод) — когда заданы S3_ENDPOINT + ключи;
//   локальный диск (заглушка) — пока S3 не подключён: dev, QA-стенд, CI.
// Ссылка на файл в обоих случаях временная (10 мин): в S3 — presigned URL,
// в заглушке — /api/files/<токен> с HMAC-подписью и сроком годности.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import pino from "pino";

import { config } from "../config.js";
import { presignGet, putObject } from "./s3.js";

const log = pino({ name: "storage" });

// TASK-02: .docx / .pdf / .txt, до 10 MB
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// TTL ссылки на файл (п.4.2)
export const SIGNED_URL_TTL_S = 600;

const ALLOWED: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

export class FileValidationError extends Error {}

/** Работаем ли на заглушке (локальный диск вместо S3). */
export function isStubStorage(): boolean {
  return !(config.s3.endpoint && config.s3.accessKey && config.s3.secretKey);
}

/** Расширение файла в нижнем регистре, включая точку. */
function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

/** Content-Type по ключу файла; неизвестное — как поток байт. */
export function contentTypeOf(key: string): string {
  return ALLOWED[extOf(key)] ?? "application/octet-stream";
}

/** Проверить файл сдачи (TASK-02). Кидает FileValidationError с понятным текстом. */
export function validateSubmissionFile(file: { originalname: string; size: number }): void {
  const ext = extOf(file.originalname);
  if (!(ext in ALLOWED)) {
    throw new FileValidationError("допустимы только .docx, .pdf и .txt");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new FileValidationError("файл больше 10 МБ");
  }
}

/** Абсолютный путь файла в локальном хранилище; защита от выхода за пределы каталога. */
function localPath(key: string): string {
  const root = path.resolve(config.storageLocalDir);
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("недопустимый ключ файла");
  }
  return full;
}

function sign(payload: string): string {
  return createHmac("sha256", config.jwtSecret).update(payload).digest("base64url");
}

/** Токен доступа к файлу локального хранилища: аналог presigned URL. */
export function makeFileToken(key: string, expS: number): string {
  const payload = Buffer.from(JSON.stringify({ key, exp: expS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Ключ файла из токена, либо null — подпись не сошлась или срок вышел. */
export function readFileToken(token: string, nowS: number = Math.floor(Date.now() / 1000)): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as unknown;
    if (typeof data !== "object" || data === null) return null;
    const { key, exp } = data as { key?: unknown; exp?: unknown };
    if (typeof key !== "string" || typeof exp !== "number") return null;
    if (nowS > exp) return null;
    return key;
  } catch {
    return null;
  }
}

/** Загрузить файл сдачи, вернуть ключ хранилища. */
export async function uploadSubmission(
  userId: number,
  taskId: number,
  file: { buffer: Buffer; originalname: string; size: number },
): Promise<string> {
  validateSubmissionFile(file);
  const ext = extOf(file.originalname);
  // Ключ не содержит оригинального имени: имена файлов школьников бывают с ПДн
  const key = `submissions/task-${taskId}/user-${userId}/${randomUUID()}${ext}`;

  if (isStubStorage()) {
    const full = localPath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.buffer);
    log.info({ key }, "заглушка хранилища: файл записан на диск вместо S3");
  } else {
    await putObject(key, file.buffer, ALLOWED[ext]);
  }
  return key;
}

/** Временная ссылка на файл, TTL 10 мин (п.4.2). */
export async function getSignedUrl(key: string): Promise<string> {
  if (isStubStorage()) {
    return `/api/files/${makeFileToken(key, Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_S)}`;
  }
  return presignGet(key, SIGNED_URL_TTL_S);
}

/** Прочитать файл из локального хранилища; null — файла нет. */
export async function readLocalFile(key: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}
