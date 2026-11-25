// Драйвер закрытого S3-бакета (Selectel/Yandex) — прод-хранилище файлов заданий (п.4.2).
// Выбор драйвера (S3 или локальный диск-заглушка) — в services/storage.ts.
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";

import { config } from "../config.js";

let client: S3Client | null = null;

function s3(): S3Client {
  client ??= new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
    forcePathStyle: true, // Selectel/Yandex работают по path-style
  });
  return client;
}

/** Положить объект в бакет. */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Временная ссылка на скачивание/просмотр. */
export async function presignGet(key: string, ttlS: number): Promise<string> {
  return presign(s3(), new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }), {
    expiresIn: ttlS,
  });
}
