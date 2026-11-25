// Редакторы задания (TASK-01) и теста (TEST-01) в админке урока.
import { useEffect, useState } from "react";

import type { AdminTaskRef, AdminTestRef, QuestionInput, TaskInput } from "../../api/admin";
import * as adm from "../../api/admin";
import Button from "../ui/Button";
import { alertDialog, confirmDialog } from "../ui/dialogs";
import { Input, Select, Textarea } from "../ui/Field";
import Icon from "../ui/Icon";
import { ErrorNote } from "../ui/States";
import { showApiError } from "./errors";

type Run = (fn: () => Promise<unknown>) => Promise<void>;

const ROW = "rounded-ctl border border-line bg-space/70 px-3 py-1.5";

// ---------- задания ----------

export function LessonTasks({ lessonId, tasks, run }: { lessonId: number; tasks: AdminTaskRef[]; run: Run }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div key={t.id} className={ROW}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Icon name="task" size={18} className="text-holo" />
            <span className="min-w-0 flex-1 basis-40">{t.title}</span>
            {t.deadline && (
              <span className="text-sm text-ink-soft">до {new Date(t.deadline).toLocaleDateString("ru")}</span>
            )}
            <Button variant="text" size="sm" onClick={() => setEditing(editing === t.id ? null : t.id)}>
              {editing === t.id ? "Отмена" : "Изменить"}
            </Button>
            <Button
              variant="text-bad"
              size="sm"
              onClick={async () => {
                if (await confirmDialog(`Удалить задание «${t.title}»?`)) void run(() => adm.deleteTask(t.id));
              }}
            >
              Удалить
            </Button>
          </div>
          {editing === t.id && (
            <TaskForm
              taskId={t.id}
              onSave={(data) => void run(() => adm.updateTask(t.id, data)).then(() => setEditing(null))}
            />
          )}
        </div>
      ))}
      {editing === "new" ? (
        <div className={ROW}>
          <TaskForm onSave={(data) => void run(() => adm.createTask(lessonId, data)).then(() => setEditing(null))} />
          <Button variant="text" size="sm" onClick={() => setEditing(null)}>
            Отмена
          </Button>
        </div>
      ) : (
        <Button variant="text" size="sm" className="mr-4" onClick={() => setEditing("new")}>
          + Задание
        </Button>
      )}
    </div>
  );
}

function TaskForm({ taskId, onSave }: { taskId?: number; onSave: (data: TaskInput) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loaded, setLoaded] = useState(!taskId);

  // Правка существующего: подтягиваем текущие поля
  useEffect(() => {
    if (!taskId) return;
    adm
      .getAdminTask(taskId)
      .then((t) => {
        setTitle(t.title);
        setDescription(t.description);
        setDeadline(t.deadline ? t.deadline.slice(0, 10) : "");
        setLoaded(true);
      })
      .catch(showApiError);
  }, [taskId]);

  if (!loaded) return <p className="py-2 text-sm text-ink-soft">Загрузка…</p>;

  return (
    <div className="space-y-2 py-2">
      <Input
        aria-label="Название задания"
        placeholder="Название задания"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        aria-label="Условие (markdown)"
        className="font-mono text-sm"
        rows={5}
        placeholder="Условие (markdown)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        Дедлайн (необязательно):
        <Input type="date" className="w-auto" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </label>
      <Button
        size="sm"
        disabled={!title.trim()}
        onClick={() => onSave({ title: title.trim(), description, deadline: deadline || null })}
      >
        Сохранить задание
      </Button>
    </div>
  );
}

// ---------- тесты ----------

export function LessonTests({ lessonId, tests, run }: { lessonId: number; tests: AdminTestRef[]; run: Run }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);

  return (
    <div className="space-y-2">
      {tests.map((t) => (
        <div key={t.id} className={ROW}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Icon name="test" size={18} className="text-holo" />
            <span className="min-w-0 flex-1 basis-40">{t.title}</span>
            <span className="text-sm text-ink-soft">{t._count.questions} вопр.</span>
            <Button variant="text" size="sm" onClick={() => setEditing(editing === t.id ? null : t.id)}>
              {editing === t.id ? "Отмена" : "Изменить"}
            </Button>
            <Button
              variant="text-bad"
              size="sm"
              onClick={async () => {
                if (await confirmDialog(`Удалить тест «${t.title}»?`)) void run(() => adm.deleteTest(t.id));
              }}
            >
              Удалить
            </Button>
          </div>
          {editing === t.id && (
            <TestForm
              testId={t.id}
              onSave={(title, qs) => void run(() => adm.replaceTest(t.id, title, qs)).then(() => setEditing(null))}
            />
          )}
        </div>
      ))}
      {editing === "new" ? (
        <div className={ROW}>
          <TestForm
            onSave={(title, qs) => void run(() => adm.createTest(lessonId, title, qs)).then(() => setEditing(null))}
          />
          <Button variant="text" size="sm" onClick={() => setEditing(null)}>
            Отмена
          </Button>
        </div>
      ) : (
        <Button variant="text" size="sm" onClick={() => setEditing("new")}>
          + Тест
        </Button>
      )}
    </div>
  );
}

const EMPTY_QUESTION: QuestionInput = {
  type: "SINGLE",
  text: "",
  explanation: "",
  answers: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ],
};

function TestForm({
  testId,
  onSave,
}: {
  testId?: number;
  onSave: (title: string, questions: QuestionInput[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionInput[]>([structuredClone(EMPTY_QUESTION)]);
  const [loaded, setLoaded] = useState(!testId);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!testId) return;
    adm
      .getAdminTest(testId)
      .then((t) => {
        setTitle(t.title);
        setQuestions(
          t.questions.map((q) => ({
            type: q.type,
            text: q.text,
            explanation: q.explanation,
            answers: q.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })),
          })),
        );
        setLocked(t._count.attempts > 0);
        setLoaded(true);
      })
      .catch(showApiError);
  }, [testId]);

  if (!loaded) return <p className="py-2 text-sm text-ink-soft">Загрузка…</p>;
  if (locked) {
    return (
      <div className="py-2">
        <ErrorNote>По тесту уже есть попытки — правка заблокирована.</ErrorNote>
      </div>
    );
  }

  const patchQuestion = (i: number, patch: Partial<QuestionInput>) =>
    setQuestions((prev) => prev.map((q, qi) => (qi === i ? { ...q, ...patch } : q)));

  return (
    <div className="space-y-3 py-2">
      <Input
        aria-label="Название теста"
        placeholder="Название теста"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {questions.map((q, i) => (
        <fieldset key={i} className="min-w-0 space-y-2 rounded-ctl border border-line bg-panel/80 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <legend className="float-left font-display font-semibold">Вопрос {i + 1}</legend>
            <Select
              aria-label={`Тип вопроса ${i + 1}`}
              className="w-auto min-w-[10rem]"
              value={q.type}
              onChange={(e) => {
                const type = e.target.value as QuestionInput["type"];
                patchQuestion(i, {
                  type,
                  answers: type === "OPEN" ? [] : q.answers.length ? q.answers : structuredClone(EMPTY_QUESTION.answers),
                });
              }}
            >
              <option value="SINGLE">Один ответ</option>
              <option value="MULTIPLE">Несколько</option>
              <option value="OPEN">Развёрнутый</option>
            </Select>
            <Button
              variant="text-bad"
              size="sm"
              className="ml-auto"
              onClick={() => setQuestions((prev) => prev.filter((_, qi) => qi !== i))}
            >
              Убрать вопрос
            </Button>
          </div>
          <Textarea
            aria-label={`Текст вопроса ${i + 1}`}
            rows={2}
            placeholder="Текст вопроса"
            value={q.text}
            onChange={(e) => patchQuestion(i, { text: e.target.value })}
          />
          {q.type !== "OPEN" &&
            q.answers.map((a, ai) => (
              <div key={ai} className="flex items-center gap-3">
                <input
                  type={q.type === "SINGLE" ? "radio" : "checkbox"}
                  name={`correct-${i}`}
                  title="Правильный"
                  aria-label={`Вариант ${ai + 1} правильный`}
                  checked={a.isCorrect}
                  onChange={(e) =>
                    patchQuestion(i, {
                      answers: q.answers.map((x, xi) =>
                        q.type === "SINGLE"
                          ? { ...x, isCorrect: xi === ai }
                          : xi === ai
                            ? { ...x, isCorrect: e.target.checked }
                            : x,
                      ),
                    })
                  }
                />
                <Input
                  aria-label={`Вариант ${ai + 1}`}
                  className="min-w-0 flex-1"
                  placeholder={`Вариант ${ai + 1}`}
                  value={a.text}
                  onChange={(e) =>
                    patchQuestion(i, {
                      answers: q.answers.map((x, xi) => (xi === ai ? { ...x, text: e.target.value } : x)),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`Убрать вариант ${ai + 1}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ctl text-bad transition-colors hover:bg-bad/10"
                  onClick={() => patchQuestion(i, { answers: q.answers.filter((_, xi) => xi !== ai) })}
                >
                  <Icon name="cross" size={16} />
                </button>
              </div>
            ))}
          {q.type !== "OPEN" && (
            <Button
              variant="text"
              size="sm"
              onClick={() => patchQuestion(i, { answers: [...q.answers, { text: "", isCorrect: false }] })}
            >
              + вариант
            </Button>
          )}
          <Input
            aria-label={`Объяснение к вопросу ${i + 1}`}
            placeholder="Объяснение после ответа (TEST-02, необязательно)"
            value={q.explanation}
            onChange={(e) => patchQuestion(i, { explanation: e.target.value })}
          />
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setQuestions((prev) => [...prev, structuredClone(EMPTY_QUESTION)])}
        >
          + вопрос
        </Button>
        <Button
          size="sm"
          disabled={!title.trim() || questions.length === 0}
          onClick={() => {
            const cleaned = questions.map((q) => ({
              ...q,
              text: q.text.trim(),
              answers: q.answers.filter((a) => a.text.trim()),
            }));
            if (cleaned.some((q) => !q.text)) {
              void alertDialog("У каждого вопроса должен быть текст");
              return;
            }
            onSave(title.trim(), cleaned);
          }}
        >
          Сохранить тест
        </Button>
      </div>
    </div>
  );
}
