// Страница теста (п.3.5, экран п.6.2): вопросы карточками, прогресс-бар,
// после сдачи — балл и разбор: верно/неверно, правильные ответы, объяснения.
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ApiError } from "../api/client";
import type { AttemptAnswers, AttemptResult, TestQuestion } from "../api/tests";
import { getTest, submitAttempt } from "../api/tests";
import { showApiError } from "../components/admin/errors";
import Badge from "../components/ui/Badge";
import Button, { LinkButton } from "../components/ui/Button";
import { confirmDialog } from "../components/ui/dialogs";
import { Textarea } from "../components/ui/Field";
import Icon from "../components/ui/Icon";
import Panel from "../components/ui/Panel";
import ProgressBar from "../components/ui/ProgressBar";
import { EmptyState, Loader } from "../components/ui/States";

export default function Test() {
  const { testId } = useParams();
  const id = Number(testId);

  const { data: test, error, isLoading } = useQuery({
    queryKey: ["test", id],
    queryFn: () => getTest(id),
    enabled: Number.isInteger(id) && id > 0,
    retry: (count, err) => !(err instanceof ApiError) && count < 2,
  });

  const [answers, setAnswers] = useState<AttemptAnswers>({});
  const [result, setResult] = useState<AttemptResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => submitAttempt(id, answers),
    onSuccess: (r) => {
      setResult(r);
      window.scrollTo({ top: 0 }); // разбор начинается с итога вверху страницы
    },
    onError: showApiError,
  });

  if (isLoading) return <Loader />;
  if (error instanceof ApiError || !test) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          icon="test"
          title="Тест недоступен."
          action={
            <LinkButton to="/" variant="tinted">
              <Icon name="arrow-left" /> к курсу
            </LinkButton>
          }
        />
      </div>
    );
  }

  const answered = test.questions.filter((q) => {
    const a = answers[String(q.id)];
    return Array.isArray(a) ? a.length > 0 : Boolean(a && a.trim());
  }).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <Link className="link inline-flex min-h-[44px] items-center gap-1.5 text-sm" to={`/lessons/${test.lessonId}`}>
          <Icon name="arrow-left" size={16} /> к уроку
        </Link>
        <p className="hud-label mt-1 text-holo">Тест</p>
        <h1 className="mt-2 break-words font-display text-[clamp(1.75rem,5vw,2.5rem)] font-extrabold leading-tight text-crawl">
          {test.title}
        </h1>
        {test.lastAttempt && !result && (
          <p className="mt-2 text-sm text-ink-soft">
            Последняя попытка: {test.lastAttempt.score} из {test.lastAttempt.maxScore} (
            {new Date(test.lastAttempt.finishedAt).toLocaleString("ru")})
          </p>
        )}
      </header>

      {!result && (
        <>
          {/* Прогресс-бар по отвеченным вопросам (п.6.2); прилипает под шапкой, чтобы не терялся в длинном тесте */}
          <div className="sticky top-[60px] z-20 -mx-4 border-b border-line/70 bg-space/95 px-4 py-3 md:mx-0 md:rounded-ctl md:border md:px-4">
            <ProgressBar
              value={test.questions.length ? (answered / test.questions.length) * 100 : 0}
              label="Отвечено вопросов"
            />
            <p className="mt-2 text-sm text-ink-soft">
              {answered} из {test.questions.length} вопросов
            </p>
          </div>

          {test.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              index={i}
              question={q}
              value={answers[String(q.id)]}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [String(q.id)]: v }))}
            />
          ))}

          <Button
            size="lg"
            className="w-full md:w-auto"
            disabled={mutation.isPending}
            onClick={async () => {
              if (answered < test.questions.length && !(await confirmDialog("Есть вопросы без ответа. Сдать как есть?"))) return;
              mutation.mutate();
            }}
          >
            {mutation.isPending ? "Проверка…" : "Завершить тест"}
          </Button>
        </>
      )}

      {result && <ResultView test={{ questions: test.questions }} answers={answers} result={result} />}
    </div>
  );
}

function QuestionCard({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: TestQuestion;
  value: number[] | string | undefined;
  onChange: (v: number[] | string) => void;
}) {
  const chosen = Array.isArray(value) ? value : [];
  const legendId = `q-${question.id}-text`;

  return (
    <Panel as="fieldset" className="min-w-0 space-y-2">
      <legend id={legendId} className="float-left w-full pb-3 font-medium leading-snug">
        <span className="mr-2 font-display font-bold text-holo">{index + 1}.</span>
        {question.text}
      </legend>
      {question.type === "MULTIPLE" && <p className="clear-both text-sm text-ink-mute">Можно выбрать несколько вариантов</p>}

      {question.type === "OPEN" ? (
        <Textarea
          className="clear-both"
          rows={4}
          placeholder="Твой ответ"
          aria-labelledby={legendId}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="clear-both space-y-2">
          {question.answers.map((a) => (
            <label
              key={a.id}
              className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-ctl border border-line bg-space/70 px-3 py-2 transition-colors duration-150 hover:border-holo/50 has-[:checked]:border-holo has-[:checked]:bg-holo/[0.1] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-holo"
            >
              <input
                type={question.type === "SINGLE" ? "radio" : "checkbox"}
                name={`q-${question.id}`}
                className="outline-none"
                checked={chosen.includes(a.id)}
                onChange={() =>
                  onChange(
                    question.type === "SINGLE"
                      ? [a.id]
                      : chosen.includes(a.id)
                        ? chosen.filter((x) => x !== a.id)
                        : [...chosen, a.id],
                  )
                }
              />
              {a.text}
            </label>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ResultView({
  test,
  answers,
  result,
}: {
  test: { questions: TestQuestion[] };
  answers: AttemptAnswers;
  result: AttemptResult;
}) {
  return (
    <div className="space-y-4">
      <Panel tone="holo" pad="lg" className="flex flex-wrap items-center justify-between gap-4" role="status">
        <div>
          <p className="hud-label">Результат</p>
          <p className="mt-1 font-display text-3xl font-extrabold">
            Результат: {result.score} из {result.maxScore}
          </p>
        </div>
        {result.xpGranted > 0 && (
          <p className="flex items-center gap-1.5 font-display text-2xl font-bold text-crawl">
            <Icon name="bolt" size={22} />+{result.xpGranted} XP
          </p>
        )}
        <ProgressBar
          value={result.maxScore ? (result.score / result.maxScore) * 100 : 0}
          tone="crawl"
          label="Доля верных ответов"
          className="basis-full"
        />
      </Panel>

      {test.questions.map((q, i) => {
        const r = result.review.find((x) => x.questionId === q.id);
        const chosen = answers[String(q.id)];
        return (
          <Panel
            key={q.id}
            tone={r?.correct === true ? "good" : r?.correct === false ? "bad" : "default"}
            className="space-y-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <p className="min-w-0 flex-1 basis-60 font-medium leading-snug">
                <span className="mr-2 font-display font-bold text-holo">{i + 1}.</span>
                {q.text}
              </p>
              {r?.correct === true && <Badge tone="good"><Icon name="check" size={14} /> верно</Badge>}
              {r?.correct === false && <Badge tone="bad"><Icon name="cross" size={14} /> неверно</Badge>}
              {r?.correct === null && <Badge>проверит преподаватель</Badge>}
            </div>
            {q.type !== "OPEN" && (
              <ul className="space-y-1.5">
                {q.answers.map((a) => {
                  const isCorrect = r?.correctAnswerIds.includes(a.id);
                  const isChosen = Array.isArray(chosen) && chosen.includes(a.id);
                  return (
                    <li
                      key={a.id}
                      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-ctl border px-3 py-2 ${
                        isCorrect
                          ? "border-good/40 bg-good/[0.08] text-good"
                          : isChosen
                            ? "border-bad/40 bg-bad/[0.08] text-bad"
                            : "border-line/60 text-ink-soft"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                          isChosen ? "border-current bg-current/10" : "border-line"
                        }`}
                      >
                        {isChosen && <Icon name="check" size={13} />}
                      </span>
                      <span className="sr-only">{isChosen ? "Выбрано: " : "Не выбрано: "}</span>
                      <span className="min-w-0 flex-1">{a.text}</span>
                      {isCorrect && <span className="text-sm font-medium">правильный</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {q.type === "OPEN" && typeof chosen === "string" && chosen && (
              <p className="whitespace-pre-wrap break-words text-ink-soft">{chosen}</p>
            )}
            {r?.explanation && (
              <p className="flex gap-2 rounded-ctl bg-raised/70 px-3 py-2 text-ink-soft">
                <Icon name="hint" size={18} className="mt-0.5 text-crawl" />
                <span>{r.explanation}</span>
              </p>
            )}
          </Panel>
        );
      })}
      <LinkButton to="/" variant="tinted">
        <Icon name="arrow-left" /> к курсу
      </LinkButton>
    </div>
  );
}
