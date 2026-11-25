// Панель препода/куратора (п.3.9): очередь заданий (старые сверху), проверка
// со статусом и комментарием, история версий, ученики потока (красный = 3+ дня).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import * as teacher from "../api/teacher";
import { getSubmissionFileUrl } from "../api/tasks";
import { showApiError } from "../components/admin/errors";
import RichText from "../components/RichText";
import Badge, { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { confirmDialog } from "../components/ui/dialogs";
import { Label, Select, Textarea } from "../components/ui/Field";
import Icon from "../components/ui/Icon";
import { PageTitle, Row, RowList } from "../components/ui/List";
import Panel, { SectionTitle } from "../components/ui/Panel";
import ProgressBar from "../components/ui/ProgressBar";
import { EmptyState, Loader } from "../components/ui/States";
import Tabs from "../components/ui/Tabs";

type Tab = "queue" | "students";

export default function TeacherPanel() {
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("queue");
  // Тот же ключ, что в <Queue>: запрос один, здесь нужен только счётчик на вкладке
  const { data: queue } = useQuery({ queryKey: ["teacher", "queue"], queryFn: teacher.getQueue });

  return (
    <div className="space-y-6">
      <PageTitle label="Проверка">Панель преподавателя</PageTitle>
      {submissionId === null ? (
        <Tabs<Tab>
          label="Разделы панели преподавателя"
          active={tab}
          onChange={setTab}
          items={[
            { id: "queue", label: "Очередь проверки", count: queue?.length },
            { id: "students", label: "Ученики" },
          ]}
        >
          {tab === "queue" ? <Queue onOpen={setSubmissionId} /> : <Students />}
        </Tabs>
      ) : (
        <ReviewCard submissionId={submissionId} onBack={() => setSubmissionId(null)} />
      )}
    </div>
  );
}

// Сетка строки очереди: на телефоне — столбик, с 768px — колонки как в таблице
const QUEUE_GRID = "md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_5rem_10.5rem] md:items-center md:gap-4";

function Queue({ onOpen }: { onOpen: (id: number) => void }) {
  const { data: queue, isLoading } = useQuery({ queryKey: ["teacher", "queue"], queryFn: teacher.getQueue });

  return (
    <section className="space-y-3">
      <h2 className="sr-only">Очередь проверки {queue && `(${queue.length})`}</h2>
      {isLoading && <Loader />}
      {queue?.length === 0 && <EmptyState icon="check" title="Всё проверено" />}
      {queue && queue.length > 0 && (
        <>
          <div className={`hud-label hidden px-4 ${QUEUE_GRID}`} aria-hidden="true">
            <span>Ученик</span>
            <span>Задание</span>
            <span>Урок</span>
            <span>Версия</span>
            <span>Сдано</span>
          </div>
          <ul className="space-y-1.5">
            {queue.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`w-full rounded-ctl border border-line bg-panel/90 px-4 py-3 text-left transition-colors duration-150 hover:border-holo/60 hover:bg-raised/80 md:min-h-[52px] md:py-2 ${QUEUE_GRID}`}
                  onClick={() => onOpen(item.id)}
                >
                  <span className="block font-medium">{item.user.name}</span>
                  <span className="block">{item.task.title}</span>
                  <span className="block text-sm text-ink-soft">{item.task.lesson.title}</span>
                  <span className="mr-2 inline text-sm text-ink-soft md:mr-0 md:block">
                    <span className="md:hidden">версия </span>
                    {item.version}
                  </span>
                  <span className="inline text-sm text-ink-soft md:block">
                    {new Date(item.createdAt).toLocaleString("ru")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ReviewCard({ submissionId, onBack }: { submissionId: number; onBack: () => void }) {
  const qc = useQueryClient();
  const { data: s } = useQuery({
    queryKey: ["teacher", "submission", submissionId],
    queryFn: () => teacher.getSubmission(submissionId),
  });
  const [comment, setComment] = useState("");

  const review = useMutation({
    mutationFn: (status: "ACCEPTED" | "NEEDS_REVISION") =>
      teacher.reviewSubmission(submissionId, status, comment.trim()),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["teacher"] });
      onBack();
    },
    onError: showApiError,
  });

  if (!s) return <Loader />;

  return (
    <div className="space-y-4">
      <Button variant="text" onClick={onBack}>
        <Icon name="arrow-left" size={16} /> к очереди
      </Button>

      <div>
        <h2 className="font-display text-2xl font-bold">{s.task.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {s.user.name} · версия {s.version} · {new Date(s.createdAt).toLocaleString("ru")}
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <details className="group rounded-ctl border border-line bg-panel/90">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 rounded-ctl px-4 text-ink-soft [&::-webkit-details-marker]:hidden">
              Условие задания
              <Icon name="chevron" size={16} className="rotate-90 transition-transform group-open:-rotate-90" />
            </summary>
            <div className="border-t border-line p-4">
              <RichText markdown={s.task.description} />
            </div>
          </details>

          <Panel className="space-y-3">
            <p className="hud-label">Работа ученика</p>
            {s.text && <p className="whitespace-pre-wrap break-words leading-relaxed">{s.text}</p>}
            {s.fileUrl && (
              <Button
                variant="tinted"
                onClick={async () => {
                  try {
                    const { url } = await getSubmissionFileUrl(s.id);
                    window.open(url, "_blank", "noopener");
                  } catch (e) {
                    showApiError(e);
                  }
                }}
              >
                <Icon name="file" size={18} /> Открыть файл работы
              </Button>
            )}
            {!s.text && !s.fileUrl && <p className="text-ink-mute">Пустая сдача</p>}
          </Panel>

          {/* История версий с комментариями — хронология (TEACH-03) */}
          {s.history.length > 1 && (
            <section className="space-y-2">
              <SectionTitle as="h3">История версий</SectionTitle>
              {s.history.map((v) => (
                <div key={v.id} className="space-y-2 rounded-ctl border border-line bg-panel/90 p-3 md:p-4">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                    <span className="font-display font-semibold text-ink">Версия {v.version}</span>
                    <StatusBadge status={v.status} />
                    {new Date(v.createdAt).toLocaleString("ru")}
                  </p>
                  {v.text && <p className="whitespace-pre-wrap break-words text-ink-soft">{v.text}</p>}
                  {v.comments.map((c) => (
                    <p key={c.id} className="rounded-ctl border-l-2 border-holo/60 bg-raised/60 px-3 py-2">
                      <span className="text-ink-mute">{c.author.name}:</span> {c.content}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          )}
        </div>

        {s.status === "PENDING" ? (
          <Panel tone="holo" className="space-y-3 lg:sticky lg:top-[84px]">
            <div>
              <Label htmlFor="review-comment">Комментарий к работе (TASK-04)</Label>
              <Textarea id="review-comment" rows={6} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="good" className="whitespace-nowrap !px-2" disabled={review.isPending} onClick={() => review.mutate("ACCEPTED")}>
                <Icon name="check" size={18} /> Принято
              </Button>
              <Button
                variant="bad"
                className="whitespace-nowrap !px-2"
                disabled={review.isPending}
                onClick={async () => {
                  if (!comment.trim() && !(await confirmDialog("Вернуть на доработку без комментария?"))) return;
                  review.mutate("NEEDS_REVISION");
                }}
              >
                <Icon name="redo" size={18} /> На доработку
              </Button>
            </div>
          </Panel>
        ) : (
          <Panel className="flex items-center gap-2">
            Статус: <StatusBadge status={s.status} />
          </Panel>
        )}
      </div>
    </div>
  );
}

const THREE_DAYS_MS = 3 * 24 * 3600 * 1000;

function Students() {
  const { data: cohorts, isLoading } = useQuery({ queryKey: ["teacher", "cohorts"], queryFn: teacher.listTeacherCohorts });
  const [cohortId, setCohortId] = useState<number | null>(null);
  const active = cohortId ?? cohorts?.[0]?.id ?? null;

  const { data } = useQuery({
    queryKey: ["teacher", "students", active],
    queryFn: () => teacher.getCohortStudents(active!),
    enabled: active !== null,
  });

  if (isLoading) return <Loader />;
  if (!cohorts?.length) return <EmptyState icon="users" title="Потоков пока нет" />;

  return (
    <section className="space-y-3">
      <h2 className="sr-only">Ученики</h2>
      {cohorts.length > 1 && (
        <div className="max-w-xl">
          <Label htmlFor="cohort-select">Поток</Label>
          <Select id="cohort-select" value={active ?? undefined} onChange={(e) => setCohortId(Number(e.target.value))}>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.course.title})
              </option>
            ))}
          </Select>
        </div>
      )}
      {!data && <Loader />}
      {data?.students.length === 0 && <EmptyState icon="users" title="В потоке пока нет учеников" />}
      <RowList label="Ученики потока">
        {data?.students.map((st) => {
          // Красный = не заходил 3+ дня (TEACH-04)
          const stale = !st.lastSeenAt || Date.now() - new Date(st.lastSeenAt).getTime() > THREE_DAYS_MS;
          return (
            <Row key={st.id} className={`min-h-[52px] ${stale ? "border-bad/40" : ""}`}>
              <span className={`min-w-0 flex-1 basis-40 font-medium ${stale ? "text-bad" : ""}`}>{st.name}</span>
              <span className="flex w-full items-center gap-3 md:w-64">
                <ProgressBar value={st.progressPct} size="sm" label={`Прогресс: ${st.name}`} />
                <span className="w-28 shrink-0 text-sm text-ink-soft">прогресс {st.progressPct}%</span>
              </span>
              <span className={`text-sm md:w-44 md:text-right ${stale ? "text-bad" : "text-ink-soft"}`}>
                {st.lastSeenAt
                  ? `был(а) ${new Date(st.lastSeenAt).toLocaleDateString("ru")}`
                  : "ещё не заходил(а)"}
              </span>
              <span className={stale ? "md:w-20 md:text-right" : "hidden md:block md:w-20"}>
                {stale && <Badge tone="bad">3+ дня</Badge>}
              </span>
            </Row>
          );
        })}
      </RowList>
    </section>
  );
}
