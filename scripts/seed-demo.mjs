import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const password = process.env.DEMO_ACCOUNT_PASSWORD ?? "dekanat-2026";
if (password.length < 10 || Buffer.byteLength(password) > 72) {
  throw new Error("DEMO_ACCOUNT_PASSWORD: минимум 10 символов и не больше 72 байт.");
}

const db = new PrismaClient();
const passwordHash = hashSync(password, 12);
const today = new Date();
const dayKey = (date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(date);
const todayKey = dayKey(today);
const dow = (new Date(todayKey + "T12:00:00+03:00").getUTCDay() + 6) % 7;
const monday = -dow;
const at = (offset, time) => new Date(
  Date.parse(todayKey + "T12:00:00+03:00") + offset * 86400000 +
  (Date.parse(todayKey + "T" + time + ":00+03:00") - Date.parse(todayKey + "T12:00:00+03:00")),
);
const shift = (date, days) => new Date(+date + days * 86400000);
const fullNames = {
  "Калинина И. В.": "Калинина Ирина Викторовна",
  "Подгорный М. С.": "Подгорный Михаил Сергеевич",
  "Волкова А. Н.": "Волкова Анна Николаевна",
  "Орлов Д. В.": "Орлов Дмитрий Викторович",
  "Гусев А. П.": "Гусев Алексей Петрович",
  "Соколова Е. А.": "Соколова Елена Андреевна",
  "Морозова Н. К.": "Морозова Наталья Кирилловна",
};
const teacher = (short) => [{ name: fullNames[short] ?? short, position: short === "Орлов Д. В." ? "профессор" : "доцент" }];

const facultyOne = "Факультет программной инженерии";
const facultyTwo = "Факультет информационной безопасности";

const groups = [
  { name: "ИВТ-21-1", faculty: facultyOne, course: 3 },
  { name: "ИВТ-21-2", faculty: facultyOne, course: 3 },
  { name: "ПИ-22-1", faculty: facultyOne, course: 2 },
  { name: "ИБ-23-1", faculty: facultyTwo, course: 1 },
];

const people = [
  { login: "office", name: "Мария Орлова", role: "STAFF" },
  { login: "office2", name: "Сергей Кузнецов", role: "STAFF" },
  { login: "student", name: "Иван Петров", role: "STUDENT", group: "ИВТ-21-1", monitor: true, stress: 0, studentId: "З-21-004317" },
  { login: "student2", name: "Полина Смирнова", role: "STUDENT", group: "ИВТ-21-2", stress: 2, studentId: "З-21-004318" },
  { login: "student3", name: "Артём Соколов", role: "STUDENT", group: "ИВТ-21-1", stress: 0, studentId: "З-21-004319" },
  { login: "student4", name: "Дарья Лебедева", role: "STUDENT", group: "ИВТ-21-1", stress: 1, studentId: "З-21-004320" },
  { login: "student5", name: "Никита Волков", role: "STUDENT", group: "ИВТ-21-2", stress: 0, studentId: "З-21-004321" },
  { login: "student6", name: "Софья Морозова", role: "STUDENT", group: "ИВТ-21-2", stress: 1, studentId: "З-21-004322" },
  { login: "student7", name: "Максим Кузнецов", role: "STUDENT", group: "ПИ-22-1", stress: 0, studentId: "З-22-005101" },
  { login: "student8", name: "Алиса Фёдорова", role: "STUDENT", group: "ПИ-22-1", stress: 2, studentId: "З-22-005102" },
  { login: "student9", name: "Егор Павлов", role: "STUDENT", group: "ИБ-23-1", stress: 0, studentId: "З-23-006201" },
  { login: "student10", name: "Варвара Никитина", role: "STUDENT", group: "ИБ-23-1", stress: 1, studentId: "З-23-006202" },
];

const subjects = {
  "ИВТ-21-1": ["Технологии программирования", "Управление данными", "Базы данных", "Проектирование интерфейсов", "Дискретная математика", "Английский язык"],
  "ИВТ-21-2": ["Технологии программирования", "Управление данными", "Базы данных", "Проектирование интерфейсов", "Дискретная математика", "Английский язык"],
  "ПИ-22-1": ["Алгоритмы и структуры данных", "Веб-разработка", "Математический анализ", "Английский язык", "Экономика", "Физика"],
  "ИБ-23-1": ["Основы информатики", "Математика", "История", "Английский язык", "Безопасность жизнедеятельности", "Физическая культура"],
};

function assessmentOf(title) {
  if (/Базы данных|Дискретная|Информатика|Математический анализ|^Математика$/.test(title)) return "EXAM";
  if (/Проектирование|Английский|Физическая|История|Безопасность|Экономика/.test(title)) return "TEST";
  return "COURSEWORK";
}

try {
  await db.campusPass.deleteMany({});
  await db.campusPortfolio.deleteMany({});
  await db.campusReply.deleteMany({});
  await db.campusPost.deleteMany({});
  await db.campusHold.deleteMany({});
  await db.campusLoan.deleteMany({});
  await db.campusBook.deleteMany({});
  await db.campusBooking.deleteMany({});
  await db.campusSlot.deleteMany({});
  await db.attendanceQr.deleteMany({});
  await db.groupAttendance.deleteMany({});
  await db.auditEntry.deleteMany({});
  await db.groupLesson.deleteMany({});
  await db.attendance.deleteMany({});
  await db.lesson.deleteMany({});
  await db.grade.deleteMany({});
  await db.deadline.deleteMany({});
  await db.serviceRequest.deleteMany({});
  await db.news.deleteMany({});
  await db.notification.deleteMany({});
  await db.staffProfile.deleteMany({});
  await db.studentProfile.deleteMany({});
  await db.studyGroup.deleteMany({});

  const groupRows = new Map();
  for (const group of groups) {
    groupRows.set(group.name, await db.studyGroup.create({ data: group }));
  }

  const users = new Map();
  for (const person of people) {
    const user = await db.user.upsert({
      where: { login: person.login },
      update: { name: person.name, role: person.role, passwordHash },
      create: { login: person.login, name: person.name, role: person.role, passwordHash },
    });
    users.set(person.login, user);
  }

  for (const person of people.filter((item) => item.role === "STUDENT")) {
    const group = groupRows.get(person.group);
    await db.studentProfile.create({ data: {
      userId: users.get(person.login).id, groupId: group.id,
      birthDate: new Date(2003 + (person.login.length % 3) + "-0" + (3 + (person.login.length % 5)) + "-1" + (person.login.length % 9) + "T00:00:00+03:00"),
      studentId: person.studentId,
      institute: "Институт информационных технологий",
      faculty: group.faculty,
      department: "Кафедра информационных систем",
      programCode: group.course === 1 ? "10.03.01" : "09.03.01",
      programName: "Информатика и вычислительная техника",
      course: group.course,
      groupName: group.name,
      funding: person.login === "student4" || person.login === "student9" ? "CONTRACT" : "BUDGET",
      phone: "+7 900 000-" + String(10 + people.indexOf(person)) + "-" + String(10 + (people.indexOf(person) % 80)),
      contactEmail: person.login + "@student.example.ru",
      messengerUrl: "https://t.me/" + person.login,
      surnameStress: person.stress ?? null,
      isMonitor: Boolean(person.monitor),
    } });
  }
  await db.staffProfile.create({ data: { userId: users.get("office").id, groups: { connect: [...groupRows.values()].map(({ id }) => ({ id })) } } });
  await db.staffProfile.create({ data: { userId: users.get("office2").id, groups: { connect: [{ id: groupRows.get("ПИ-22-1").id }, { id: groupRows.get("ИБ-23-1").id }] } } });

  const personal = [
    { day: dow, from: "08:30", to: "10:00", title: "Технологии программирования", teacher: "Калинина И. В.", room: "320", type: "LECTURE", attendance: "PRESENT" },
    { day: dow, from: "10:20", to: "11:50", title: "Управление данными", teacher: "Подгорный М. С.", room: "204", type: "PRACTICE", attendance: "ABSENT", groups: ["ИВТ-21-1", "ИВТ-21-2"] },
    { day: dow, from: "12:40", to: "14:10", title: "Проектирование интерфейсов", teacher: "Волкова А. Н.", room: "105", type: "LAB", attendance: "EXCUSED", original: ["12:10", "13:40"] },
    { day: dow - 1, from: "10:20", to: "11:50", title: "Базы данных", teacher: "Орлов Д. В.", room: "204", type: "LECTURE", attendance: "PRESENT" },
    { day: dow - 1, from: "14:00", to: "15:30", title: "Управление данными", teacher: "Подгорный М. С.", room: "204", type: "PRACTICE", attendance: "PRESENT" },
    { day: dow - 2, from: "12:10", to: "13:40", title: "Семинар по ИС", teacher: "Гусев А. П.", room: "", type: "SEMINAR" },
    { day: dow + 1, from: "10:20", to: "11:50", title: "Технологии программирования", teacher: "Калинина И. В.", room: "320", type: "LECTURE" },
    { day: dow + 1, from: "14:00", to: "15:30", title: "Философия", teacher: "Соколова Е. А.", room: "105", type: "PRACTICE" },
    { day: dow + 2, from: "08:30", to: "10:00", title: "Базы данных", teacher: "Орлов Д. В.", room: "204", type: "EXAM" },
  ];
  const lessonIds = [];
  for (const item of personal) {
    const { attendance, day, from, to, title, teacher: who, room, type, groups: groupNames, original, campus } = item;
    const created = await db.lesson.create({ data: {
      userId: users.get("student").id, title, teacher: who, room, type,
      groups: groupNames ?? ["ИВТ-21-1"],
      campus: campus === undefined ? "Главный корпус, ул. Примерная, 1" : campus,
      teachers: teacher(who),
      originalStartsAt: original ? at(monday + day, original[0]) : null,
      originalEndsAt: original ? at(monday + day, original[1]) : null,
      startsAt: at(monday + day, from),
      endsAt: at(monday + day, to),
    } });
    lessonIds.push(created.id);
    if (attendance) await db.attendance.create({ data: { lessonId: created.id, userId: users.get("student").id, status: attendance } });
  }
  await db.lesson.createMany({ data: [
    { userId: users.get("student2").id, title: "Математический анализ", teacher: "Гусев А. П.", room: "105", type: "LECTURE", groups: ["ИВТ-21-2"], campus: "Главный корпус, ул. Примерная, 1", teachers: teacher("Гусев А. П."), startsAt: at(monday + dow, "10:20"), endsAt: at(monday + dow, "11:50") },
    { userId: users.get("student2").id, title: "Английский язык", teacher: "Морозова Н. К.", room: "204", type: "PRACTICE", groups: ["ИВТ-21-2"], campus: "Главный корпус, ул. Примерная, 1", teachers: teacher("Морозова Н. К."), startsAt: at(monday + dow, "14:00"), endsAt: at(monday + dow, "15:30") },
    { userId: users.get("student3").id, title: "Базы данных", teacher: "Орлов Д. В.", room: "204", type: "PRACTICE", groups: ["ИВТ-21-1"], campus: "Главный корпус, ул. Примерная, 1", teachers: teacher("Орлов Д. В."), startsAt: at(monday + dow, "10:20"), endsAt: at(monday + dow, "11:50") },
  ] });

  const groupLessonRows = [];
  const groupPlan = [
    ["ИВТ-21-1", "Практикум по ИС", "Гусев А. П.", "105", "PRACTICE", 1, "14:00", "15:30", "Перенесено из аудитории 204"],
    ["ИВТ-21-1", "Лабораторный практикум", "Орлов Д. В.", "204", "LAB", -1, "16:00", "17:30", null],
    ["ИВТ-21-2", "Семинар по базам данных", "Орлов Д. В.", "204", "SEMINAR", dow, "12:40", "14:10", null],
    ["ПИ-22-1", "Веб-разработка", "Волкова А. Н.", "320", "PRACTICE", dow, "10:20", "11:50", null],
    ["ПИ-22-1", "Консультация по проекту", "Волкова А. Н.", "105", "SEMINAR", 2, "15:00", "16:30", null],
    ["ИБ-23-1", "Основы информатики", "Соколова Е. А.", "105", "LECTURE", dow, "08:30", "10:00", null],
    ["ИБ-23-1", "Практика по безопасности", "Гусев А. П.", "204", "LAB", 1, "12:00", "13:30", null],
  ];
  for (const [groupName, title, who, room, type, dayOffset, from, to, comment] of groupPlan) {
    const created = await db.groupLesson.create({ data: {
      groupId: groupRows.get(groupName).id, title, teacher: who, room, type, comment,
      campus: "Главный корпус, ул. Примерная, 1", teachers: teacher(who),
      startsAt: at(monday + dayOffset, from), endsAt: at(monday + dayOffset, to),
    } });
    groupLessonRows.push(created);
  }

  const groupMarks = { "ИВТ-21-1": ["student", "student3", "student4"] };
  for (const lesson of groupLessonRows) {
    const groupName = groups.find((group) => groupRows.get(group.name).id === lesson.groupId).name;
    const logins = groupMarks[groupName];
    if (!logins) continue;
    for (const [index, login] of logins.entries()) {
      await db.groupAttendance.create({ data: {
        lessonId: lesson.id, userId: users.get(login).id,
        status: index === 1 ? "ABSENT" : index === 2 ? "EXCUSED" : "PRESENT",
      } });
    }
  }
  const qrLesson = groupLessonRows.find((lesson) => lesson.groupId === groupRows.get("ИВТ-21-1").id);
  if (qrLesson) await db.attendanceQr.create({ data: { lessonId: qrLesson.id, token: randomBytes(24).toString("hex"), expiresAt: shift(new Date(), 0.01) } });

  for (const person of people.filter((item) => item.role === "STUDENT")) {
    const titles = subjects[person.group];
    for (const [index, title] of titles.entries()) {
      for (let term = 1; term <= 4; term += 1) {
        const assessment = assessmentOf(title);
        const score = 44 + ((index * 7 + term * 11 + person.login.length * 3) % 47);
        const past = term < 4;
        const finalGrade = !past ? null : assessment === "TEST" ? null : 2 + ((index + term + person.login.length) % 4);
        const passed = !past || assessment !== "TEST" ? null : (index + term + person.login.length) % 7 !== 0;
        await db.grade.create({ data: {
          userId: users.get(person.login).id, title, term, score, threshold: 60, assessment,
          finalGrade: finalGrade && finalGrade < 2 ? 2 : finalGrade,
          passed,
        } });
      }
    }
  }
  await db.grade.updateMany({ where: { userId: users.get("student").id, title: "Дискретная математика", term: 2 }, data: { finalGrade: 4, passed: null, assessment: "EXAM" } });
  await db.grade.updateMany({ where: { userId: users.get("student").id, title: "Базы данных", term: 3 }, data: { finalGrade: null, passed: null } });

  const deadlinePlan = [
    ["student", "Отчёт по лабораторной № 3", "Технологии программирования", 1, "23:59", null, 0],
    ["student", "Реферат по ИС", "Управление данными", -1, "18:00", null, 1],
    ["student", "Презентация проекта", "Проектирование интерфейсов", -1, "16:00", -1, 2],
    ["student", "Курсовая работа", "Базы данных", 12, "12:00", null, null],
    ["student", "Эссе по философии", "Философия", 5, "23:59", null, null],
    ["student", "Лабораторная по сетям", "Компьютерные сети", 3, "23:59", null, null],
    ["student2", "Контрольная по матанализу", "Математический анализ", 2, "12:00", null, null],
    ["student2", "Эссе по английскому", "Английский язык", 6, "23:59", null, null],
    ["student3", "Отчёт по практике", "Базы данных", 4, "23:59", null, null],
    ["student7", "Проект по веб-разработке", "Веб-разработка", 8, "23:59", null, null],
  ];
  for (const [login, title, course, dayOffset, time, completedOffset, lessonIndex] of deadlinePlan) {
    await db.deadline.create({ data: {
      userId: users.get(login).id, title, course,
      lessonId: lessonIndex === null ? null : lessonIds[lessonIndex],
      dueAt: at(dayOffset, time),
      completedAt: completedOffset === null ? null : at(completedOffset, "12:00"),
    } });
  }

  const requestPlan = [
    ["student", "STUDY", "READY", "Справка готова. Заберите в кабинете 302 до 25 ноября.", 2],
    ["student", "MILITARY", "PROCESSING", null, -1],
    ["student", "APPOINTMENT", "NEW", null, null],
    ["student2", "MILITARY", "CANCELLED", "Отменена студентом.", null],
    ["student2", "STUDY", "PROCESSING", null, 3],
    ["student3", "STUDY", "READY", "Можно забирать.", 1],
    ["student3", "APPOINTMENT", "REJECTED", "Нужна запись через деканат.", null],
    ["student4", "MILITARY", "NEW", null, null],
    ["student5", "STUDY", "NEW", null, null],
    ["student6", "APPOINTMENT", "PROCESSING", null, 2],
    ["student7", "STUDY", "READY", null, -1],
    ["student8", "MILITARY", "PROCESSING", null, 4],
    ["student9", "STUDY", "NEW", null, null],
    ["student10", "APPOINTMENT", "REJECTED", "Перенесено на следующую неделю.", null],
  ];
  for (const [index, [login, type, status, comment, readyOffset]] of requestPlan.entries()) {
    await db.serviceRequest.create({ data: {
      userId: users.get(login).id, type, status, comment,
      number: "З-2026-" + String(1000 + index).padStart(4, "0"),
      readyBy: readyOffset === null ? null : at(readyOffset, "23:59"),
      createdAt: at(-(index % 9) - 1, "10:00"),
      updatedAt: at(-(index % 5), "12:00"),
      revision: index % 3,
    } });
  }

  await db.notification.createMany({ data: [
    { userId: users.get("student").id, title: "Заявка обработана", body: "Справка об обучении готова: кабинет 302.", readAt: shift(new Date(), -1) },
    { userId: users.get("student").id, title: "Перенос занятия", body: "Лабораторная по проектированию интерфейсов перенесена на 12:40.", readAt: null },
    { userId: users.get("student").id, title: "Новый дедлайн", body: "Отчёт по лабораторной № 3 — до завтра.", readAt: null },
    { userId: users.get("student").id, title: "Зачёт по базам данных", body: "Консультация в среду в 11:15, аудитория 204.", readAt: shift(new Date(), -2) },
    { userId: users.get("student").id, title: "Стипендия", body: "Выплата за ноябрь поступит до 25 ноября.", readAt: null },
    { userId: users.get("student2").id, title: "Новый дедлайн", body: "Контрольная по матанализу через два дня.", readAt: null },
    { userId: users.get("student2").id, title: "Библиотека", body: "Книга «Основы алгоритмов» ждёт вас на выдаче.", readAt: null },
    { userId: users.get("student3").id, title: "Заявка обработана", body: "Справка об обучении готова.", readAt: null },
    { userId: users.get("student7").id, title: "Проект", body: "Защита проекта по веб-разработке в пятницу.", readAt: null },
  ] });

  await db.news.createMany({ data: [
    { title: "Приём заявок на справки", body: "Справку об обучении можно заказать во вкладке «Сервисы». Статус заявки обновляется там же." },
    { title: "График зимней сессии", body: "Расписание зачётов и экзаменов опубликуют до 1 декабря в разделе «Календарь»." },
    { title: "Стипендия за ноябрь", body: "Выплата поступит на карты до 25 ноября. Вопросы — в учебный офис." },
    { title: "Консультации по курсовым", body: "Кафедра информационных систем проводит консультации по средам в 16:00, аудитория 204." },
    { title: "Запись в библиотеку", body: "Электронный каталог доступен в «Сервисах кампуса»: бронирование книг и продление." },
    { title: "Хакатон кампуса", body: "Регистрация команд до 30 ноября. Ищите объявление на доске «Сервисов кампуса»." },
    { title: "Пересдача зачётов", body: "Запись на пересдачу открыта в разделе бронирования: выберите слот «Пересдача»." },
    { title: "Спортивный зал", body: "Свободные тренировки доступны по записи; проверьте расписание в «Сервисах кампуса»." },
  ] });

  await db.auditEntry.createMany({ data: [
    { groupId: groupRows.get("ИВТ-21-1").id, actorId: users.get("office").id, summary: "Проверены заявки группы ИВТ-21-1" },
    { groupId: groupRows.get("ИВТ-21-1").id, actorId: users.get("office").id, summary: "Заявка З-2026-1000 · В работе → Готово" },
    { groupId: groupRows.get("ИВТ-21-2").id, actorId: users.get("office").id, summary: "Опубликовано объявление для курса 3" },
    { groupId: groupRows.get("ПИ-22-1").id, actorId: users.get("office2").id, summary: "Добавлено занятие «Веб-разработка»" },
    { groupId: groupRows.get("ИБ-23-1").id, actorId: users.get("office2").id, summary: "Отмечена посещаемость группы ИБ-23-1" },
    { groupId: groupRows.get("ИВТ-21-1").id, actorId: users.get("office").id, summary: "Оценка · Иван Петров · Базы данных · 47/60" },
  ] });

  const books = [
    ["Базы данных: практикум", "Л. Облачный"],
    ["Основы алгоритмов", "М. Янтарная"],
    ["Компьютерные сети", "Р. Лунин"],
    ["Проектирование интерфейсов", "А. Волкова"],
    ["Дискретная математика", "И. Гусев"],
    ["История информатики", "Е. Соколова"],
    ["Английский для ИТ", "Н. Морозова"],
    ["Безопасность жизнедеятельности", "П. Орлов"],
    ["Веб-разработка", "Д. Белов"],
    ["Математический анализ", "С. Тимофеев"],
  ];
  const bookRows = new Map();
  for (const [title, author] of books) {
    bookRows.set(title, await db.campusBook.create({ data: { title, author } }));
  }
  await db.campusLoan.createMany({ data: [
    { userId: users.get("student").id, bookId: bookRows.get("Базы данных: практикум").id, dueAt: at(2, "18:00") },
    { userId: users.get("student").id, bookId: bookRows.get("Основы алгоритмов").id, dueAt: at(-2, "18:00"), renewed: true },
    { userId: users.get("student3").id, bookId: bookRows.get("Компьютерные сети").id, dueAt: at(-1, "18:00") },
    { userId: users.get("student7").id, bookId: bookRows.get("Веб-разработка").id, dueAt: at(5, "18:00") },
  ] });
  await db.campusHold.createMany({ data: [
    { userId: users.get("student2").id, bookId: bookRows.get("Компьютерные сети").id },
    { userId: users.get("student4").id, bookId: bookRows.get("Проектирование интерфейсов").id },
  ] });

  const postRows = [];
  const posts = [
    ["student", "Команды", "Собираем команду на хакатон", "Ищем участника для тестового проекта по навигации в кампусе.", 14],
    ["student2", "Учёба", "Обмен конспектами по матанализу", "Готовлюсь к контрольной, могу поделиться конспектами.", 10],
    ["student3", "Барахолка", "Продаю учебник по базам данных", "Состояние хорошее, цена договорная.", 20],
    ["student7", "События", "Встреча клуба веб-разработки", "В пятницу в коворкинге разберём React Server Components.", 7],
    ["student9", "Потеряшки", "Найдена зачётка", "Нашёл в аудитории 105, обращайтесь.", 30],
  ];
  for (const [login, category, title, body, days] of posts) {
    postRows.push(await db.campusPost.create({ data: {
      userId: users.get(login).id, category, title, body, expiresAt: at(days, "21:00"),
    } }));
  }
  await db.campusReply.createMany({ data: [
    { postId: postRows[0].id, userId: users.get("student3").id, body: "Готов присоединиться, напишите в личку." },
    { postId: postRows[1].id, userId: users.get("student5").id, body: "Скиньте, пожалуйста, конспект по пределам." },
    { postId: postRows[3].id, userId: users.get("student").id, body: "Приду, интересно про серверные компоненты." },
  ] });

  await db.campusPortfolio.createMany({ data: [
    { userId: users.get("student").id, title: "Победитель хакатона «Кампус 2026»", kind: "Хакатон", description: "Командный проект навигации по кампусу, роль — фронтенд.", link: "https://example.ru/projects/campus", occurredAt: at(-40, "12:00"), shared: true },
    { userId: users.get("student").id, title: "Курс по TypeScript", kind: "Курс", description: "Сертификат о прохождении курса, 40 часов.", occurredAt: at(-90, "12:00"), shared: false },
    { userId: users.get("student").id, title: "Староста группы ИВТ-21-1", kind: "Общественная работа", description: "Веду журнал посещаемости и помогаю куратору.", occurredAt: at(-120, "12:00"), shared: true },
    { userId: users.get("student2").id, title: "Статья в студенческом сборнике", kind: "Публикация", description: "Обзор методов кластеризации.", occurredAt: at(-60, "12:00"), shared: true },
    { userId: users.get("student7").id, title: "Волонтёрство на дне открытых дверей", kind: "Волонтёрство", description: "Помогал с навигацией абитуриентов.", occurredAt: at(-30, "12:00"), shared: true },
  ] });

  const slotPlan = [
    ["CONSULTATION", "Консультация по базам данных", "Аудитория 204", 0, "11:15", "11:45", 4, "ИВТ-21-1"],
    ["RETAKE", "Пересдача по базам данных", "Аудитория 320", 0, "11:00", "11:45", 2, "ИВТ-21-1"],
    ["ROOM", "Комната для командных встреч", "Аудитория 105", 1, "14:00", "15:00", 1, null],
    ["COWORKING", "Рабочее место", "Коворкинг · зал А", 0, "13:00", "15:00", 4, null],
    ["EQUIPMENT", "Комплект микроконтроллеров", "Лаборатория 203", 0, "15:00", "16:00", 2, null],
    ["SPORT", "Тренировка по физкультуре", "Спортивный зал", 0, "12:00", "12:20", 8, null],
    ["CONSULTATION", "Консультация по курсовой", "Аудитория 204", 2, "16:00", "17:00", 3, "ПИ-22-1"],
    ["COWORKING", "Рабочее место", "Коворкинг · зал Б", 1, "10:00", "12:00", 6, null],
  ];
  const slotRows = [];
  for (const [kind, title, place, dayOffset, from, to, capacity, groupName] of slotPlan) {
    slotRows.push(await db.campusSlot.create({ data: {
      kind, title, place, capacity, startsAt: at(dayOffset, from), endsAt: at(dayOffset, to),
      staffId: users.get("office").id, groupId: groupName ? groupRows.get(groupName).id : null,
    } }));
  }
  await db.campusBooking.createMany({ data: [
    { userId: users.get("student").id, slotId: slotRows[0].id },
    { userId: users.get("student").id, slotId: slotRows[4].id },
    { userId: users.get("student2").id, slotId: slotRows[0].id },
    { userId: users.get("student3").id, slotId: slotRows[3].id },
    { userId: users.get("student7").id, slotId: slotRows[6].id },
  ] });

  const token = randomBytes(24).toString("hex");
  await db.campusPass.create({ data: {
    userId: users.get("student").id, digest: createHash("sha256").update(token).digest("hex"),
    expiresAt: at(0, "23:59"),
  } });

  console.log([
    "Готово:",
    people.length + " пользователей,",
    groups.length + " групп,",
    (await db.lesson.count()) + " личных занятий,",
    (await db.groupLesson.count()) + " групповых пар,",
    (await db.grade.count()) + " оценок,",
    (await db.deadline.count()) + " дедлайнов,",
    (await db.serviceRequest.count()) + " заявок,",
    (await db.notification.count()) + " уведомлений,",
    (await db.news.count()) + " новостей,",
    (await db.attendance.count()) + " отметок посещения,",
    (await db.groupAttendance.count()) + " отметок групп,",
    (await db.campusSlot.count()) + " слотов кампуса,",
    (await db.campusBook.count()) + " книг,",
    (await db.campusPost.count()) + " объявлений,",
    (await db.campusPortfolio.count()) + " записей портфолио.",
  ].join(" "));
} finally {
  await db.$disconnect();
}
