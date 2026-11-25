// Отметка статуса урока в программе курса: галочка, точка или замок (COURSE-05).
import type { LessonStatus } from "../api/courses";
import Icon from "./ui/Icon";

const STATUS_TEXT: Record<LessonStatus, string> = {
  completed: "пройден",
  available: "доступен",
  locked: "закрыт",
};

const LOOK: Record<LessonStatus, string> = {
  completed: "border-good/50 bg-good/[0.14] text-good",
  available: "border-holo/60 bg-holo/[0.12] text-holo",
  locked: "border-line bg-raised/50 text-ink-mute",
};

export default function LessonMark({ status, small }: { status: LessonStatus; small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border ${small ? "h-6 w-6" : "h-7 w-7"} ${LOOK[status]}`}
    >
      {status === "completed" && <Icon name="check" size={small ? 13 : 15} />}
      {status === "available" && <span className="h-2 w-2 rounded-full bg-holo shadow-saber" />}
      {status === "locked" && <Icon name="lock" size={small ? 12 : 14} />}
      <span className="sr-only">Урок {STATUS_TEXT[status]}.</span>
    </span>
  );
}
