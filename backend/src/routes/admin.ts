// Панель администратора (п.3.10). Всё под requireRole("ADMIN").
// M2: ADMIN-02 (CRUD курсов/модулей/уроков/блоков, порядок, публикация) + минимум
// ADMIN-03/04 (потоки и зачисление), без них не проверить доступ по потокам (COURSE-05).
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { Router } from "express";
import type { Response } from "express";
import pino from "pino";
import { z } from "zod";

import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errors.js";
import { buildReorderUpdates, ReorderError } from "../services/ordering.js";
import { sendTelegramMessage } from "../services/telegram.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

const broadcastLog = pino({ name: "broadcast" });

/** id из пути: положительное целое, иначе null. */
function paramId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function badRequest(res: Response, msg: string): void {
  res.status(400).json({ error: msg });
}

/**
 * .catch(onRecordNotFound) для update/delete: превращает ТОЛЬКО P2025 (запись не найдена)
 * в null → роут отвечает 404. Любые другие ошибки БД пробрасываем в errorHandler,
 * чтобы они логировались, а не маскировались под 404.
 */
function onRecordNotFound(e: unknown): null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return null;
  throw e;
}

// ---------- ADMIN-02: курсы ----------

const courseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  coverUrl: z.string().url().max(500).nullable().optional(),
});

adminRouter.get("/courses", asyncHandler(async (_req, res) => {
  const courses = await prisma.course.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { modules: true, cohorts: true } } },
  });
  res.json(courses);
}));

// Полная структура курса для редактора: модули → уроки → блоки, всё по order_index
adminRouter.get("/courses/:courseId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.courseId);
  if (!id) return badRequest(res, "некорректный id");
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lessons: {
            orderBy: { orderIndex: "asc" },
            include: {
              blocks: { orderBy: { orderIndex: "asc" } },
              tasks: { select: { id: true, title: true, deadline: true } },
              tests: { select: { id: true, title: true, _count: { select: { questions: true } } } },
            },
          },
        },
      },
    },
  });
  if (!course) {
    res.status(404).json({ error: "курс не найден" });
    return;
  }
  res.json(course);
}));

adminRouter.post("/courses", asyncHandler(async (req, res) => {
  const parsed = courseSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужен title (до 200 символов)");
  const course = await prisma.course.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? "",
      coverUrl: parsed.data.coverUrl ?? null,
    },
  });
  res.status(201).json(course);
}));

adminRouter.patch("/courses/:courseId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.courseId);
  if (!id) return badRequest(res, "некорректный id");
  const parsed = courseSchema.partial().extend({ isPublished: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return badRequest(res, "некорректные поля курса");
  const course = await prisma.course.update({ where: { id }, data: parsed.data }).catch(onRecordNotFound);
  if (!course) {
    res.status(404).json({ error: "курс не найден" });
    return;
  }
  res.json(course);
}));

adminRouter.delete("/courses/:courseId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.courseId);
  if (!id) return badRequest(res, "некорректный id");
  const counts = await prisma.course.findUnique({
    where: { id },
    include: { _count: { select: { modules: true, cohorts: true } } },
  });
  if (!counts) {
    res.status(404).json({ error: "курс не найден" });
    return;
  }
  // Не каскадим: у курса с потоками/модулями есть данные учеников — удалять только пустой
  if (counts._count.modules > 0 || counts._count.cohorts > 0) {
    res.status(409).json({ error: "сначала удали модули и потоки курса" });
    return;
  }
  await prisma.course.delete({ where: { id } });
  res.json({ ok: true });
}));

// ---------- ADMIN-02: модули ----------

const moduleCreateSchema = z.object({
  courseId: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
});

adminRouter.post("/modules", asyncHandler(async (req, res) => {
  const parsed = moduleCreateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужны courseId и title");
  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) {
    res.status(404).json({ error: "курс не найден" });
    return;
  }
  const last = await prisma.module.aggregate({
    where: { courseId: parsed.data.courseId },
    _max: { orderIndex: true },
  });
  const mod = await prisma.module.create({
    data: { ...parsed.data, orderIndex: (last._max.orderIndex ?? -1) + 1 },
  });
  res.status(201).json(mod);
}));

adminRouter.patch("/modules/:moduleId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.moduleId);
  if (!id) return badRequest(res, "некорректный id");
  const parsed = z.object({ title: z.string().trim().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужен title");
  const mod = await prisma.module.update({ where: { id }, data: parsed.data }).catch(onRecordNotFound);
  if (!mod) {
    res.status(404).json({ error: "модуль не найден" });
    return;
  }
  res.json(mod);
}));

adminRouter.delete("/modules/:moduleId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.moduleId);
  if (!id) return badRequest(res, "некорректный id");
  const mod = await prisma.module.findUnique({
    where: { id },
    include: { _count: { select: { lessons: true } } },
  });
  if (!mod) {
    res.status(404).json({ error: "модуль не найден" });
    return;
  }
  if (mod._count.lessons > 0) {
    res.status(409).json({ error: "сначала удали уроки модуля" });
    return;
  }
  await prisma.module.delete({ where: { id } });
  res.json({ ok: true });
}));

// ---------- ADMIN-02: уроки ----------

const lessonCreateSchema = z.object({
  moduleId: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
});

adminRouter.post("/lessons", asyncHandler(async (req, res) => {
  const parsed = lessonCreateSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужны moduleId и title");
  const mod = await prisma.module.findUnique({ where: { id: parsed.data.moduleId } });
  if (!mod) {
    res.status(404).json({ error: "модуль не найден" });
    return;
  }
  const last = await prisma.lesson.aggregate({
    where: { moduleId: parsed.data.moduleId },
    _max: { orderIndex: true },
  });
  const lesson = await prisma.lesson.create({
    data: { ...parsed.data, orderIndex: (last._max.orderIndex ?? -1) + 1 },
  });
  res.status(201).json(lesson);
}));

adminRouter.patch("/lessons/:lessonId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.lessonId);
  if (!id) return badRequest(res, "некорректный id");
  const parsed = z.object({ title: z.string().trim().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужен title");
  const lesson = await prisma.lesson.update({ where: { id }, data: parsed.data }).catch(onRecordNotFound);
  if (!lesson) {
    res.status(404).json({ error: "урок не найден" });
    return;
  }
  res.json(lesson);
}));

adminRouter.delete("/lessons/:lessonId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.lessonId);
  if (!id) return badRequest(res, "некорректный id");
  const lesson = await prisma.lesson.findUnique({
    where: { id },
    include: { _count: { select: { tasks: true, tests: true, progress: true } } },
  });
  if (!lesson) {
    res.status(404).json({ error: "урок не найден" });
    return;
  }
  const c = lesson._count;
  // Прогресс/задания/тесты — данные учеников, молча не удаляем
  if (c.tasks > 0 || c.tests > 0 || c.progress > 0) {
    res.status(409).json({ error: "у урока есть задания/тесты/прогресс — удаление заблокировано" });
    return;
  }
  await prisma.$transaction([
    prisma.lessonBlock.deleteMany({ where: { lessonId: id } }),
    prisma.lesson.delete({ where: { id } }),
  ]);
  res.json({ ok: true });
}));

// ---------- ADMIN-02: блоки контента (COURSE-03) ----------

// video: id ролика Kinescope; text: markdown (рендер и санитайз на фронте); pdf: URL/s3-ключ
const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("VIDEO"), content: z.string().regex(/^[\w-]{1,100}$/, "id ролика Kinescope") }),
  z.object({ type: z.literal("TEXT"), content: z.string().min(1).max(50_000) }),
  z.object({ type: z.literal("PDF"), content: z.string().min(1).max(500) }),
]);

adminRouter.post("/lessons/:lessonId/blocks", asyncHandler(async (req, res) => {
  const lessonId = paramId(req.params.lessonId);
  if (!lessonId) return badRequest(res, "некорректный id");
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужны type (VIDEO/TEXT/PDF) и корректный content");
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    res.status(404).json({ error: "урок не найден" });
    return;
  }
  const last = await prisma.lessonBlock.aggregate({ where: { lessonId }, _max: { orderIndex: true } });
  const block = await prisma.lessonBlock.create({
    data: { lessonId, ...parsed.data, orderIndex: (last._max.orderIndex ?? -1) + 1 },
  });
  res.status(201).json(block);
}));

adminRouter.patch("/blocks/:blockId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.blockId);
  if (!id) return badRequest(res, "некорректный id");
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужны type и корректный content");
  const block = await prisma.lessonBlock.update({ where: { id }, data: parsed.data }).catch(onRecordNotFound);
  if (!block) {
    res.status(404).json({ error: "блок не найден" });
    return;
  }
  res.json(block);
}));

adminRouter.delete("/blocks/:blockId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.blockId);
  if (!id) return badRequest(res, "некорректный id");
  const block = await prisma.lessonBlock.delete({ where: { id } }).catch(onRecordNotFound);
  if (!block) {
    res.status(404).json({ error: "блок не найден" });
    return;
  }
  res.json({ ok: true });
}));

// ---------- ADMIN-02: порядок (drag-and-drop) ----------

const reorderSchema = z.object({
  entity: z.enum(["modules", "lessons", "blocks"]),
  ids: z.array(z.number().int().positive()).min(1).max(500),
});

// Принимает ПОЛНЫЙ список id одного родителя в новом порядке
adminRouter.post("/reorder", asyncHandler(async (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужны entity (modules/lessons/blocks) и ids");
  const { entity, ids } = parsed.data;

  // Родителя определяем по первому id, siblings берём из БД — клиенту не верим
  let rows: { id: number; parentId: number }[];
  if (entity === "modules") {
    const first = await prisma.module.findUnique({ where: { id: ids[0] } });
    if (!first) return badRequest(res, "элемент не найден");
    rows = (await prisma.module.findMany({ where: { courseId: first.courseId } })).map((m) => ({
      id: m.id,
      parentId: m.courseId,
    }));
  } else if (entity === "lessons") {
    const first = await prisma.lesson.findUnique({ where: { id: ids[0] } });
    if (!first) return badRequest(res, "элемент не найден");
    rows = (await prisma.lesson.findMany({ where: { moduleId: first.moduleId } })).map((l) => ({
      id: l.id,
      parentId: l.moduleId,
    }));
  } else {
    const first = await prisma.lessonBlock.findUnique({ where: { id: ids[0] } });
    if (!first) return badRequest(res, "элемент не найден");
    rows = (await prisma.lessonBlock.findMany({ where: { lessonId: first.lessonId } })).map((b) => ({
      id: b.id,
      parentId: b.lessonId,
    }));
  }

  let updates;
  try {
    updates = buildReorderUpdates(rows, ids);
  } catch (e) {
    if (e instanceof ReorderError) return badRequest(res, e.message);
    throw e;
  }

  const table = { modules: prisma.module, lessons: prisma.lesson, blocks: prisma.lessonBlock }[entity];
  await prisma.$transaction(
    // @ts-expect-error -- delegate-тип у трёх моделей разный, но update({where:{id},data:{orderIndex}}) общий
    updates.map((u) => table.update({ where: { id: u.id }, data: { orderIndex: u.orderIndex } })),
  );
  res.json({ ok: true });
}));

// ---------- задания и тесты урока (для M3: TASK-01, TEST-01) ----------

const taskSchema = z.object({
  lessonId: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000).default(""),
  deadline: z.coerce.date().nullable().optional(),
});

adminRouter.post("/tasks", asyncHandler(async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужны lessonId, title");
  const lesson = await prisma.lesson.findUnique({ where: { id: parsed.data.lessonId } });
  if (!lesson) {
    res.status(404).json({ error: "урок не найден" });
    return;
  }
  const task = await prisma.task.create({ data: parsed.data });
  res.status(201).json(task);
}));

adminRouter.patch("/tasks/:taskId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.taskId);
  if (!id) return badRequest(res, "некорректный id");
  const parsed = taskSchema.omit({ lessonId: true }).partial().safeParse(req.body);
  if (!parsed.success) return badRequest(res, "некорректные поля задания");
  const task = await prisma.task.update({ where: { id }, data: parsed.data }).catch(onRecordNotFound);
  if (!task) {
    res.status(404).json({ error: "задание не найдено" });
    return;
  }
  res.json(task);
}));

adminRouter.delete("/tasks/:taskId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.taskId);
  if (!id) return badRequest(res, "некорректный id");
  const task = await prisma.task.findUnique({
    where: { id },
    include: { _count: { select: { submissions: true } } },
  });
  if (!task) {
    res.status(404).json({ error: "задание не найдено" });
    return;
  }
  if (task._count.submissions > 0) {
    res.status(409).json({ error: "по заданию уже есть сдачи — удаление заблокировано" });
    return;
  }
  await prisma.task.delete({ where: { id } });
  res.json({ ok: true });
}));

// Тест создаётся/заменяется целиком с вопросами и вариантами — так проще держать
// консистентность (у SINGLE ровно один правильный, у MULTIPLE хотя бы один)
const testQuestionSchema = z
  .object({
    type: z.enum(["SINGLE", "MULTIPLE", "OPEN"]),
    text: z.string().trim().min(1).max(5000),
    explanation: z.string().max(5000).default(""),
    answers: z
      .array(z.object({ text: z.string().trim().min(1).max(1000), isCorrect: z.boolean() }))
      .max(20)
      .default([]),
  })
  .refine(
    (q) =>
      q.type === "OPEN"
        ? q.answers.length === 0
        : q.answers.length >= 2 &&
          (q.type === "SINGLE"
            ? q.answers.filter((a) => a.isCorrect).length === 1
            : q.answers.some((a) => a.isCorrect)),
    { message: "у SINGLE ровно один правильный вариант, у MULTIPLE — хотя бы один, у OPEN вариантов нет" },
  );

const testSchema = z.object({
  lessonId: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  questions: z.array(testQuestionSchema).min(1).max(100),
});

/** Создать вопросы и варианты теста. */
function questionCreates(testId: number, questions: z.infer<typeof testSchema>["questions"]) {
  return questions.map((q, qi) =>
    prisma.testQuestion.create({
      data: {
        testId,
        type: q.type,
        text: q.text,
        explanation: q.explanation,
        orderIndex: qi,
        answers: { create: q.answers },
      },
    }),
  );
}

adminRouter.get("/tests/:testId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.testId);
  if (!id) return badRequest(res, "некорректный id");
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { orderIndex: "asc" }, include: { answers: true } },
      _count: { select: { attempts: true } },
    },
  });
  if (!test) {
    res.status(404).json({ error: "тест не найден" });
    return;
  }
  res.json(test);
}));

adminRouter.post("/tests", asyncHandler(async (req, res) => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, parsed.error.issues[0]?.message ?? "некорректный тест");
  }
  const lesson = await prisma.lesson.findUnique({ where: { id: parsed.data.lessonId } });
  if (!lesson) {
    res.status(404).json({ error: "урок не найден" });
    return;
  }
  const test = await prisma.test.create({
    data: { lessonId: parsed.data.lessonId, title: parsed.data.title },
  });
  await prisma.$transaction(questionCreates(test.id, parsed.data.questions));
  res.status(201).json({ id: test.id });
}));

// Полная замена вопросов; заблокирована, если по тесту уже есть попытки
adminRouter.put("/tests/:testId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.testId);
  if (!id) return badRequest(res, "некорректный id");
  const parsed = testSchema.omit({ lessonId: true }).safeParse(req.body);
  if (!parsed.success) {
    return badRequest(res, parsed.error.issues[0]?.message ?? "некорректный тест");
  }
  const test = await prisma.test.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });
  if (!test) {
    res.status(404).json({ error: "тест не найден" });
    return;
  }
  if (test._count.attempts > 0) {
    res.status(409).json({ error: "по тесту уже есть попытки — правка заблокирована" });
    return;
  }
  await prisma.$transaction([
    prisma.testAnswer.deleteMany({ where: { question: { testId: id } } }),
    prisma.testQuestion.deleteMany({ where: { testId: id } }),
    prisma.test.update({ where: { id }, data: { title: parsed.data.title } }),
    ...questionCreates(id, parsed.data.questions),
  ]);
  res.json({ ok: true });
}));

adminRouter.delete("/tests/:testId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.testId);
  if (!id) return badRequest(res, "некорректный id");
  const test = await prisma.test.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });
  if (!test) {
    res.status(404).json({ error: "тест не найден" });
    return;
  }
  if (test._count.attempts > 0) {
    res.status(409).json({ error: "по тесту уже есть попытки — удаление заблокировано" });
    return;
  }
  await prisma.$transaction([
    prisma.testAnswer.deleteMany({ where: { question: { testId: id } } }),
    prisma.testQuestion.deleteMany({ where: { testId: id } }),
    prisma.test.delete({ where: { id } }),
  ]);
  res.json({ ok: true });
}));

// ---------- ADMIN-03/04: потоки и зачисление ----------

const cohortSchema = z.object({
  courseId: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  tgChatUrl: z.string().url().max(500).nullable().optional(),
});

adminRouter.get("/cohorts", asyncHandler(async (_req, res) => {
  const cohorts = await prisma.cohort.findMany({
    orderBy: { id: "asc" },
    include: { course: { select: { title: true } }, _count: { select: { members: true } } },
  });
  res.json(cohorts);
}));

adminRouter.post("/cohorts", asyncHandler(async (req, res) => {
  const parsed = cohortSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужны courseId, title, startDate");
  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
  if (!course) {
    res.status(404).json({ error: "курс не найден" });
    return;
  }
  const cohort = await prisma.cohort.create({ data: parsed.data });
  res.status(201).json(cohort);
}));

// ADMIN-04: добавить ученика по email или Telegram username
const memberSchema = z
  .object({ email: z.string().email().optional(), tgUsername: z.string().min(1).max(64).optional() })
  .refine((d) => d.email || d.tgUsername, { message: "нужен email или tgUsername" });

adminRouter.post("/cohorts/:cohortId/members", asyncHandler(async (req, res) => {
  const cohortId = paramId(req.params.cohortId);
  if (!cohortId) return badRequest(res, "некорректный id");
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужен email или tgUsername");

  const cohort = await prisma.cohort.findUnique({ where: { id: cohortId } });
  if (!cohort) {
    res.status(404).json({ error: "поток не найден" });
    return;
  }
  const { email, tgUsername } = parsed.data;
  const user = await prisma.user.findFirst({
    where: email ? { email } : { tgUsername: { equals: tgUsername, mode: "insensitive" } },
  });
  if (!user) {
    res.status(404).json({ error: "пользователь не найден — он должен сначала войти на платформу" });
    return;
  }
  await prisma.cohortMember.upsert({
    where: { cohortId_userId: { cohortId, userId: user.id } },
    create: { cohortId, userId: user.id },
    update: {},
  });
  res.status(201).json({ ok: true, userId: user.id });
}));

// ---------- ADMIN-01: пользователи ----------

adminRouter.get("/users", asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      tgUsername: true,
      role: true,
      isBlocked: true,
      lastSeenAt: true,
      cohorts: { select: { cohort: { select: { id: true, title: true } } } },
    },
  });
  res.json(users.map((u) => ({ ...u, cohorts: u.cohorts.map((c) => c.cohort) })));
}));

const userPatchSchema = z
  .object({
    role: z.enum(["STUDENT", "TEACHER", "ADMIN"]).optional(),
    isBlocked: z.boolean().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().email().nullable().optional(),
    // выдача пароля для резервного входа (AUTH-02); публичной регистрации нет
    password: z.string().min(8).max(200).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "пустой запрос" });

adminRouter.patch("/users/:userId", asyncHandler(async (req, res) => {
  const id = paramId(req.params.userId);
  if (!id) return badRequest(res, "некорректный id");
  const parsed = userPatchSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "некорректные поля пользователя");

  // Себя не блокируем и роль себе не снимаем — иначе можно остаться без админа
  if (id === req.user!.id && (parsed.data.isBlocked || (parsed.data.role && parsed.data.role !== "ADMIN"))) {
    return badRequest(res, "нельзя заблокировать или разжаловать самого себя");
  }

  const { password, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 12); // bcrypt cost 12 (п.4.2)

  let user;
  try {
    user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isBlocked: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        res.status(404).json({ error: "пользователь не найден" });
        return;
      }
      if (e.code === "P2002") {
        // конфликт уникальности email — не маскируем под 404
        res.status(409).json({ error: "этот email уже занят другим пользователем" });
        return;
      }
    }
    throw e; // прочие ошибки БД — в errorHandler (логируются)
  }
  res.json(user);
}));

// ---------- ADMIN-05: дашборд ----------

adminRouter.get("/dashboard", asyncHandler(async (_req, res) => {
  const now = Date.now();
  const dayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);

  const [dau, weeklyActive, pendingSubmissions, totalStudents] = await Promise.all([
    prisma.user.count({ where: { lastSeenAt: { gte: dayStart } } }),
    prisma.user.count({ where: { lastSeenAt: { gte: weekAgo } } }),
    prisma.taskSubmission.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
  ]);
  res.json({ dau, weeklyActive, pendingSubmissions, totalStudents });
}));

// ---------- ADMIN-06: рассылка потоку через TG-бота ----------

const broadcastSchema = z.object({ text: z.string().trim().min(1).max(4000) });

adminRouter.post("/cohorts/:cohortId/broadcast", asyncHandler(async (req, res) => {
  const cohortId = paramId(req.params.cohortId);
  if (!cohortId) return badRequest(res, "некорректный id");
  const parsed = broadcastSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "нужен text (до 4000 символов)");

  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    include: {
      members: {
        select: { user: { select: { id: true, telegramId: true, notifyMuted: true, isBlocked: true } } },
      },
    },
  });
  if (!cohort) {
    res.status(404).json({ error: "поток не найден" });
    return;
  }

  // Кому реально уйдёт: есть telegramId, не /mute, не заблокирован (NOTIF-04)
  const recipients = cohort.members
    .map((m) => m.user)
    .filter((u) => u.telegramId && !u.notifyMuted && !u.isBlocked)
    .map((u) => u.telegramId!);

  // Отвечаем сразу: рассылка идёт в фоне (иначе запрос висел бы минуты и упирался
  // в таймаут прокси, а повторный клик слал бы дубли). Итог — в серверный лог.
  res.json({ accepted: recipients.length, total: cohort.members.length });
  void runBroadcast(cohortId, parsed.data.text, recipients);
}));

/** Фоновая рассылка с паузой 50 мс между сообщениями (лимит Bot API ~30/с). */
async function runBroadcast(cohortId: number, text: string, recipients: bigint[]): Promise<void> {
  let sent = 0;
  for (const telegramId of recipients) {
    if (await sendTelegramMessage(telegramId, text)) sent += 1;
    await new Promise((r) => setTimeout(r, 50));
  }
  broadcastLog.info({ cohortId, sent, total: recipients.length }, "рассылка потоку завершена");
}
