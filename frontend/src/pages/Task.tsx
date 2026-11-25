// Страница задания (п.3.4): условие, форма сдачи (файл/текст), статус,
// комментарии препода, история версий, пересдача при «На доработке».
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../api/client";
import type { Submission } from "../api/tasks";
import { getSubmissionFileUrl, getTask, submitTask } from "../api/tasks";
import { showApiError } from "../components/admin/errors";
import RichText from "../components/RichText";
import Badge, { StatusBadge } from "../components/ui/Badge";
import Button, { LinkButton } from "../components/ui/Button";
import { alertDialog } from "../components/ui/dialogs";
import { Label, Textarea } from "../components/ui/Field";
import Icon from "../components/ui/Icon";
import Panel, { SectionTitle } from "../components/ui/Panel";
import { EmptyState, Loader } from "../components/ui/States";

export default function Task() {
  const { taskId } = useParams();
  const id = Number(taskId);
  const qc = useQueryClient();

  const { data: task, error, isLoading } = useQuery({
    queryKey: ["task", id],
    queryFn: () => getTask(id),
    enabled: Number.isInteger(id) && id > 0,
    retry: (count, err) => !(err instanceof ApiError) && count < 2,
  });

  if (isLoading) return <Loader />;
  if (error instanceof ApiError || !task) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon="task"
          title="Задание недоступно."
          action={
            <LinkButton to="/" variant="tinted">
              <Icon name="arrow-left" /> к курсу
            </LinkButton>
          }
        />
      </div>
    );
  }

  const latest = task.submissions[0] ?? null;
  const canSubmit = !latest || latest.status === "NEEDS_REVISION";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link className="link inline-flex min-h-[44px] items-center gap-1.5 text-sm" to={`/lessons/${task.lessonId}`}>
          <Icon name="arrow-left" size={16} /> к уроку
        </Link>
        <p className="hud-label mt-1 text-holo">Задание</p>
        <h1 className="mt-2 break-words font-display text-[clamp(1.75rem,5vw,2.5rem)] font-extrabold leading-tight text-crawl">
          {task.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {task.deadline && (
            <Badge>
              <Icon name="clock" size={14} />
              Сдать до {new Date(task.deadline).toLocaleDateString("ru")}
            </Badge>
          )}
          {latest && (
            <span className="flex items-center gap-2 text-ink-soft">
              Статус: <StatusBadge status={latest.status} />
            </span>
          )}
        </div>
      </header>

      <Panel pad="lg">
        <RichText markdown={task.description} />
      </Panel>

      {canSubmit && (
        <SubmitForm
          taskId={task.id}
          isResubmit={Boolean(latest)}
          onDone={() => void qc.invalidateQueries({ queryKey: ["task", id] })}
        />
      )}

      {task.submissions.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>История сдач</SectionTitle>
          {task.submissions.map((s) => <SubmissionCard key={s.id} s={s} />)}
        </section>
      )}
    </div>
  );
}

function SubmitForm({
  taskId,
  isResubmit,
  onDone,
}: {
  taskId: number;
  isResubmit: boolean;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: () => submitTask(taskId, file, text.trim()),
    onSuccess: (s) => {
      setFile(null);
      setText("");
      if (s.xpGranted > 0) void alertDialog(`Задание отправлено! +${s.xpGranted} XP`);
      onDone();
    },
    onError: showApiError,
  });

  return (
    <Panel
      as="form"
      tone="holo"
      className="space-y-4"
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        if (!file && !text.trim()) {
          void alertDialog("Прикрепи файл или напиши текст ответа");
          return;
        }
        mutation.mutate();
      }}
    >
      <h2 className="font-display text-lg font-semibold tracking-wide">
        {isResubmit ? "Загрузить новую версию" : "Сдать задание"}
      </h2>
      <div>
        <Label htmlFor="task-file">Файл (.docx, .pdf, .txt — до 10 МБ)</Label>
        <input
          id="task-file"
          type="file"
          accept=".docx,.pdf,.txt"
          className="block min-h-[44px] w-full cursor-pointer rounded-ctl border border-dashed border-line bg-space/80 p-2 text-ink-soft transition-colors hover:border-holo/60 file:mr-3 file:min-h-[36px] file:cursor-pointer file:rounded-md file:border-0 file:bg-holo/15 file:px-3 file:font-medium file:text-holo"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div>
        <Label htmlFor="task-text">…или текст прямо в форме</Label>
        <Textarea id="task-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="w-full md:w-auto">
        <Icon name="send" size={18} />
        {mutation.isPending ? "Отправка…" : "Отправить"}
      </Button>
    </Panel>
  );
}

function SubmissionCard({ s }: { s: Submission }) {
  return (
    <Panel pad="md" className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-display font-semibold tracking-wide">Версия {s.version}</span>
        <StatusBadge status={s.status} />
        <span className="text-sm text-ink-soft">{new Date(s.createdAt).toLocaleString("ru")}</span>
        {s.fileUrl && (
          <Button
            variant="text"
            size="sm"
            className="md:ml-auto"
            onClick={async () => {
              try {
                const { url } = await getSubmissionFileUrl(s.id);
                window.open(url, "_blank", "noopener");
              } catch (e) {
                showApiError(e);
              }
            }}
          >
            <Icon name="file" size={16} /> Скачать файл
          </Button>
        )}
      </div>
      {s.text && <p className="whitespace-pre-wrap break-words text-ink-soft">{s.text}</p>}
      {s.comments.map((c) => (
        <div key={c.id} className="rounded-ctl border-l-2 border-holo/60 bg-raised/60 px-3 py-2">
          <p className="text-sm text-ink-mute">
            {c.author.name} · {new Date(c.createdAt).toLocaleString("ru")}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
        </div>
      ))}
    </Panel>
  );
}
