// Редактор структуры курса (ADMIN-02, COURSE-01..03): модули → уроки → блоки,
// порядок кнопками ↑/↓ (полноценный drag-and-drop — полировка M6), публикация.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { AdminBlock, AdminLesson, AdminModule } from "../../api/admin";
import * as adm from "../../api/admin";
import type { BlockType } from "../../api/courses";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { confirmDialog, promptDialog } from "../ui/dialogs";
import { Select, Textarea } from "../ui/Field";
import Icon from "../ui/Icon";
import Panel from "../ui/Panel";
import { Loader } from "../ui/States";
import { showApiError } from "./errors";
import { LessonTasks, LessonTests } from "./TaskTestEditors";

type Run = (fn: () => Promise<unknown>) => Promise<void>;

/** Кнопка «Выше» в строке модуля, урока или блока. */
function MoveUp({ onClick, what }: { onClick: () => void; what: string }) {
  return (
    <button
      type="button"
      title="Выше"
      aria-label={`Поднять выше: ${what}`}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ctl text-ink-soft transition-colors hover:bg-holo/10 hover:text-holo md:h-8 md:w-8"
      onClick={onClick}
    >
      <Icon name="arrow-up" size={16} />
    </button>
  );
}

export default function CourseEditor({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: course } = useQuery({
    queryKey: ["admin", "course", courseId],
    queryFn: () => adm.getAdminCourse(courseId),
  });

  /** Выполнить мутацию и перечитать структуру курса. */
  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["admin", "course", courseId] });
      await qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    } catch (e) {
      showApiError(e);
    }
  }

  /** Переставить элемент на позицию i-1: отправляем полный список id в новом порядке. */
  function moveUp(entity: "modules" | "lessons" | "blocks", ids: number[], i: number) {
    if (i === 0) return;
    const next = [...ids];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    void run(() => adm.reorder(entity, next));
  }

  if (!course) return <Loader />;

  return (
    <div className="space-y-4">
      <Button variant="text" onClick={onBack}>
        <Icon name="arrow-left" size={16} /> к курсам
      </Button>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h2 className="min-w-0 break-words font-display text-2xl font-bold">{course.title}</h2>
        <Badge tone={course.isPublished ? "good" : "neutral"}>{course.isPublished ? "опубликован" : "черновик"}</Badge>
        <div className="flex flex-wrap items-center gap-3 md:ml-auto">
          <Button
            variant="text"
            size="sm"
            onClick={async () => {
              const title = (await promptDialog("Название курса:", course.title))?.trim();
              if (title) void run(() => adm.updateCourse(courseId, { title }));
            }}
          >
            Переименовать
          </Button>
          <Button
            variant={course.isPublished ? "ghost" : "primary"}
            size="sm"
            onClick={() => void run(() => adm.updateCourse(courseId, { isPublished: !course.isPublished }))}
          >
            {course.isPublished ? "Снять с публикации" : "Опубликовать"}
          </Button>
        </div>
      </div>

      {course.modules.map((mod, mi) => (
        <ModuleCard
          key={mod.id}
          mod={mod}
          onMoveUp={() => moveUp("modules", course.modules.map((m) => m.id), mi)}
          run={run}
        />
      ))}

      <Button
        variant="tinted"
        onClick={async () => {
          const title = (await promptDialog("Название модуля:"))?.trim();
          if (title) void run(() => adm.createModule(courseId, title));
        }}
      >
        + Модуль
      </Button>
    </div>
  );
}

function ModuleCard({ mod, onMoveUp, run }: { mod: AdminModule; onMoveUp: () => void; run: Run }) {
  return (
    <Panel pad="sm" className="space-y-1 md:p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="min-w-0 flex-1 basis-48 font-display text-lg font-semibold">{mod.title}</h3>
        <MoveUp onClick={onMoveUp} what={mod.title} />
        <Button
          variant="text"
          size="sm"
          onClick={async () => {
            const title = (await promptDialog("Название модуля:", mod.title))?.trim();
            if (title) void run(() => adm.renameModule(mod.id, title));
          }}
        >
          Переименовать
        </Button>
        <Button
          variant="text-bad"
          size="sm"
          onClick={async () => {
            if (await confirmDialog(`Удалить модуль «${mod.title}»?`)) void run(() => adm.deleteModule(mod.id));
          }}
        >
          Удалить
        </Button>
      </div>

      {mod.lessons.map((lesson, li) => (
        <LessonCard
          key={lesson.id}
          lesson={lesson}
          onMoveUp={() => {
            if (li > 0) {
              const ids = mod.lessons.map((l) => l.id);
              [ids[li - 1], ids[li]] = [ids[li], ids[li - 1]];
              void run(() => adm.reorder("lessons", ids));
            }
          }}
          run={run}
        />
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="!mt-3"
        onClick={async () => {
          const title = (await promptDialog("Название урока:"))?.trim();
          if (title) void run(() => adm.createLesson(mod.id, title));
        }}
      >
        + Урок
      </Button>
    </Panel>
  );
}

function LessonCard({ lesson, onMoveUp, run }: { lesson: AdminLesson; onMoveUp: () => void; run: Run }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border-l-2 pl-3 ${open ? "border-holo/60" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          aria-expanded={open}
          className="flex min-h-[44px] min-w-0 flex-1 basis-48 items-center gap-2 rounded-ctl text-left hover:text-holo md:min-h-[40px]"
          onClick={() => setOpen(!open)}
        >
          <Icon name="chevron" size={16} className={`text-ink-mute transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="min-w-0">{lesson.title}</span>
          <span className="shrink-0 text-sm text-ink-mute">{lesson.blocks.length} блок(ов)</span>
        </button>
        <MoveUp onClick={onMoveUp} what={lesson.title} />
        <Button
          variant="text"
          size="sm"
          onClick={async () => {
            const title = (await promptDialog("Название урока:", lesson.title))?.trim();
            if (title) void run(() => adm.renameLesson(lesson.id, title));
          }}
        >
          Переименовать
        </Button>
        <Button
          variant="text-bad"
          size="sm"
          onClick={async () => {
            if (await confirmDialog(`Удалить урок «${lesson.title}»?`)) void run(() => adm.deleteLesson(lesson.id));
          }}
        >
          Удалить
        </Button>
      </div>

      {open && (
        <div className="space-y-2 pb-3 pt-1">
          {lesson.blocks.map((block, bi) => (
            <BlockRow
              key={block.id}
              block={block}
              onMoveUp={() => {
                if (bi > 0) {
                  const ids = lesson.blocks.map((b) => b.id);
                  [ids[bi - 1], ids[bi]] = [ids[bi], ids[bi - 1]];
                  void run(() => adm.reorder("blocks", ids));
                }
              }}
              run={run}
            />
          ))}
          <AddBlock lessonId={lesson.id} run={run} />
          {/* Задания-эссе и тесты урока (M3: TASK-01, TEST-01) */}
          <LessonTasks lessonId={lesson.id} tasks={lesson.tasks} run={run} />
          <LessonTests lessonId={lesson.id} tests={lesson.tests} run={run} />
        </div>
      )}
    </div>
  );
}

const BLOCK_LABEL: Record<BlockType, string> = { VIDEO: "Видео", TEXT: "Текст", PDF: "PDF" };

function BlockRow({ block, onMoveUp, run }: { block: AdminBlock; onMoveUp: () => void; run: Run }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(block.content);

  return (
    <div className="rounded-ctl border border-line bg-space/70 px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge tone="holo">{BLOCK_LABEL[block.type]}</Badge>
        {!editing && (
          <span className="min-w-0 flex-1 basis-40 truncate text-sm text-ink-soft">
            {block.type === "TEXT" ? `${block.content.slice(0, 60)}…` : block.content}
          </span>
        )}
        <span className={editing ? "ml-auto flex items-center gap-3" : "flex items-center gap-3"}>
          <MoveUp onClick={onMoveUp} what={`блок «${BLOCK_LABEL[block.type]}»`} />
          <Button variant="text" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "Отмена" : "Изменить"}
          </Button>
          <Button
            variant="text-bad"
            size="sm"
            onClick={async () => {
              if (await confirmDialog("Удалить блок?")) void run(() => adm.deleteBlock(block.id));
            }}
          >
            Удалить
          </Button>
        </span>
      </div>
      {editing && (
        <div className="space-y-2 pb-1.5 pt-2">
          <Textarea
            aria-label={`Содержимое блока «${BLOCK_LABEL[block.type]}»`}
            className="font-mono text-sm"
            rows={block.type === "TEXT" ? 8 : 2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() =>
              void run(() => adm.updateBlock(block.id, block.type, content)).then(() => setEditing(false))
            }
          >
            Сохранить
          </Button>
        </div>
      )}
    </div>
  );
}

function AddBlock({ lessonId, run }: { lessonId: number; run: Run }) {
  const [type, setType] = useState<BlockType>("TEXT");
  const [content, setContent] = useState("");

  const hint: Record<BlockType, string> = {
    VIDEO: "id ролика Kinescope (из ссылки kinescope.io/...). Пока Kinescope не подключён — id вида demo-lesson-1: покажется плеер-заглушка",
    TEXT: "Текст в markdown: **жирный**, *курсив*, # заголовок, списки, ссылки",
    PDF: "Ссылка на PDF",
  };

  return (
    <div className="space-y-2 rounded-ctl border border-dashed border-line p-3">
      <label className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        Новый блок:
        <Select className="w-auto min-w-[9rem]" value={type} onChange={(e) => setType(e.target.value as BlockType)}>
          {Object.entries(BLOCK_LABEL).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </Select>
      </label>
      <Textarea
        aria-label="Содержимое нового блока"
        className="font-mono text-sm"
        rows={type === "TEXT" ? 5 : 2}
        placeholder={hint[type]}
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <Button
        size="sm"
        disabled={!content.trim()}
        onClick={() =>
          void run(() => adm.createBlock(lessonId, type, content.trim())).then(() => setContent(""))
        }
      >
        Добавить блок
      </Button>
    </div>
  );
}
