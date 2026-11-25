-- Индексы по FK-полям: Postgres не создаёт их автоматически,
-- а выборки структуры курса/прогресса идут именно по ним (п.4.1: API ≤300 мс).
CREATE INDEX "modules_course_id_idx" ON "modules"("course_id");
CREATE INDEX "lessons_module_id_idx" ON "lessons"("module_id");
CREATE INDEX "lesson_blocks_lesson_id_idx" ON "lesson_blocks"("lesson_id");
CREATE INDEX "tasks_lesson_id_idx" ON "tasks"("lesson_id");
CREATE INDEX "task_submissions_task_id_status_idx" ON "task_submissions"("task_id", "status");
CREATE INDEX "task_submissions_user_id_idx" ON "task_submissions"("user_id");
CREATE INDEX "task_comments_submission_id_idx" ON "task_comments"("submission_id");
CREATE INDEX "tests_lesson_id_idx" ON "tests"("lesson_id");
CREATE INDEX "test_questions_test_id_idx" ON "test_questions"("test_id");
CREATE INDEX "test_answers_question_id_idx" ON "test_answers"("question_id");
CREATE INDEX "test_attempts_test_id_user_id_idx" ON "test_attempts"("test_id", "user_id");
CREATE INDEX "lesson_progress_user_id_idx" ON "lesson_progress"("user_id");
CREATE INDEX "cohorts_course_id_idx" ON "cohorts"("course_id");
CREATE INDEX "cohort_members_user_id_idx" ON "cohort_members"("user_id");
