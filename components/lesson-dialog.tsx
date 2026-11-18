"use client";
import Link from "next/link";
import { CalendarClock, Clock3, DoorOpen, GraduationCap, TriangleAlert, Users, X } from "lucide-react";
import { dateLabel, timeLabel, type DeadlineView, type LessonView } from "@/lib/model";
import { AttendanceBadge, LessonTypeBadge } from "@/components/lesson-meta";
import { Sheet } from "@/components/ui/sheet";

function deadlineView(deadline: DeadlineView) {
  if (deadline.completedAt) return { label: "Выполнен", className: "done" };
  return new Date(deadline.dueAt).getTime() < Date.now()
    ? { label: "Просрочен", className: "overdue" }
    : { label: "Активен", className: "active" };
}

export function LessonDialog({ lesson, deadlines, mapUrl, onClose }: {
  lesson: LessonView;
  deadlines: DeadlineView[];
  mapUrl?: string;
  onClose: () => void;
}) {
  const start = new Date(lesson.startsAt);
  const end = new Date(lesson.endsAt);
  const changed = Boolean(lesson.originalStartsAt && lesson.originalStartsAt !== lesson.startsAt);
  const related = deadlines.filter((deadline) => deadline.lessonId === lesson.id);
  const teachers = lesson.teachers.length ? lesson.teachers : [{ name: lesson.teacher }];

  return <Sheet id="lesson-dialog" labelledBy="lesson-title" onClose={onClose}>
    <div className="panel sheet-panel">
      <div className="sheet-head">
        <div><LessonTypeBadge type={lesson.type} /><h2 id="lesson-title">{lesson.title}</h2></div>
        <button type="button" className="button button-icon" aria-label="Закрыть" onClick={onClose}><X size={18} /></button>
      </div>

      <dl className="lesson-facts">
        <div className="lesson-fact">
          <dt><Clock3 size={15} /> Дата и время</dt>
          <dd>
            <span>{dateLabel(start, true)} · {timeLabel(start)} — {timeLabel(end)}</span>
            {changed && <span className="lesson-changed"><TriangleAlert size={13} /> Изменено</span>}
            {changed && lesson.originalStartsAt && lesson.originalEndsAt && <span className="muted">Было: {dateLabel(new Date(lesson.originalStartsAt), true)} · {timeLabel(new Date(lesson.originalStartsAt))} — {timeLabel(new Date(lesson.originalEndsAt))}</span>}
          </dd>
        </div>

        <div className="lesson-fact">
          <dt><Users size={15} /> Группы</dt>
          <dd>{lesson.groups.length ? lesson.groups.join(", ") : "—"}</dd>
        </div>

        <div className="lesson-fact">
          <dt><DoorOpen size={15} /> Аудитория</dt>
          <dd>
            {lesson.room
              ? <span>{lesson.room}{lesson.campus ? <span className="muted"> · {lesson.campus}</span> : null}{mapUrl && <Link className="lesson-map-link" href={mapUrl + "?room=" + encodeURIComponent(lesson.room)}>Показать на карте</Link>}</span>
              : "Аудитория не назначена"}
          </dd>
        </div>

        <div className="lesson-fact">
          <dt><GraduationCap size={15} /> Преподаватель</dt>
          <dd>
            <ul className="lesson-list">
              {teachers.map((teacher, index) => <li key={index}>{teacher.name}{teacher.position ? <span className="muted"> · {teacher.position}</span> : null}</li>)}
            </ul>
          </dd>
        </div>

        <div className="lesson-fact">
          <dt><CalendarClock size={15} /> Дедлайны</dt>
          <dd>
            {related.length
              ? <ul className="lesson-list lesson-deadlines">{related.map((deadline) => {
                const view = deadlineView(deadline);
                return <li key={deadline.id}>
                  <span className="lesson-deadline-title">{deadline.title}</span>
                  <span className="muted">{dateLabel(new Date(deadline.dueAt))} · {timeLabel(new Date(deadline.dueAt))}</span>
                  <span className={"pill " + view.className}>{view.label}</span>
                </li>;
              })}
              </ul>
              : <span className="muted">Дедлайнов нет</span>}
          </dd>
        </div>

        <div className="lesson-fact">
          <dt>Посещение</dt>
          <dd><AttendanceBadge status={lesson.attendance} ended={end.getTime() <= Date.now()} /></dd>
        </div>
      </dl>
    </div>
  </Sheet>;
}
