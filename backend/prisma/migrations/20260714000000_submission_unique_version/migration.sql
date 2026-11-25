-- Защита от гонки двойной отправки задания: (task, user, version) уникальны.
-- Одновременные POST не смогут создать две записи version=1 (TASK-05).
CREATE UNIQUE INDEX "task_submissions_task_id_user_id_version_key"
    ON "task_submissions"("task_id", "user_id", "version");
