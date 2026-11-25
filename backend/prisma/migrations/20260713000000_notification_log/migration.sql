-- Лог отправленных уведомлений (M5): идемпотентность напоминаний NOTIF-03.
CREATE TABLE "notification_log" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "ref_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_log_user_id_kind_ref_id_key"
    ON "notification_log"("user_id", "kind", "ref_id");

ALTER TABLE "notification_log"
    ADD CONSTRAINT "notification_log_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
