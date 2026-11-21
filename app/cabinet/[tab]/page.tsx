import { attendanceStreak } from "@/lib/campus-tools";
import { displayStudent } from "@/lib/campus-tools";
import { Dashboard } from "@/components/dashboard";
import { forbidden } from "next/navigation";
import { account } from "@/lib/access";
import { db } from "@/lib/db";
import { campusDay, type JournalData, type LessonView } from "@/lib/model";
import { studentNewsAudiences } from "@/lib/news";
import { validTab } from "@/lib/tabs";

export default async function Cabinet({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ room?: string | string[]; saved?: string; lesson?: string }> }) {
  const user = await account("STUDENT");
  const tab = validTab((await params).tab);
  const { room, saved, lesson: savedLesson } = await searchParams;
  // Журнал — только для назначенного старосты и только с сегодняшними парами.
  if (tab === "journal" && !user.isMonitor) forbidden();
  let journal: JournalData | undefined;
  if (tab === "journal") {
    if (!user.groupId) {
      journal = { lessons: [], saved: false, savedLessonId: null };
    } else {
      const dayStart = new Date(campusDay(new Date()) + "T00:00:00+03:00");
      const dayEnd = new Date(+dayStart + 86400000);
      const [journalLessons, journalStudents] = await Promise.all([
        db.groupLesson.findMany({
          where: { groupId: user.groupId, startsAt: { gte: dayStart, lt: dayEnd } },
          orderBy: { startsAt: "asc" },
          include: { group: { select: { name: true } }, marks: true },
        }),
        db.user.findMany({
          where: { role: "STUDENT", studentProfile: { groupId: user.groupId } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, studentProfile: { select: { surnameStress: true } } },
        }),
      ]);
      journal = {
        lessons: journalLessons.map((item) => ({
          id: item.id, title: item.title, teacher: item.teacher, room: item.room, type: item.type,
          groupName: item.group.name,
          startsAt: item.startsAt.toISOString(), endsAt: item.endsAt.toISOString(),
          students: journalStudents.map((student) => ({
            id: student.id,
            name: displayStudent(student.name, student.studentProfile?.surnameStress),
            status: item.marks.find((mark) => mark.userId === student.id)?.status ?? null,
          })),
        })),
        saved: saved === "1",
        savedLessonId: typeof savedLesson === "string" ? savedLesson : null,
      };
    }
  }
  // Новости видны только подходящей аудитории: общие, своей группе/факультету/курсу
  // и объявления сотрудников, закреплённых за этой группой.
  const group = tab === "today" && user.groupId
    ? await db.studyGroup.findUnique({ where: { id: user.groupId }, select: { id: true, faculty: true, course: true } })
    : null;
  const staffIds = tab === "today" && user.groupId
    ? (await db.staffProfile.findMany({ where: { groups: { some: { id: user.groupId } } }, select: { userId: true } })).map((item) => item.userId)
    : [];
  const newsAudiences = studentNewsAudiences(group, staffIds);
  const [lessons, grades, deadlines, requests, news, groupLessons, notifications, attendance, streak, libraryLoans, campusBookings] = await Promise.all([
    tab === "today" || tab === "map" ? db.lesson.findMany({ where: { userId: user.id }, orderBy: { startsAt: "asc" } }) : [],
    tab === "grades" ? db.grade.findMany({ where: { userId: user.id }, orderBy: { term: "desc" } }) : [],
    tab === "today" || tab === "calendar" ? db.deadline.findMany({ where: { userId: user.id }, orderBy: { dueAt: "asc" } }) : [],
    tab === "services" ? db.serviceRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : [],
    tab === "today" ? db.news.findMany({ where: { audience: { in: newsAudiences } }, orderBy: { createdAt: "desc" } }) : [],
    user.groupId && (tab === "today" || tab === "map") ? db.groupLesson.findMany({ where: { groupId: user.groupId }, include: { group: { select: { name: true } }, marks: { where: { userId: user.id } } } }) : [],
    tab === "today" ? db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : [],
    tab === "today" ? db.attendance.findMany({ where: { userId: user.id } }) : [],
    tab === "today" ? attendanceStreak(user.id, user.groupId) : undefined,
    tab === "today" || tab === "calendar" ? db.campusLoan.findMany({ where: { userId: user.id }, include: { book: { select: { title: true } } } }) : [],
    tab === "today" || tab === "calendar" ? db.campusBooking.findMany({ where: { userId: user.id, slot: { startsAt: { gte: new Date() } } }, include: { slot: true } }) : [],
  ]);
  const attendanceByLesson = new Map(attendance.map((item) => [item.lessonId, item.status]));

  const ownLessons: LessonView[] = lessons.map(({ userId, ...lesson }) => ({
    ...lesson,
    startsAt: lesson.startsAt.toISOString(),
    endsAt: lesson.endsAt.toISOString(),
    originalStartsAt: lesson.originalStartsAt?.toISOString() ?? null,
    originalEndsAt: lesson.originalEndsAt?.toISOString() ?? null,
    groups: lesson.groups,
    campus: lesson.campus,
    teachers: (lesson.teachers as { name: string; position?: string }[] | null) ?? [],
    attendance: attendanceByLesson.get(lesson.id) ?? null,
  }));
  const sharedLessons: LessonView[] = groupLessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    teacher: lesson.teacher,
    room: lesson.room,
    type: lesson.type,
    groups: [lesson.group.name],
    campus: lesson.campus ?? null,
    comment: lesson.comment,
    teachers: (lesson.teachers as { name: string; position?: string }[] | null) ?? [],
    originalStartsAt: lesson.originalStartsAt?.toISOString() ?? null,
    originalEndsAt: lesson.originalEndsAt?.toISOString() ?? null,
    attendance: lesson.marks[0]?.status ?? null,
    startsAt: lesson.startsAt.toISOString(),
    endsAt: lesson.endsAt.toISOString(),
  }));

  return <Dashboard streak={streak} monitor={user.isMonitor} initialRoom={typeof room === "string" ? room : undefined} tab={tab} day={campusDay(new Date())} role={user.role} name={user.name} journal={journal} data={{
    lessons: [...ownLessons, ...sharedLessons].sort((left, right) => +new Date(left.startsAt) - +new Date(right.startsAt)),
    grades: grades.map(({ userId, ...grade }) => grade),
        deadlines: [
      ...deadlines.map(({ userId, ...deadline }) => ({ ...deadline, dueAt: deadline.dueAt.toISOString(), lessonId: deadline.lessonId, completedAt: deadline.completedAt?.toISOString() ?? null })),
      ...libraryLoans.map(({ bookId, book, dueAt }) => ({ id: "loan-" + bookId, title: "Вернуть книгу · " + book.title, course: "Библиотека", dueAt: dueAt.toISOString(), lessonId: null, completedAt: null })),
      ...campusBookings.map(({ slot }) => ({ id: "booking-" + slot.id, title: slot.title, course: slot.place, dueAt: slot.startsAt.toISOString(), lessonId: null, completedAt: null })),
    ].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)),
    requests: requests.map(({ userId, ...request }) => ({
      id: request.id,
      number: request.number ?? "З-" + request.id.slice(0, 8),
      type: request.type,
      status: request.status,
      comment: request.comment ?? null,
      readyBy: request.readyBy?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: (request.updatedAt ?? request.createdAt).toISOString(),
    })),
    news: [
      ...notifications.map((item) => ({ id: item.id, title: item.title, body: item.body, readAt: item.readAt?.toISOString() ?? null, kind: null, createdAt: item.createdAt.toISOString(), at: +item.createdAt })),
      ...news.map((item) => ({ id: item.id, title: item.title, body: item.body, readAt: undefined as string | undefined, kind: item.kind, createdAt: item.createdAt.toISOString(), at: +item.createdAt })),
    ].sort((left, right) => right.at - left.at).map(({ id, title, body, readAt, kind, createdAt }) => ({ id, title, body, readAt, kind, createdAt })),
  }} />;
}
