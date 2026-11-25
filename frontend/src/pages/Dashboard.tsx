// Кабинет ученика (п.3.8): приветствие, XP, «Продолжить», напоминания о заданиях,
// программа курса со статусами уроков (COURSE-04/05).
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { MyCourse } from "../api/courses";
import { getMyCourses } from "../api/courses";
import type { CourseProgress } from "../api/me";
import { getMe, getMyProgress, getPendingTasks } from "../api/me";
import { useAuth } from "../auth/AuthContext";
import LessonMark from "../components/LessonMark";
import { StatusBadge } from "../components/ui/Badge";
import Button, { LinkButton } from "../components/ui/Button";
import CourseCover from "../components/ui/CourseCover";
import { SearchField } from "../components/ui/Field";
import Icon from "../components/ui/Icon";
import Panel, { SectionTitle } from "../components/ui/Panel";
import ProgressBar from "../components/ui/ProgressBar";
import { EmptyState, Loader } from "../components/ui/States";
import { rankOf } from "../lib/rank";
import { plural } from "../lib/seed";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: courses, isLoading } = useQuery({ queryKey: ["courses", "my"], queryFn: getMyCourses });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: getMe });
  const { data: progress } = useQuery({ queryKey: ["me", "progress"], queryFn: getMyProgress });
  const { data: pending } = useQuery({ queryKey: ["me", "pending-tasks"], queryFn: getPendingTasks });
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  if (isLoading) return <Loader />;

  const continueLessonId = progress?.find((p) => p.continueLessonId)?.continueLessonId ?? null;
  const all = courses ?? [];
  const query = search.trim().toLowerCase();
  const shown = query ? all.filter((c) => c.title.toLowerCase().includes(query)) : all;
  // Программа показывается для одного курса: выбранного, иначе первого в списке
  const open = shown.find((c) => c.id === openId) ?? shown[0] ?? null;
  const single = all.length === 1;

  return (
    <div className="space-y-8 md:space-y-10">
      <section className="grid items-end gap-6 lg:grid-cols-[1fr_24rem]">
        <div>
          <p className="hud-label text-holo">Кабинет</p>
          <h1 className="mt-2 break-words font-display text-[clamp(2rem,6vw,3.25rem)] font-extrabold leading-[1.05] text-crawl">
            Привет, {user?.name}!
          </h1>
          {continueLessonId && (
            <LinkButton to={`/lessons/${continueLessonId}`} size="lg" className="mt-5 w-full sm:w-auto">
              Продолжить обучение <Icon name="arrow-right" />
            </LinkButton>
          )}
        </div>
        {me && <RankPanel xp={me.xp} />}
      </section>

      {/* Блок-напоминание: возвращённые и ожидающие проверки (п.3.8) */}
      {pending && pending.length > 0 && (
        <Panel as="section" tone="warn" aria-labelledby="pending-title">
          <h2 id="pending-title" className="font-display text-lg font-semibold tracking-wide text-warn">
            Задания, требующие внимания
          </h2>
          <ul className="mt-2 divide-y divide-warn/15">
            {pending.map((p) => (
              <li key={p.taskId}>
                <Link
                  to={`/tasks/${p.taskId}`}
                  className="group flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 rounded-ctl py-2"
                >
                  <Icon name={p.status === "NEEDS_REVISION" ? "redo" : "clock"} className="text-warn" />
                  <span className="min-w-0 flex-1 basis-40 font-medium group-hover:underline">{p.title}</span>
                  <StatusBadge status={p.status} />
                  {p.deadline && (
                    <span className="text-sm text-ink-soft">до {new Date(p.deadline).toLocaleDateString("ru")}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!all.length ? (
        <EmptyState title="Курсов пока нет">
          Тебя ещё не добавили в поток. Если ты уже оплатил курс — напиши куратору.
        </EmptyState>
      ) : (
        <section className="space-y-4" aria-labelledby="courses-title">
          <SectionTitle
            aside={
              all.length > 1 && <SearchField value={search} onChange={setSearch} className="w-full md:w-72" />
            }
          >
            <span id="courses-title">Курсы</span>
          </SectionTitle>

          {shown.length === 0 && (
            <EmptyState icon="search" title="Ничего не найдено">
              По запросу «{search.trim()}» курсов нет.
            </EmptyState>
          )}

          <div className={single ? "grid items-start gap-5 lg:grid-cols-[24rem_1fr]" : "space-y-6"}>
            <div className={single ? "" : "grid gap-5 md:grid-cols-2 lg:grid-cols-3"}>
              {shown.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  progress={progress?.find((p) => p.courseId === c.id)}
                  selected={!single && open?.id === c.id}
                  onProgram={single ? undefined : () => setOpenId(c.id)}
                />
              ))}
            </div>
            {open && <Program course={open} />}
          </div>
        </section>
      )}
    </div>
  );
}

// Ранг и путь до следующего (п.3.6). Пороги — в lib/rank.ts
function RankPanel({ xp }: { xp: number }) {
  const rank = rankOf(xp);
  return (
    <Panel tone="holo" aria-label="Опыт и ранг">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="hud-label">Ранг {rank.level}</p>
          <p className="mt-1 font-display text-2xl font-bold leading-none text-ink">{rank.title}</p>
        </div>
        <p className="flex items-center gap-1.5 font-display text-2xl font-bold leading-none text-crawl">
          <Icon name="bolt" size={22} />
          {xp} XP
        </p>
      </div>
      <ProgressBar value={rank.pct} tone="crawl" label="Прогресс до следующего ранга" className="mt-4" />
      <p className="mt-2 text-sm text-ink-soft">
        {rank.next ? `До ранга «${rank.next.title}» — ${rank.left} XP` : "Высший ранг получен"}
      </p>
    </Panel>
  );
}

function CourseCard({
  course,
  progress,
  selected,
  onProgram,
}: {
  course: MyCourse;
  progress?: CourseProgress;
  selected: boolean;
  /** Показать программу этого курса; не передаётся, когда курс один и программа уже рядом. */
  onProgram?: () => void;
}) {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const done = lessons.filter((l) => l.status === "completed").length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const finished = lessons.length > 0 && done === lessons.length;
  const nextId = progress?.continueLessonId ?? lessons.find((l) => l.status === "available")?.id ?? null;

  return (
    <Panel as="article" pad="none" tone={selected ? "holo" : "default"} className="flex h-full flex-col">
      <CourseCover seed={`${course.id}:${course.title}`} variant={course.id - 1} imageUrl={course.coverUrl}>
        {(light) => (
          <div className="flex h-full flex-col justify-between p-4">
            {course.cohort && (
              <span
                className={`self-start rounded-full px-3 py-1 text-sm font-medium ${
                  light ? "bg-void/75 text-ink" : "bg-void/55 text-ink ring-1 ring-inset ring-white/15"
                }`}
              >
                {course.cohort.title}
              </span>
            )}
            <p className={`mt-auto font-display leading-none ${light ? "text-void" : "text-ink"}`}>
              <span className="text-5xl font-black">{lessons.length}</span>
              <span className="ml-2 text-sm font-semibold uppercase tracking-[0.14em]">
                {plural(lessons.length, "урок", "урока", "уроков")}
              </span>
            </p>
          </div>
        )}
      </CourseCover>

      <div className="flex flex-1 flex-col gap-4 p-4 md:p-5">
        <div>
          <h3 className="line-clamp-2 min-h-[3.25rem] font-display text-xl font-bold leading-snug">{course.title}</h3>
          <p className="mt-1.5 text-sm text-ink-soft">
            {course.modules.length} {plural(course.modules.length, "модуль", "модуля", "модулей")}
            {course.cohort?.tgChatUrl && (
              <>
                {" · "}
                <a className="link" href={course.cohort.tgChatUrl} target="_blank" rel="noreferrer">
                  чат потока в Telegram
                </a>
              </>
            )}
          </p>
        </div>

        {/* Прогресс-бар курса (п.3.8) */}
        <div className="mt-auto border-t border-line pt-4">
          <ProgressBar value={pct} tone={finished ? "good" : "holo"} label={`Прогресс курса «${course.title}»`} />
          <p className="mt-2 text-sm text-ink-soft">
            {pct}% · {done} из {lessons.length} уроков
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {nextId ? (
            <LinkButton to={`/lessons/${nextId}`} block>
              Продолжить
            </LinkButton>
          ) : (
            <p className="flex min-h-[44px] items-center justify-center gap-2 rounded-ctl border border-good/35 bg-good/[0.1] text-good">
              {finished && <Icon name="check" />}
              {finished ? "Курс пройден" : "Уроков пока нет"}
            </p>
          )}
          {onProgram && (
            <Button variant="tinted" block aria-pressed={selected} onClick={onProgram}>
              Программа курса
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}

// Программа курса: модули и уроки со статусами; закрытые уроки не кликаются (COURSE-05)
function Program({ course }: { course: MyCourse }) {
  return (
    <Panel as="section" aria-label={`Программа курса «${course.title}»`}>
      <p className="hud-label">Программа курса</p>
      <h3 className="mt-1 font-display text-xl font-bold">{course.title}</h3>
      {course.description && <p className="mt-1 text-ink-soft">{course.description}</p>}

      <div className="mt-5 grid gap-x-8 gap-y-6 md:grid-cols-2">
        {course.modules.map((m) => (
          <div key={m.id}>
            <h4 className="border-b border-line pb-2 font-display font-semibold tracking-wide text-ink-soft">{m.title}</h4>
            <ul className="mt-1">
              {m.lessons.map((l) => (
                <li key={l.id}>
                  {l.status === "locked" ? (
                    <span className="flex min-h-[44px] items-center gap-3 py-1.5 text-ink-mute">
                      <LessonMark status={l.status} /> {l.title}
                    </span>
                  ) : (
                    <Link
                      to={`/lessons/${l.id}`}
                      className="group flex min-h-[44px] items-center gap-3 rounded-ctl py-1.5 hover:text-holo"
                    >
                      <LessonMark status={l.status} />
                      <span className="flex-1 group-hover:underline">{l.title}</span>
                      <Icon name="chevron" size={16} className="text-ink-mute group-hover:text-holo" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
