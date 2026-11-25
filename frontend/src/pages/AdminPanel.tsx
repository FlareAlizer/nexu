// Панель админа (п.3.10): дашборд (ADMIN-05), курсы (ADMIN-02), потоки (ADMIN-03/04),
// пользователи (ADMIN-01), рассылка потоку (ADMIN-06).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import * as adm from "../api/admin";
import CourseEditor from "../components/admin/CourseEditor";
import { showApiError } from "../components/admin/errors";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { alertDialog, confirmDialog, promptDialog } from "../components/ui/dialogs";
import { SearchField, Select } from "../components/ui/Field";
import Icon from "../components/ui/Icon";
import { PageTitle, Row, RowList } from "../components/ui/List";
import Panel from "../components/ui/Panel";
import { EmptyState, Loader } from "../components/ui/States";
import Tabs from "../components/ui/Tabs";

type Tab = "courses" | "cohorts" | "users";

export default function AdminPanel() {
  const [courseId, setCourseId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("courses");

  return (
    <div className="space-y-6">
      <PageTitle label="Админка">Администрирование</PageTitle>
      {courseId === null ? (
        <>
          <DashboardStats />
          <Tabs<Tab>
            label="Разделы администрирования"
            active={tab}
            onChange={setTab}
            items={[
              { id: "courses", label: "Курсы" },
              { id: "cohorts", label: "Потоки" },
              { id: "users", label: "Пользователи" },
            ]}
          >
            {tab === "courses" && <CourseList onOpen={setCourseId} />}
            {tab === "cohorts" && <CohortSection />}
            {tab === "users" && <UsersSection />}
          </Tabs>
        </>
      ) : (
        <CourseEditor courseId={courseId} onBack={() => setCourseId(null)} />
      )}
    </div>
  );
}

// ADMIN-05: DAU, активность за неделю, непроверенные задания
function DashboardStats() {
  const { data } = useQuery({ queryKey: ["admin", "dashboard"], queryFn: adm.getDashboard });
  if (!data) return null;

  const stats = [
    { label: "DAU сегодня", value: data.dau },
    { label: "Активны за 7 дней", value: data.weeklyActive },
    { label: "Ждут проверки", value: data.pendingSubmissions },
    { label: "Учеников всего", value: data.totalStudents },
  ];
  return (
    <section aria-label="Сводка" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <Panel key={s.label} pad="sm" className="px-4">
          <p className="font-display text-3xl font-extrabold leading-tight text-ink">{s.value}</p>
          <p className="text-sm text-ink-soft">{s.label}</p>
        </Panel>
      ))}
    </section>
  );
}

const ROLE_LABEL: Record<adm.AdminUser["role"], string> = {
  STUDENT: "Ученик",
  TEACHER: "Преподаватель",
  ADMIN: "Админ",
};

// ADMIN-01: список, смена роли, блокировка; пароль для резервного входа (AUTH-02)
function UsersSection() {
  const qc = useQueryClient();
  const { data: users } = useQuery({ queryKey: ["admin", "users"], queryFn: adm.listUsers });
  const [search, setSearch] = useState("");

  async function patch(id: number, data: Parameters<typeof adm.patchUser>[1]) {
    try {
      await adm.patchUser(id, data);
      await qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e) {
      showApiError(e);
    }
  }

  if (!users) return <Loader />;

  const q = search.trim().toLowerCase();
  const shown = q
    ? users.filter((u) => [u.name, u.email, u.tgUsername].some((v) => v?.toLowerCase().includes(q)))
    : users;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-wide">
          Пользователи <span className="text-ink-mute">({users.length})</span>
        </h2>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Имя, email или Telegram"
          className="w-full md:w-72"
        />
      </div>
      {shown.length === 0 && <EmptyState icon="search" title="Никого не нашли" />}
      <RowList label="Пользователи">
        {shown.map((u) => (
          <Row key={u.id}>
            <div className="min-w-0 flex-1 basis-56">
              <p className={`font-medium ${u.isBlocked ? "text-ink-mute line-through" : ""}`}>
                {u.name}
                {u.isBlocked && <span className="sr-only"> (заблокирован)</span>}
              </p>
              <p className="break-words text-sm text-ink-soft">
                {u.tgUsername && `@${u.tgUsername}`} {u.email}
                {u.cohorts.length > 0 && ` · ${u.cohorts.map((c) => c.title).join(", ")}`}
              </p>
            </div>
            <Select
              aria-label={`Роль: ${u.name}`}
              className="w-full md:w-52"
              value={u.role}
              onChange={(e) => void patch(u.id, { role: e.target.value as adm.AdminUser["role"] })}
            >
              {Object.entries(ROLE_LABEL).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </Select>
            <Button
              variant={u.isBlocked ? "text" : "text-bad"}
              size="sm"
              className="md:w-36"
              onClick={() => void patch(u.id, { isBlocked: !u.isBlocked })}
            >
              {u.isBlocked ? "Разблокировать" : "Заблокировать"}
            </Button>
            <Button
              variant="text"
              size="sm"
              onClick={async () => {
                const email = u.email ?? (await promptDialog("Email для входа:"))?.trim();
                if (!email) return;
                const password = (await promptDialog("Новый пароль (мин. 8 символов):"))?.trim();
                if (!password) return;
                void patch(u.id, { email, password });
              }}
            >
              Выдать пароль
            </Button>
          </Row>
        ))}
      </RowList>
    </section>
  );
}

function CourseList({ onOpen }: { onOpen: (id: number) => void }) {
  const qc = useQueryClient();
  const { data: courses } = useQuery({ queryKey: ["admin", "courses"], queryFn: adm.listCourses });
  const [search, setSearch] = useState("");

  if (!courses) return <Loader />;

  const q = search.trim().toLowerCase();
  const shown = q ? courses.filter((c) => c.title.toLowerCase().includes(q)) : courses;

  const addCourse = async () => {
    const title = (await promptDialog("Название курса:"))?.trim();
    if (!title) return;
    try {
      await adm.createCourse(title);
      await qc.invalidateQueries({ queryKey: ["admin", "courses"] });
    } catch (e) {
      showApiError(e);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-wide">Курсы</h2>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          {courses.length > 0 && <SearchField value={search} onChange={setSearch} className="min-w-0 flex-1 md:w-72 md:flex-none" />}
          <Button variant="tinted" onClick={() => void addCourse()}>
            + Курс
          </Button>
        </div>
      </div>
      {courses.length === 0 && <EmptyState title="Курсов пока нет." />}
      {courses.length > 0 && shown.length === 0 && <EmptyState icon="search" title="Ничего не найдено" />}
      <RowList label="Курсы">
        {shown.map((c) => (
          <Row key={c.id}>
            <Button variant="text" className="min-w-0 flex-1 basis-56 !justify-start text-left font-semibold" onClick={() => onOpen(c.id)}>
              {c.title}
            </Button>
            <Badge tone={c.isPublished ? "good" : "neutral"}>{c.isPublished ? "опубликован" : "черновик"}</Badge>
            <span className="text-sm text-ink-soft md:w-48 md:text-right">
              {c._count.modules} модул., {c._count.cohorts} поток(а)
            </span>
          </Row>
        ))}
      </RowList>
    </section>
  );
}

function CohortSection() {
  const qc = useQueryClient();
  const { data: cohorts } = useQuery({ queryKey: ["admin", "cohorts"], queryFn: adm.listCohorts });
  const { data: courses } = useQuery({ queryKey: ["admin", "courses"], queryFn: adm.listCourses });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "cohorts"] });

  const addMember = async (c: adm.AdminCohort) => {
    const who = (await promptDialog("Email или Telegram username ученика (он должен уже войти на платформу):"))?.trim();
    if (!who) return;
    const member = who.includes("@") && !who.startsWith("@")
      ? { email: who }
      : { tgUsername: who.replace(/^@/, "") };
    try {
      await adm.addCohortMember(c.id, member);
      await invalidate();
    } catch (e) {
      showApiError(e);
    }
  };

  // ADMIN-06: рассылка потоку через TG-бота
  const broadcast = async (c: adm.AdminCohort) => {
    const text = (await promptDialog(`Текст рассылки потоку «${c.title}» (уйдёт в Telegram всем ученикам):`))?.trim();
    if (!text) return;
    if (!(await confirmDialog(`Отправить ${c._count.members} ученикам?`))) return;
    try {
      const r = await adm.broadcastToCohort(c.id, text);
      await alertDialog(`Рассылка запущена: ${r.accepted} из ${r.total} получат сообщение (остальные без Telegram, на /mute или заблокированы).`);
    } catch (e) {
      showApiError(e);
    }
  };

  const addCohort = async () => {
    if (!courses?.length) return;
    const list = courses.map((c) => `${c.id} — ${c.title}`).join("\n");
    const raw = (await promptDialog(`id курса:\n${list}`))?.trim();
    const cid = Number(raw);
    if (!raw || !Number.isInteger(cid)) return;
    const title = (await promptDialog("Название потока (например «Поток 1 — сентябрь 2026»):"))?.trim();
    if (!title) return;
    const start = (await promptDialog("Дата старта (ГГГГ-ММ-ДД):", "2026-09-01"))?.trim();
    if (!start) return;
    try {
      await adm.createCohort(cid, title, start);
      await invalidate();
    } catch (e) {
      showApiError(e);
    }
  };

  if (!cohorts) return <Loader />;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold tracking-wide">Потоки</h2>
        <Button variant="tinted" disabled={!courses?.length} onClick={() => void addCohort()}>
          + Поток
        </Button>
      </div>
      {cohorts.length === 0 && <EmptyState icon="users" title="Потоков пока нет." />}
      <RowList label="Потоки">
        {cohorts.map((c) => (
          <Row key={c.id}>
            <div className="min-w-0 flex-1 basis-56">
              <p className="font-medium">{c.title}</p>
              <p className="text-sm text-ink-soft">
                курс: {c.course.title} · старт {new Date(c.startDate).toLocaleDateString("ru")} ·{" "}
                {c._count.members} уч.
              </p>
            </div>
            <Button variant="text" size="sm" onClick={() => void addMember(c)}>
              + Ученик
            </Button>
            <Button variant="text" size="sm" onClick={() => void broadcast(c)}>
              <Icon name="send" size={16} /> Рассылка
            </Button>
          </Row>
        ))}
      </RowList>
    </section>
  );
}
