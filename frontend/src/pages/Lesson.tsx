// Страница урока (п.3.3): навигация по модулям (слева / сверху на мобайле),
// блоки контента (видео/текст/PDF) по порядку, трекинг видео, кнопка «Завершить урок».
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { LessonBlock, LessonData, MyCourse } from "../api/courses";
import { completeLesson, getLesson, getMyCourses, postVideoProgress } from "../api/courses";
import { ApiError } from "../api/client";
import { showApiError } from "../components/admin/errors";
import KinescopePlayer from "../components/KinescopePlayer";
import LessonMark from "../components/LessonMark";
import RichText from "../components/RichText";
import Badge from "../components/ui/Badge";
import Button, { LinkButton } from "../components/ui/Button";
import { alertDialog, confirmDialog } from "../components/ui/dialogs";
import Icon from "../components/ui/Icon";
import type { IconName } from "../components/ui/Icon";
import Panel from "../components/ui/Panel";
import { EmptyState, ErrorNote, Loader } from "../components/ui/States";

export default function Lesson() {
  const { lessonId } = useParams();
  const id = Number(lessonId);

  const { data: lesson, error, isLoading } = useQuery({
    queryKey: ["lesson", id],
    queryFn: () => getLesson(id),
    enabled: Number.isInteger(id) && id > 0,
    retry: (count, err) => !(err instanceof ApiError) && count < 2, // 403/404 не ретраим
  });
  // Структура курса для навигации; у препода/админа вне потока её нет — сайдбар скрыт
  const { data: courses } = useQuery({ queryKey: ["courses", "my"], queryFn: getMyCourses });

  if (isLoading) return <Loader />;

  if (error instanceof ApiError) {
    const locked = error.status === 403;
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon={locked ? "lock" : "planet"}
          title={locked ? "Урок пока заблокирован — сначала заверши предыдущий." : "Урок не найден."}
          action={
            <LinkButton to="/" variant="tinted">
              <Icon name="arrow-left" /> к курсу
            </LinkButton>
          }
        />
      </div>
    );
  }
  if (!lesson) return null;

  const course = courses?.find((c) => c.id === lesson.module.courseId);

  return (
    <div className={course ? "grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-10" : "mx-auto max-w-3xl"}>
      {course && (
        <aside>
          {/* Мобайл: навигация сворачивается сверху; десктоп: всегда видна слева (п.3.3) */}
          <details className="group rounded-ctl border border-line bg-panel/90 md:hidden">
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-ctl px-4 font-display font-semibold tracking-wide [&::-webkit-details-marker]:hidden">
              Программа курса
              <Icon name="chevron" size={18} className="rotate-90 text-ink-mute transition-transform group-open:-rotate-90" />
            </summary>
            <div className="border-t border-line px-2 pb-3">
              <CourseNav course={course} currentId={lesson.id} />
            </div>
          </details>
          <Panel pad="sm" className="sticky top-[84px] hidden max-h-[calc(100vh-6.5rem)] overflow-y-auto md:block">
            <p className="hud-label px-2 pt-1">Программа курса</p>
            <CourseNav course={course} currentId={lesson.id} />
          </Panel>
        </aside>
      )}

      <article className="min-w-0 space-y-6">
        <header>
          <Link to="/" className="link inline-flex min-h-[44px] items-center gap-1.5 text-sm">
            <Icon name="arrow-left" size={16} /> к курсу
          </Link>
          <p className="hud-label mt-1 text-holo">{lesson.module.title}</p>
          <h1 className="mt-2 break-words font-display text-[clamp(1.75rem,5vw,2.5rem)] font-extrabold leading-tight text-crawl">
            {lesson.title}
          </h1>
        </header>

        {lesson.blocks.map((b) => <Block key={b.id} block={b} lesson={lesson} />)}

        {(lesson.tasks.length > 0 || lesson.tests.length > 0) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {lesson.tasks.map((t) => (
              <StepLink key={t.id} to={`/tasks/${t.id}`} icon="task" kind="Задание" title={t.title}>
                {t.deadline && <>сдать до {new Date(t.deadline).toLocaleDateString("ru")}</>}
              </StepLink>
            ))}
            {lesson.tests.map((t) => (
              <StepLink key={t.id} to={`/tests/${t.id}`} icon="test" kind="Тест" title={t.title} />
            ))}
          </div>
        )}

        <CompleteButton lesson={lesson} />
      </article>
    </div>
  );
}

// Переход к заданию или тесту урока
function StepLink({
  to,
  icon,
  kind,
  title,
  children,
}: {
  to: string;
  icon: IconName;
  kind: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-[64px] items-center gap-3 rounded-ctl border border-line bg-panel/90 px-4 py-3 transition-colors duration-150 hover:border-holo/60 hover:bg-raised/80"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-holo/35 bg-holo/[0.1] text-holo">
        <Icon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {kind}: {title}
        </span>
        {children && <span className="block text-sm text-ink-soft">{children}</span>}
      </span>
      <Icon name="chevron" size={18} className="text-ink-mute group-hover:text-holo" />
    </Link>
  );
}

// Кнопка «Завершить урок» (COURSE-05 п.3.3): активна когда все условия выполнены
function CompleteButton({ lesson }: { lesson: LessonData }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { completion, progress } = lesson;

  const mutation = useMutation({
    mutationFn: () => completeLesson(lesson.id),
    onSuccess: async ({ xpGranted, nextLessonId }) => {
      await qc.invalidateQueries({ queryKey: ["courses", "my"] });
      await qc.invalidateQueries({ queryKey: ["lesson", lesson.id] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      const bonus = xpGranted > 0 ? ` Модуль закрыт: +${xpGranted} XP!` : "";
      if (nextLessonId) {
        if (await confirmDialog(`Урок завершён!${bonus} Перейти к следующему?`)) {
          navigate(`/lessons/${nextLessonId}`);
        }
      } else {
        await alertDialog(`Урок завершён!${bonus} Это был последний урок курса.`);
      }
    },
    onError: showApiError,
  });

  if (progress.isCompleted) {
    return (
      <Panel tone="good" className="flex items-center gap-3 font-medium text-good">
        <Icon name="check" /> Урок завершён
      </Panel>
    );
  }

  const missing = [
    !completion.videoOk && "досмотри видео (нужно 80%)",
    !completion.taskOk && "сдай задание",
    !completion.testOk && "пройди тест",
  ].filter(Boolean);

  // Условия показываем только для того, что есть в уроке: без видео videoOk всегда true
  const steps = [
    lesson.blocks.some((b) => b.type === "VIDEO") && {
      ok: completion.videoOk,
      label: completion.videoOk ? "Видео просмотрено" : `Видео: ${Math.round(progress.videoWatchedPct)}% из 80%`,
    },
    lesson.tasks.length > 0 && { ok: completion.taskOk, label: completion.taskOk ? "Задание сдано" : "Задание не сдано" },
    lesson.tests.length > 0 && { ok: completion.testOk, label: completion.testOk ? "Тест пройден" : "Тест не пройден" },
  ].filter((s): s is { ok: boolean; label: string } => Boolean(s));

  return (
    <Panel tone={completion.canComplete ? "holo" : "default"} className="space-y-4">
      {steps.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Условия завершения урока">
          {steps.map((s) => (
            <li key={s.label}>
              <Badge tone={s.ok ? "good" : "neutral"}>
                <Icon name={s.ok ? "check" : "clock"} size={14} />
                {s.label}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          size="lg"
          className="w-full md:w-auto"
          disabled={!completion.canComplete || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Завершаем…" : "Завершить урок"}
        </Button>
        {missing.length > 0 && (
          <p className="text-sm text-ink-soft">Чтобы завершить: {missing.join(", ")}.</p>
        )}
      </div>
    </Panel>
  );
}

function CourseNav({ course, currentId }: { course: MyCourse; currentId: number }) {
  return (
    <nav aria-label="Программа курса" className="mt-2 space-y-3">
      {course.modules.map((m) => (
        <div key={m.id}>
          <p className="px-2 py-1 text-sm font-semibold text-ink-mute">{m.title}</p>
          <ul>
            {m.lessons.map((l) => (
              <li key={l.id}>
                {l.status === "locked" ? (
                  <span className="flex min-h-[44px] items-center gap-2.5 px-2 py-1.5 text-sm text-ink-mute md:min-h-[40px]">
                    <LessonMark status={l.status} small /> {l.title}
                  </span>
                ) : (
                  <Link
                    to={`/lessons/${l.id}`}
                    aria-current={l.id === currentId ? "page" : undefined}
                    className={`flex min-h-[44px] items-center gap-2.5 rounded-ctl px-2 py-1.5 text-sm transition-colors duration-150 md:min-h-[40px] ${
                      l.id === currentId
                        ? "bg-holo/[0.12] font-semibold text-ink shadow-[inset_2px_0_0_rgb(var(--c-holo))]"
                        : "text-ink-soft hover:bg-raised/80 hover:text-ink"
                    }`}
                  >
                    <LessonMark status={l.status} small /> {l.title}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Block({ block, lesson }: { block: LessonBlock; lesson: LessonData }) {
  const qc = useQueryClient();

  switch (block.type) {
    case "VIDEO":
      return (
        <VideoBlock
          videoId={block.content}
          lesson={lesson}
          onXp={() => {
            // 80% достигнуто: обновить условия кнопки и статусы курса
            void qc.invalidateQueries({ queryKey: ["lesson", lesson.id] });
            void qc.invalidateQueries({ queryKey: ["me"] });
          }}
        />
      );
    case "TEXT":
      return (
        <Panel pad="lg">
          <RichText markdown={block.content} />
        </Panel>
      );
    case "PDF":
      // Просмотр без обязательного скачивания (COURSE-04, п.3.3); signed URL из S3 — M3
      return (
        <div className="space-y-2">
          <iframe
            src={block.content}
            title="PDF"
            className="h-[70vh] w-full rounded-ctl border border-line bg-white [color-scheme:light]"
          />
          <a className="link inline-flex min-h-[44px] items-center gap-1.5 text-sm" href={block.content} target="_blank" rel="noreferrer">
            <Icon name="file" size={16} /> Открыть PDF в новой вкладке
          </a>
        </div>
      );
  }
}

// Видео с трекингом (COURSE-01/02): плеер репортит прогресс, шлём на бэк;
// при первом достижении 80% сервер начисляет +10 XP — обновляем экран
function VideoBlock({
  videoId,
  lesson,
  onXp,
}: {
  videoId: string;
  lesson: LessonData;
  onXp: () => void;
}) {
  const fails = useRef(0);
  const [stalled, setStalled] = useState(false);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-ctl border border-holo/30 bg-void shadow-[0_0_40px_-18px_rgb(var(--c-holo)/0.6)]">
        <KinescopePlayer
          videoId={videoId}
          title={lesson.title}
          initialPositionS={lesson.progress.videoPositionS}
          onProgress={(pct, positionS) => {
            postVideoProgress(lesson.id, pct, positionS)
              .then((r) => {
                fails.current = 0;
                if (stalled) setStalled(false);
                if (r.xpGranted > 0) onXp();
              })
              .catch((e) => {
                // Не глотаем молча: логируем и после нескольких неудач подряд
                // предупреждаем ученика, что прогресс не сохраняется (напр. протух вход)
                console.warn("не удалось сохранить прогресс видео", e);
                fails.current += 1;
                if (fails.current >= 3) setStalled(true);
              });
          }}
        />
      </div>
      {stalled && (
        <ErrorNote>
          Прогресс просмотра не сохраняется. Обнови страницу или войди заново, иначе урок не
          зачтётся.
        </ErrorNote>
      )}
    </div>
  );
}
