import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const password = process.env.DEMO_ACCOUNT_PASSWORD ?? "dekanat-2026";
if (password.length < 10 || Buffer.byteLength(password) > 72) {
  throw new Error("DEMO_ACCOUNT_PASSWORD: минимум 10 символов и не больше 72 байт.");
}

const db = new PrismaClient();
const dayKey = (date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(date);
const today = new Date();
const dow = (new Date(dayKey(today) + "T12:00:00+03:00").getUTCDay() + 6) % 7;
const mondayOffset = -dow;
const at = (offset, time) => new Date(Date.parse(dayKey(today) + "T12:00:00+03:00") + offset * 86400000 + (Date.parse(dayKey(today) + "T" + time + ":00+03:00") - Date.parse(dayKey(today) + "T12:00:00+03:00")));
const plus = (date, days) => new Date(+date + days * 86400000);

const fullNames = {
  "Калинина И. В.": "Калинина Ирина Викторовна",
  "Подгорный М. С.": "Подгорный Михаил Сергеевич",
  "Волкова А. Н.": "Волкова Анна Николаевна",
  "Орлов Д. В.": "Орлов Дмитрий Викторович",
  "Гусев А. П.": "Гусев Алексей Петрович",
  "Соколова Е. А.": "Соколова Елена Андреевна",
  "Морозова Н. К.": "Морозова Наталья Кирилловна",
};

const people = [
  { login: "student", name: "Иван Петров", role: "STUDENT" },
  { login: "student2", name: "Полина Смирнова", role: "STUDENT" },
  { login: "office", name: "Мария Орлова", role: "STAFF" },
];

try {
  for (const person of people) {
    const passwordHash = hashSync(password, 12);
    await db.user.upsert({
      where: { login: person.login },
      update: { name: person.name, role: person.role, passwordHash },
      create: { ...person, passwordHash },
    });
  }
  const student = await db.user.findUnique({ where: { login: "student" } });
  const student2 = await db.user.findUnique({ where: { login: "student2" } });
  const office = await db.user.findUnique({ where: { login: "office" } });

  await db.auditEntry.deleteMany({});
  await db.groupLesson.deleteMany({});
  await db.attendance.deleteMany({ where: { userId: { in: [student.id, student2.id] } } });
  await db.lesson.deleteMany({ where: { userId: { in: [student.id, student2.id] } } });
  await db.grade.deleteMany({ where: { userId: student.id } });
  await db.deadline.deleteMany({ where: { userId: student.id } });
  await db.serviceRequest.deleteMany({});
  await db.news.deleteMany({});
  await db.notification.deleteMany({});
  await db.staffProfile.deleteMany({});
  await db.studentProfile.deleteMany({});
  await db.studyGroup.deleteMany({});

  const group1 = await db.studyGroup.create({ data: { name: "ИВТ-21-1", faculty: "Факультет программной инженерии", course: 3 } });
  const group2 = await db.studyGroup.create({ data: { name: "ИВТ-21-2", faculty: "Факультет программной инженерии", course: 3 } });

  await db.studentProfile.create({ data: {
    userId: student.id, groupId: group1.id,
    birthDate: new Date("2004-03-12T00:00:00+03:00"),
    studentId: "З-21-004317",
    institute: "Институт информационных технологий",
    faculty: "Факультет программной инженерии",
    department: "Кафедра информационных систем",
    programCode: "09.03.01",
    programName: "Информатика и вычислительная техника",
    course: 3,
    groupName: group1.name,
    funding: "BUDGET",
    phone: "+7 900 123-45-67",
    contactEmail: "i.petrov@student.example.ru",
    messengerUrl: "https://t.me/ivan_petrov",
  } });
  await db.studentProfile.create({ data: { userId: student2.id, groupId: group2.id } });
  await db.staffProfile.create({ data: { userId: office.id, groups: { connect: [{ id: group1.id }, { id: group2.id }] } } });

  const personal = [
    { day: dow, from: "08:30", to: "10:00", title: "Технологии программирования", teacher: "Калинина И. В.", room: "320", type: "LECTURE",
      attendance: "PRESENT", teachers: [{ name: "Калинина Ирина Викторовна", position: "доцент, кафедра информационных систем" }],
      deadlines: [{ title: "Отчёт по лабораторной № 3", course: "Технологии программирования", dueAt: at(1, "23:59"), completedAt: null }] },
    { day: dow, from: "10:20", to: "11:50", title: "Управление данными", teacher: "Подгорный М. С.", room: "204", type: "PRACTICE",
      attendance: "ABSENT", groups: ["ИВТ-21-1", "ИВТ-21-2"],
      deadlines: [{ title: "Реферат по ИС", course: "Управление данными", dueAt: at(-1, "18:00"), completedAt: null }] },
    { day: dow, from: "12:40", to: "14:10", title: "Проектирование интерфейсов", teacher: "Волкова А. Н.", room: "105", type: "LAB",
      attendance: "EXCUSED", original: ["12:10", "13:40"],
      deadlines: [{ title: "Презентация проекта", course: "Проектирование интерфейсов", dueAt: at(-1, "16:00"), completedAt: at(-1, "12:00") }] },
    { day: dow - 1, from: "10:20", to: "11:50", title: "Базы данных", teacher: "Орлов Д. В.", room: "204", type: "LECTURE" },
    { day: dow - 1, from: "14:00", to: "15:30", title: "Управление данными", teacher: "Подгорный М. С.", room: "204", type: "PRACTICE" },
    { day: dow - 2, from: "12:10", to: "13:40", title: "Семинар по ИС", teacher: "Гусев А. П.", room: "", type: "SEMINAR" },
    { day: dow + 1, from: "10:20", to: "11:50", title: "Технологии программирования", teacher: "Калинина И. В.", room: "320", type: "LECTURE" },
    { day: dow + 1, from: "14:00", to: "15:30", title: "Философия", teacher: "Соколова Е. А.", room: "105", type: "PRACTICE" },
    { day: dow + 2, from: "08:30", to: "10:00", title: "Базы данных", teacher: "Орлов Д. В.", room: "204", type: "EXAM", campus: null },
  ];
  for (const item of personal) {
    const { attendance, deadlines, teachers, original, day, from, to, title, teacher, room, type, groups, campus } = item;
    const created = await db.lesson.create({ data: {
      userId: student.id, title, teacher, room, type,
      groups: groups ?? ["ИВТ-21-1"],
      campus: campus === undefined ? "Главный корпус, ул. Примерная, 1" : campus,
      teachers: teachers ?? [{ name: fullNames[teacher] ?? teacher, position: "преподаватель" }],
      originalStartsAt: original ? at(mondayOffset + day, original[0]) : null,
      originalEndsAt: original ? at(mondayOffset + day, original[1]) : null,
      startsAt: at(mondayOffset + day, from),
      endsAt: at(mondayOffset + day, to),
    } });
    if (attendance) await db.attendance.create({ data: { lessonId: created.id, userId: student.id, status: attendance } });
    for (const deadline of deadlines ?? []) {
      await db.deadline.create({ data: { userId: student.id, lessonId: created.id, title: deadline.title, course: deadline.course, dueAt: deadline.dueAt, completedAt: deadline.completedAt ?? null } });
    }
  }
  await db.deadline.create({ data: { userId: student.id, lessonId: null, title: "Курсовая работа", course: "Базы данных", dueAt: at(12, "12:00"), completedAt: null } });

  await db.lesson.createMany({ data: [
    { userId: student2.id, title: "Математический анализ", teacher: "Гусев А. П.", room: "105", type: "LECTURE", groups: ["ИВТ-21-2"], campus: "Главный корпус, ул. Примерная, 1", teachers: [{ name: "Гусев Алексей Петрович", position: "доцент" }], startsAt: at(mondayOffset, "10:20"), endsAt: at(mondayOffset, "11:50") },
    { userId: student2.id, title: "Английский язык", teacher: "Морозова Н. К.", room: "204", type: "PRACTICE", groups: ["ИВТ-21-2"], campus: "Главный корпус, ул. Примерная, 1", teachers: [{ name: "Морозова Наталья Кирилловна", position: "старший преподаватель" }], startsAt: at(mondayOffset + 2, "14:00"), endsAt: at(mondayOffset + 2, "15:30") },
  ] });

  await db.groupLesson.createMany({ data: [
    { groupId: group1.id, title: "Практикум по ИС", teacher: "Гусев А. П.", room: "105", type: "PRACTICE", campus: "Главный корпус, ул. Примерная, 1", teachers: [{ name: "Гусев Алексей Петрович", position: "доцент" }], originalStartsAt: at(1, "14:00"), originalEndsAt: at(1, "15:30"), startsAt: at(-1, "16:00"), endsAt: at(-1, "17:30") },
    { groupId: group1.id, title: "Лабораторный практикум", teacher: "Орлов Д. В.", room: "204", type: "LAB", campus: "Главный корпус, ул. Примерная, 1", teachers: [{ name: "Орлов Дмитрий Викторович", position: "профессор" }], startsAt: at(1, "16:00"), endsAt: at(1, "17:30") },
  ] });

  await db.grade.createMany({ data: [
    { title: "Технологии программирования", score: 45, threshold: 60, term: 3, assessment: "EXAM", finalGrade: null, passed: null },
    { title: "Управление данными", score: 52, threshold: 60, term: 3, assessment: "TEST", finalGrade: null, passed: null },
    { title: "Базы данных", score: 48, threshold: 60, term: 3, assessment: "COURSEWORK", finalGrade: null, passed: null },
    { title: "Проектирование интерфейсов", score: 55, threshold: 60, term: 3, assessment: "TEST", finalGrade: null, passed: null },
    { title: "Введение в разработку", score: 68, threshold: 60, term: 2, assessment: "TEST", finalGrade: null, passed: true },
    { title: "Дискретная математика", score: 61, threshold: 60, term: 2, assessment: "EXAM", finalGrade: 4, passed: null },
    { title: "Английский язык", score: 74, threshold: 60, term: 2, assessment: "TEST", finalGrade: null, passed: true },
    { title: "Информатика", score: 70, threshold: 60, term: 1, assessment: "EXAM", finalGrade: 5, passed: null },
    { title: "Математический анализ", score: 58, threshold: 60, term: 1, assessment: "EXAM", finalGrade: 2, passed: null },
  ].map((item) => ({ ...item, userId: student.id })) });

  const now = new Date();
  await db.notification.createMany({ data: [
    { userId: student.id, title: "Заявка обработана", body: "Справка об обучении готова: кабинет 302.", readAt: plus(now, -1) },
    { userId: student.id, title: "Перенос занятия", body: "Лабораторная по проектированию интерфейсов перенесена на 12:40.", readAt: null },
    { userId: student2.id, title: "Новый дедлайн", body: "Реферат по ИС — до конца недели.", readAt: null },
  ] });

  await db.news.createMany({ data: [
    { title: "Приём заявок на справки", body: "Справку об обучении можно заказать во вкладке «Сервисы». Статус заявки обновляется там же." },
    { title: "График зимней сессии", body: "Расписание зачётов и экзаменов опубликуют до 1 декабря в разделе «Календарь»." },
    { title: "Стипендия за ноябрь", body: "Выплата поступит на карты до 25 ноября. Вопросы — в учебный офис." },
  ] });

  const requests = [
    { userId: student.id, type: "STUDY", status: "READY", number: "З-2026-0001", comment: "Справка готова. Заберите в кабинете 302 до 25 ноября.", readyBy: plus(now, 2), createdAt: plus(now, -3), updatedAt: plus(now, -1) },
    { userId: student.id, type: "MILITARY", status: "PROCESSING", number: "З-2026-0002", comment: null, readyBy: plus(now, -1), createdAt: plus(now, -2) },
    { userId: student.id, type: "APPOINTMENT", status: "NEW", number: "З-2026-0003", comment: null, readyBy: null, createdAt: plus(now, -1) },
    { userId: student2.id, type: "MILITARY", status: "CANCELLED", number: "З-2026-0004", comment: "Отменена студентом.", readyBy: null, createdAt: plus(now, -4), updatedAt: plus(now, -1) },
  ];
  for (const request of requests) {
    await db.serviceRequest.create({ data: { ...request, updatedAt: request.updatedAt ?? request.createdAt } });
  }

  await db.auditEntry.create({ data: { groupId: group1.id, actorId: office.id, summary: "Проверены заявки группы ИВТ-21-1" } });

  console.log("Готово: 3 пользователя, 2 группы, 9 оценок, 4 заявки, 11 занятий и 2 групповых пары.");
} finally {
  await db.$disconnect();
}
