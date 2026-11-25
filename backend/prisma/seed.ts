// Демо-данные для локальной разработки, QA по критериям приёмки и нагрузочного теста.
// Запуск: npm run seed. Идемпотентен — повторный запуск не плодит дубли.
// Число учеников: SEED_STUDENTS (для нагрузочного теста — 500).
// Пароль всех демо-аккаунтов: SEED_PASSWORD (по умолчанию demo-пароль ниже).
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COURSE_TITLE = "Демо-курс NEXU";
const STUDENTS = Number(process.env.SEED_STUDENTS ?? 5);
const PASSWORD = process.env.SEED_PASSWORD ?? "demo-nexu-2026";

/** Демо-данные — только не на проде: там реальные ученики и ПДн. */
function assertNotProduction(): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED_PROD !== "1") {
    throw new Error("seed на проде запрещён (ALLOW_SEED_PROD=1, если это осознанно)");
  }
}

async function main(): Promise<void> {
  assertNotProduction();

  // Один хеш на все демо-аккаунты: 500 вызовов bcrypt cost 12 — это минуты
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@nexu.local" },
    update: {},
    create: { email: "admin@nexu.local", name: "Диана (админ)", role: "ADMIN", passwordHash },
  });
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@nexu.local" },
    update: {},
    create: { email: "teacher@nexu.local", name: "Преподаватель", role: "TEACHER", passwordHash },
  });

  const students = [];
  for (let i = 1; i <= STUDENTS; i++) {
    students.push(
      await prisma.user.upsert({
        where: { email: `student${i}@nexu.local` },
        update: {},
        create: { email: `student${i}@nexu.local`, name: `Ученик ${i}`, passwordHash },
      }),
    );
  }

  let course = await prisma.course.findFirst({ where: { title: COURSE_TITLE } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        title: COURSE_TITLE,
        description: "Демонстрационный курс: видео-заглушка, текст, задание и тест.",
        isPublished: true,
      },
    });

    const intro = await prisma.module.create({
      data: { courseId: course.id, title: "Модуль 1. Введение", orderIndex: 0 },
    });
    const practice = await prisma.module.create({
      data: { courseId: course.id, title: "Модуль 2. Практика", orderIndex: 1 },
    });

    // Урок 1: видео (id demo-* → плеер-заглушка) + текст
    const lesson1 = await prisma.lesson.create({
      data: { moduleId: intro.id, title: "Как устроена платформа", orderIndex: 0 },
    });
    await prisma.lessonBlock.createMany({
      data: [
        { lessonId: lesson1.id, type: "VIDEO", content: "demo-lesson-1", orderIndex: 0 },
        {
          lessonId: lesson1.id,
          type: "TEXT",
          content:
            "## Что дальше\n\nПосмотри видео на **80%** — тогда откроется кнопка «Завершить урок».\n\n" +
            "Следующие уроки открываются по порядку.",
          orderIndex: 1,
        },
      ],
    });

    // Урок 2: задание с дедлайном через неделю
    const lesson2 = await prisma.lesson.create({
      data: { moduleId: intro.id, title: "Первое задание", orderIndex: 1 },
    });
    await prisma.lessonBlock.create({
      data: {
        lessonId: lesson2.id,
        type: "TEXT",
        content: "Напиши эссе на 200–300 слов. Можно текстом в форме или файлом .docx / .pdf / .txt.",
        orderIndex: 0,
      },
    });
    await prisma.task.create({
      data: {
        lessonId: lesson2.id,
        title: "Эссе: зачем мне этот курс",
        description: "200–300 слов. Принимаются .docx, .pdf, .txt до 10 МБ или текст в форме.",
        deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    // Урок 3: тест из трёх типов вопросов
    const lesson3 = await prisma.lesson.create({
      data: { moduleId: practice.id, title: "Проверь себя", orderIndex: 0 },
    });
    await prisma.lessonBlock.create({
      data: { lessonId: lesson3.id, type: "TEXT", content: "Небольшой тест по модулю 1.", orderIndex: 0 },
    });
    const test = await prisma.test.create({
      data: { lessonId: lesson3.id, title: "Тест по модулю 1" },
    });
    const q1 = await prisma.testQuestion.create({
      data: {
        testId: test.id,
        type: "SINGLE",
        text: "На сколько процентов нужно посмотреть видео, чтобы урок засчитался?",
        explanation: "Порог просмотра — 80%.",
        orderIndex: 0,
      },
    });
    await prisma.testAnswer.createMany({
      data: [
        { questionId: q1.id, text: "50%", isCorrect: false },
        { questionId: q1.id, text: "80%", isCorrect: true },
        { questionId: q1.id, text: "100%", isCorrect: false },
      ],
    });
    const q2 = await prisma.testQuestion.create({
      data: {
        testId: test.id,
        type: "MULTIPLE",
        text: "Какие форматы файлов принимает задание?",
        explanation: "docx, pdf и txt до 10 МБ.",
        orderIndex: 1,
      },
    });
    await prisma.testAnswer.createMany({
      data: [
        { questionId: q2.id, text: ".docx", isCorrect: true },
        { questionId: q2.id, text: ".pdf", isCorrect: true },
        { questionId: q2.id, text: ".txt", isCorrect: true },
        { questionId: q2.id, text: ".exe", isCorrect: false },
      ],
    });
    await prisma.testQuestion.create({
      data: {
        testId: test.id,
        type: "OPEN",
        text: "Что было непонятно в первом модуле?",
        explanation: "Открытый вопрос — в балл не идёт, его читает преподаватель.",
        orderIndex: 2,
      },
    });
  }

  let cohort = await prisma.cohort.findFirst({ where: { courseId: course.id } });
  cohort ??= await prisma.cohort.create({
    data: {
      courseId: course.id,
      title: "Поток сентябрь 2026",
      startDate: new Date("2026-09-01T00:00:00Z"),
    },
  });

  // Зачисляем всех демо-пользователей в поток (преподаватель и админ — для проверки своих экранов)
  await prisma.cohortMember.createMany({
    data: [admin, teacher, ...students].map((u) => ({ cohortId: cohort.id, userId: u.id })),
    skipDuplicates: true,
  });

  console.log(
    `Готово: курс «${COURSE_TITLE}», поток «${cohort.title}», ` +
      `${students.length} учеников. Вход: admin@nexu.local / teacher@nexu.local / student1@nexu.local, ` +
      `пароль — SEED_PASSWORD (по умолчанию «${PASSWORD}»).`,
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
