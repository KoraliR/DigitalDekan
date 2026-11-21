/**
 * Полный демонстрационный сид «Цифрового деканата».
 *
 * Наполняет базу данными «живого вуза»: 3 факультета, 10 групп, 84 студента,
 * 7 сотрудников, групповое и личное расписание на 13 недель (понедельник
 * текущей недели − 6 недель … пятница + 6 недель), оценки за 4 семестра,
 * дедлайны, заявки, уведомления, новости, аудит и сервисы кампуса.
 *
 * Принципы:
 *  • «сегодня» — дата запуска, поэтому окно расписания всегда актуально;
 *  • при повторном запуске демо-данные полностью пересобираются, чужие
 *    пользователи не удаляются (они обновляются upsert-ом по login);
 *  • bcrypt-хеш пароля считается один раз и переиспользуется;
 *  • даты и случайные значения воспроизводимы (фиксированный seed ГПСЧ).
 *
 * Запуск:  npm run db:seed   (или node --env-file-if-exists=.env scripts/seed-full.mjs)
 * Пароль:  DEMO_ACCOUNT_PASSWORD, по умолчанию «dekanat-2026».
 */

import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const password = process.env.DEMO_ACCOUNT_PASSWORD ?? "dekanat-2026";
if (password.length < 10 || Buffer.byteLength(password) > 72) {
  throw new Error("DEMO_ACCOUNT_PASSWORD: минимум 10 символов и не больше 72 байт.");
}

const db = new PrismaClient();
const startedAt = Date.now();
// Один хеш на все аккаунты: bcrypt cost 12 в цикле сделал бы сид невыносимо медленным.
const passwordHash = hashSync(password, 12);

/* ============================== время (Europe/Moscow) ============================== */

const today = new Date();
const now = new Date();
const dayKey = (date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow" }).format(date);
const todayKey = dayKey(today);
// 0 — понедельник, 6 — воскресенье.
const dow = (new Date(todayKey + "T12:00:00+03:00").getUTCDay() + 6) % 7;
const monday = -dow;
const at = (offset, time) => new Date(
  Date.parse(todayKey + "T12:00:00+03:00") + offset * 86400000 +
  (Date.parse(todayKey + "T" + time + ":00+03:00") - Date.parse(todayKey + "T12:00:00+03:00")),
);
const shift = (date, days) => new Date(+date + days * 86400000);
const endOfToday = new Date(todayKey + "T23:59:59+03:00");
const WEEK_FROM = -6;
const WEEK_TO = 6;
const WEEKS = WEEK_TO - WEEK_FROM + 1;

/* ============================== детерминированный ГПСЧ ============================== */

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20261121);
const pick = (items) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
const randInt = (min, max) => min + Math.floor(random() * (max - min + 1));
const chance = (probability) => random() < probability;

/* ============================== справочники ============================== */

const fullNames = {
  "Калинина И. В.": { name: "Калинина Ирина Викторовна", position: "доцент" },
  "Подгорный М. С.": { name: "Подгорный Михаил Сергеевич", position: "старший преподаватель" },
  "Волкова А. Н.": { name: "Волкова Анна Николаевна", position: "доцент" },
  "Орлов Д. В.": { name: "Орлов Дмитрий Викторович", position: "профессор" },
  "Гусев А. П.": { name: "Гусев Алексей Петрович", position: "доцент" },
  "Соколова Е. А.": { name: "Соколова Елена Андреевна", position: "доцент" },
  "Морозова Н. К.": { name: "Морозова Наталья Кирилловна", position: "старший преподаватель" },
  "Белов Д. А.": { name: "Белов Дмитрий Андреевич", position: "доцент" },
  "Тимофеев С. П.": { name: "Тимофеев Сергей Павлович", position: "профессор" },
  "Лебедева О. И.": { name: "Лебедева Ольга Ивановна", position: "доцент" },
  "Никитин В. Ю.": { name: "Никитин Виктор Юрьевич", position: "старший преподаватель" },
  "Ершова М. А.": { name: "Ершова Мария Алексеевна", position: "доцент" },
  "Романов К. И.": { name: "Романов Кирилл Игоревич", position: "ассистент" },
  "Сидоров П. А.": { name: "Сидоров Павел Анатольевич", position: "старший преподаватель" },
  "Белова А. С.": { name: "Белова Анна Сергеевна", position: "ассистент" },
};
const teacher = (short) => [{
  name: fullNames[short]?.name ?? short,
  position: fullNames[short]?.position ?? "преподаватель",
}];

const facultyOne = "Факультет программной инженерии";
const facultyTwo = "Факультет информационной безопасности";
const facultyThree = "Факультет прикладной математики и информатики";

const institutes = {
  [facultyOne]: "Институт информационных технологий",
  [facultyTwo]: "Институт информационной безопасности",
  [facultyThree]: "Институт прикладной математики и информатики",
};

const campusMain = "Главный корпус, ул. Примерная, 1";
const campusB = "Корпус Б, ул. Примерная, 3";
const campusLab = "Лабораторный корпус, ул. Примерная, 5";
const campuses = [campusMain, campusB, campusLab];

const programs = {
  "ИВТ": { code: "09.03.01", name: "Информатика и вычислительная техника", department: "Кафедра информационных систем" },
  "ПИ": { code: "09.03.04", name: "Программная инженерия", department: "Кафедра программной инженерии" },
  "ИБ": { code: "10.03.01", name: "Информационная безопасность", department: "Кафедра информационной безопасности" },
  "ПМИ": { code: "01.03.02", name: "Прикладная математика и информатика", department: "Кафедра прикладной математики" },
};

// Существующие группы и курсы сохранены как в прежнем демо-сиде.
const groups = [
  { name: "ИВТ-21-1", code: "ИВТ", faculty: facultyOne, course: 3 },
  { name: "ИВТ-21-2", code: "ИВТ", faculty: facultyOne, course: 3 },
  { name: "ИВТ-22-1", code: "ИВТ", faculty: facultyOne, course: 2 },
  { name: "ПИ-22-1", code: "ПИ", faculty: facultyOne, course: 2 },
  { name: "ПИ-21-1", code: "ПИ", faculty: facultyOne, course: 3 },
  { name: "ИБ-23-1", code: "ИБ", faculty: facultyTwo, course: 1 },
  { name: "ИБ-22-1", code: "ИБ", faculty: facultyTwo, course: 2 },
  { name: "ИБ-20-1", code: "ИБ", faculty: facultyTwo, course: 4 },
  { name: "ПМИ-23-1", code: "ПМИ", faculty: facultyThree, course: 1 },
  { name: "ПМИ-22-1", code: "ПМИ", faculty: facultyThree, course: 2 },
];
const groupsByFaculty = (faculty) => groups.filter((group) => group.faculty === faculty).map((group) => group.name);

const subjectsByCode = {
  "ИВТ": ["Технологии программирования", "Управление данными", "Базы данных", "Проектирование интерфейсов", "Дискретная математика", "Английский язык"],
  "ПИ": ["Алгоритмы и структуры данных", "Веб-разработка", "Математический анализ", "Английский язык", "Экономика", "Физика"],
  "ИБ": ["Основы информатики", "Математика", "История", "Английский язык", "Безопасность жизнедеятельности", "Физическая культура"],
  "ПМИ": ["Математический анализ", "Дискретная математика", "Алгоритмы и структуры данных", "Теория вероятностей", "Программирование на Python", "Английский язык"],
};

const subjectTeacher = {
  "Технологии программирования": "Калинина И. В.",
  "Управление данными": "Подгорный М. С.",
  "Базы данных": "Орлов Д. В.",
  "Проектирование интерфейсов": "Волкова А. Н.",
  "Дискретная математика": "Гусев А. П.",
  "Английский язык": "Морозова Н. К.",
  "Алгоритмы и структуры данных": "Гусев А. П.",
  "Веб-разработка": "Волкова А. Н.",
  "Математический анализ": "Тимофеев С. П.",
  "Экономика": "Соколова Е. А.",
  "Физика": "Никитин В. Ю.",
  "Основы информатики": "Соколова Е. А.",
  "Математика": "Тимофеев С. П.",
  "История": "Лебедева О. И.",
  "Безопасность жизнедеятельности": "Романов К. И.",
  "Физическая культура": "Сидоров П. А.",
  "Теория вероятностей": "Тимофеев С. П.",
  "Программирование на Python": "Калинина И. В.",
};

function assessmentOf(title) {
  if (/Базы данных|Дискретная|Информатика|Математический анализ|^Математика$|Теория вероятностей|Физика/.test(title)) return "EXAM";
  if (/Проектирование|Английский|Физическая|История|Безопасность|Экономика/.test(title)) return "TEST";
  return "COURSEWORK";
}

const rooms = ["105", "204", "320", "203", "108"];
const slotTimes = [
  ["08:30", "10:00"],
  ["10:20", "11:50"],
  ["12:40", "14:10"],
  ["14:20", "15:50"],
  ["16:00", "17:30"],
];

/* ============================== люди: студенты ============================== */

// Сохранённые аккаунты старого сида: логины, ФИО и группы не меняем,
// их используют сквозные QA-сценарии.
const preservedStudents = [
  { login: "student", name: "Иван Петров", group: "ИВТ-21-1", stress: 0, studentId: "З-21-004317", monitor: true, funding: "BUDGET" },
  { login: "student2", name: "Полина Смирнова", group: "ИВТ-21-2", stress: 2, studentId: "З-21-004318", funding: "BUDGET" },
  { login: "student3", name: "Артём Соколов", group: "ИВТ-21-1", stress: 0, studentId: "З-21-004319", funding: "BUDGET" },
  { login: "student4", name: "Дарья Лебедева", group: "ИВТ-21-1", stress: 1, studentId: "З-21-004320", funding: "CONTRACT" },
  { login: "student5", name: "Никита Волков", group: "ИВТ-21-2", stress: 0, studentId: "З-21-004321", funding: "BUDGET" },
  { login: "student6", name: "Софья Морозова", group: "ИВТ-21-2", stress: 1, studentId: "З-21-004322", funding: "BUDGET" },
  { login: "student7", name: "Максим Кузнецов", group: "ПИ-22-1", stress: 0, studentId: "З-22-005101", funding: "BUDGET" },
  { login: "student8", name: "Алиса Фёдорова", group: "ПИ-22-1", stress: 2, studentId: "З-22-005102", funding: "BUDGET" },
  { login: "student9", name: "Егор Павлов", group: "ИБ-23-1", stress: 0, studentId: "З-23-006201", funding: "CONTRACT" },
  { login: "student10", name: "Варвара Никитина", group: "ИБ-23-1", stress: 1, studentId: "З-23-006202", funding: "BUDGET" },
];

const groupSizes = { "ИВТ-21-1": 9, "ИВТ-21-2": 9, "ПИ-22-1": 9, "ИБ-23-1": 9 };
const groupSize = (name) => groupSizes[name] ?? 8;

const maleFirst = ["Иван", "Артём", "Никита", "Максим", "Егор", "Пётр", "Алексей", "Дмитрий", "Сергей", "Андрей",
  "Кирилл", "Роман", "Владислав", "Глеб", "Михаил", "Тимофей", "Даниил", "Матвей", "Фёдор", "Борис",
  "Виктор", "Павел", "Степан", "Илья", "Арсений", "Лев", "Тимур", "Олег", "Григорий", "Вениамин"];
const femaleFirst = ["Полина", "Дарья", "Софья", "Варвара", "Алиса", "Анна", "Мария", "Екатерина", "Ольга", "Елена",
  "Анастасия", "Виктория", "Ксения", "Милана", "Юлия", "Татьяна", "Вероника", "Диана", "Лидия", "Светлана",
  "Наталья", "Ирина", "Валентина", "Инна", "Яна", "Александра", "Арина", "Елизавета", "Карина", "Нелли"];
const maleLast = ["Соколов", "Кузнецов", "Павлов", "Волков", "Смирнов", "Фёдоров", "Морозов", "Лебедев", "Новиков", "Егоров",
  "Ковалёв", "Попов", "Андреев", "Макаров", "Зайцев", "Крылов", "Тарасов", "Белов", "Орлов", "Киселёв",
  "Гордеев", "Ершов", "Богданов", "Логинов", "Савельев", "Чернов", "Осипов", "Филиппов", "Поляков", "Щербаков"];
const femaleLast = ["Соколова", "Кузнецова", "Павлова", "Волкова", "Смирнова", "Фёдорова", "Морозова", "Лебедева", "Новикова", "Егорова",
  "Ковалёва", "Попова", "Андреева", "Макарова", "Зайцева", "Крылова", "Тарасова", "Белова", "Орлова", "Киселёва",
  "Гордеева", "Ершова", "Богданова", "Логинова", "Савельева", "Чернова", "Осипова", "Филиппова", "Полякова", "Щербакова"];

const usedNames = new Set(preservedStudents.map((person) => person.name));
// Пул «имя + фамилия» перемешиваем детерминированным ГПСЧ, чтобы ФИО выглядели
// естественно и не повторялись (10 сохранённых аккаунтов вычитаем по множеству).
function buildNamePool(firsts, lasts) {
  const pool = [];
  for (const first of firsts) {
    for (const last of lasts) pool.push(first + " " + last);
  }
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool;
}
const maleNames = buildNamePool(maleFirst, maleLast);
const femaleNames = buildNamePool(femaleFirst, femaleLast);
let maleCursor = 0;
let femaleCursor = 0;
function uniqueStudentName() {
  for (let attempt = 0; attempt < 4000; attempt += 1) {
    const female = (maleCursor + femaleCursor) % 2 === 1;
    const name = female ? femaleNames[femaleCursor++] : maleNames[maleCursor++];
    if (name && !usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  throw new Error("Не удалось подобрать уникальное ФИО студента — расширьте списки имён и фамилий.");
}

const vowelsRe = /[аеёиоуыэюя]/i;
function stressIndexes(name) {
  const surname = name.split(" ").at(-1) ?? "";
  return [...surname].flatMap((letter, index) => (vowelsRe.test(letter) ? [index] : []));
}

const groupMembers = new Map(groups.map((group) => [group.name, []]));
const students = [];

// Прежде всего — сохранённые аккаунты (порядок student, student2 … student10).
// Знак ударения из старого сида сохраняем, только если он попадает на гласную;
// иначе ставим на первую гласную фамилии, чтобы подсказка в профиле была корректной.
for (const person of preservedStudents) {
  const group = groups.find((item) => item.name === person.group);
  const surname = person.name.split(" ").at(-1) ?? "";
  const restoredStress = person.stress !== null && vowelsRe.test(surname[person.stress] ?? "") ? person.stress : null;
  const student = {
    login: person.login,
    name: person.name,
    group,
    stress: restoredStress ?? stressIndexes(person.name)[0] ?? null,
    studentId: person.studentId,
    monitor: Boolean(person.monitor),
    funding: person.funding ?? "BUDGET",
  };
  students.push(student);
  groupMembers.get(group.name).push(student);
}

// Затем добиваем группы до нужного размера: student11 … student84.
let loginCounter = 11;
for (const group of groups) {
  while (groupMembers.get(group.name).length < groupSize(group.name)) {
    const login = "student" + loginCounter;
    loginCounter += 1;
    const name = uniqueStudentName();
    const admissionYear = group.name.split("-")[1];
    const student = {
      login,
      name,
      group,
      stress: null,
      studentId: "З-" + admissionYear + "-" + String(100000 + students.length * 13).padStart(6, "0"),
      monitor: false,
      funding: random() < 0.22 ? "CONTRACT" : "BUDGET",
    };
    students.push(student);
    groupMembers.get(group.name).push(student);
  }
}

// Ровно один староста в каждой группе; student — староста ИВТ-21-1 (уже отмечен).
// В новых группах старостами становятся новые студенты, чтобы не менять
// привычные роли сохранённых аккаунтов student2 … student10.
const preservedLogins = new Set(preservedStudents.map((person) => person.login));
for (const group of groups) {
  const members = groupMembers.get(group.name);
  if (!members.some((student) => student.monitor)) {
    const candidate = members.find((student) => !preservedLogins.has(student.login)) ?? members[0];
    candidate.monitor = true;
  }
}

// Полные профили: у каждой группы студент получает свой студенческий билет и контакты.
const phoneStem = 100;
for (const [index, student] of students.entries()) {
  student.phone = "+7 900 " + String(phoneStem + index) + "-" + String(10 + (index * 3) % 90).padStart(2, "0") + "-" + String(10 + (index * 7) % 90).padStart(2, "0");
  student.contactEmail = student.login + "@student.example.ru";
  student.messengerUrl = "https://t.me/" + student.login;
  if (student.stress === null) {
    // Ударение ставим части студентов и только на реальную гласную фамилии.
    const vowels = stressIndexes(student.name);
    student.stress = vowels.length && index % 3 === 0 ? vowels[index % vowels.length] : null;
  }
  student.monitor = Boolean(student.monitor);
}

/* ============================== люди: сотрудники ============================== */

const staffPlan = [
  { login: "office", name: "Мария Орлова", scope: "all" },
  { login: "office2", name: "Сергей Кузнецов", scope: ["ПИ-22-1", "ИБ-23-1"] },
  { login: "office3", name: "Анна Белова", scope: groupsByFaculty(facultyOne) },
  { login: "office4", name: "Дмитрий Соколов", scope: groupsByFaculty(facultyTwo) },
  { login: "office5", name: "Елена Лебедева", scope: groupsByFaculty(facultyThree) },
  { login: "office6", name: "Игорь Морозов", scope: ["ИВТ-21-2", "ПМИ-23-1"] },
  { login: "office7", name: "Ольга Никитина", scope: ["ИБ-20-1"] },
];
const staffMembers = staffPlan.map((person) => ({
  ...person,
  groupNames: person.scope === "all" ? groups.map((group) => group.name) : person.scope,
}));
for (const staff of staffMembers) {
  if (staff.groupNames.some((name) => !groups.some((group) => group.name === name))) {
    throw new Error("Сотрудник " + staff.login + ": неизвестная группа в области видимости.");
  }
}

// Куратор группы: сначала узкий сотрудник, затем глава деканата.
function staffForGroup(groupName) {
  const narrow = staffMembers.find((staff) => staff.login !== "office" && staff.groupNames.includes(groupName));
  return (narrow ?? staffMembers[0]).login;
}
const staffByLogin = new Map(staffMembers.map((staff) => [staff.login, staff]));
const staffByGroup = new Map(groups.map((group) => [group.name, staffByLogin.get(staffForGroup(group.name))]));

/* ============================== вспомогательные функции записи ============================== */

async function insertMany(model, rows, batchSize = 600) {
  for (let index = 0; index < rows.length; index += batchSize) {
    await db[model].createMany({ data: rows.slice(index, index + batchSize) });
  }
}

async function insertManyAndReturn(model, rows, batchSize = 500) {
  const result = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    result.push(...await db[model].createManyAndReturn({ data: rows.slice(index, index + batchSize) }));
  }
  return result;
}

function keyed(rows, keyOf) {
  const map = new Map();
  for (const row of rows) map.set(keyOf(row), row);
  return map;
}

function roundUpMinutes(date, step) {
  const result = new Date(date);
  result.setSeconds(0, 0);
  const remainder = result.getMinutes() % step;
  if (remainder) result.setMinutes(result.getMinutes() + (step - remainder));
  return result;
}

/* ============================== сид ============================== */

try {
  /* ---------- 1. Полная очистка демо-данных (порядок безопасен для FK) ---------- */
  await db.loginChallenge.deleteMany({});
  await db.attendanceQr.deleteMany({});
  await db.groupAttendance.deleteMany({});
  await db.attendance.deleteMany({});
  await db.auditEntry.deleteMany({});
  await db.groupLesson.deleteMany({});
  await db.lesson.deleteMany({});
  await db.grade.deleteMany({});
  await db.deadline.deleteMany({});
  await db.serviceRequest.deleteMany({});
  await db.notification.deleteMany({});
  await db.news.deleteMany({});
  await db.campusPass.deleteMany({});
  await db.campusPortfolio.deleteMany({});
  await db.campusReply.deleteMany({});
  await db.campusPost.deleteMany({});
  await db.campusHold.deleteMany({});
  await db.campusLoan.deleteMany({});
  await db.campusBook.deleteMany({});
  await db.campusBooking.deleteMany({});
  await db.campusSlot.deleteMany({});
  await db.staffProfile.deleteMany({});
  await db.studentProfile.deleteMany({});
  await db.studyGroup.deleteMany({});

  /* ---------- 2. Группы ---------- */
  const groupRows = keyed(
    await db.studyGroup.createManyAndReturn({ data: groups.map(({ name, faculty, course }) => ({ name, faculty, course })) }),
    (row) => row.name,
  );
  for (const student of students) student.groupId = groupRows.get(student.group.name).id;
  const groupNameById = new Map([...groupRows.values()].map((row) => [row.id, row.name]));

  /* ---------- 3. Пользователи (upsert по login, чужих не удаляем) ---------- */
  const usersByLogin = new Map();
  for (const person of [...staffMembers, ...students]) {
    const user = await db.user.upsert({
      where: { login: person.login },
      update: { name: person.name, role: person.group ? "STUDENT" : "STAFF", passwordHash },
      create: { login: person.login, name: person.name, role: person.group ? "STUDENT" : "STAFF", passwordHash },
    });
    usersByLogin.set(person.login, user);
    person.userId = user.id;
  }
  const userById = new Map([...usersByLogin.values()].map((user) => [user.id, user]));

  /* ---------- 4. Профили студентов и сотрудников ---------- */
  const studentProfiles = students.map((student) => {
    const program = programs[student.group.code];
    const birthYear = 2009 - student.group.course;
    const birthMonth = 1 + (students.indexOf(student) % 12);
    const birthDay = 1 + (students.indexOf(student) * 5) % 27;
    return {
      userId: student.userId,
      groupId: student.groupId,
      birthDate: new Date(birthYear + "-" + String(birthMonth).padStart(2, "0") + "-" + String(birthDay).padStart(2, "0") + "T00:00:00+03:00"),
      studentId: student.studentId,
      institute: institutes[student.group.faculty],
      faculty: student.group.faculty,
      department: program.department,
      programCode: program.code,
      programName: program.name,
      course: student.group.course,
      groupName: student.group.name,
      funding: student.funding,
      phone: student.phone,
      contactEmail: student.contactEmail,
      messengerUrl: student.messengerUrl,
      surnameStress: student.stress,
      isMonitor: student.monitor,
    };
  });
  await insertMany("studentProfile", studentProfiles, 200);
  for (const staff of staffMembers) {
    await db.staffProfile.create({
      data: { userId: staff.userId, groups: { connect: staff.groupNames.map((name) => ({ id: groupRows.get(name).id })) } },
    });
  }

  /* ---------- 5. Оценки: 6 предметов × 4 семестра на студента ---------- */
  const grades = [];
  const failedByGroup = new Map(groups.map((group) => [group.name, []]));
  const failedSeen = new Set();
  for (const [studentIndex, student] of students.entries()) {
    const subjects = subjectsByCode[student.group.code];
    const lowPerformer = studentIndex % 9 === 2 || studentIndex % 13 === 5;
    for (const [subjectIndex, title] of subjects.entries()) {
      let assessment = assessmentOf(title);
      for (let term = 1; term <= 4; term += 1) {
        // Основная масса студентов учится на «хорошо» и «отлично»; у слабых
        // студентов часть баллов ниже порога, плюс есть точечные «хвосты».
        const base = lowPerformer ? 56 : 68;
        let score = base + ((subjectIndex * 7 + term * 11 + studentIndex * 5) % 34) - 6;
        score = Math.max(32, Math.min(98, score));
        // Гарантированные «хвосты»: у части студентов есть провалы в разных семестрах.
        if (studentIndex % 4 === 1 && subjectIndex === studentIndex % 6 && term === 1 + (studentIndex % 3)) {
          score = 34 + (studentIndex % 18);
        }
        if (studentIndex % 7 === 3 && subjectIndex === (studentIndex + 2) % 6 && term === 4) {
          score = 40 + (studentIndex % 15);
        }
        let finalGrade = null;
        let passed = null;
        if (term <= 3) {
          if (assessment === "TEST") {
            passed = score >= 60;
          } else {
            finalGrade = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : 2;
            passed = finalGrade >= 3;
          }
        }
        // Особые случаи прежнего демо для аккаунта student (на них завязаны QA-сценарии).
        if (student.login === "student") {
          if (title === "Дискретная математика" && term === 2) {
            score = 78; assessment = "EXAM"; finalGrade = 4; passed = null;
          }
          if (title === "Базы данных" && term === 3) {
            score = 55; finalGrade = null; passed = null;
          }
          if (title === "Управление данными" && term === 4) {
            score = 48; finalGrade = null; passed = null;
          }
          if (title === "Проектирование интерфейсов" && term === 2) {
            score = 52; assessment = "TEST"; finalGrade = null; passed = false;
          }
        }
        const practiceScore = Math.min(40, Math.round(score * 0.4));
        const attendanceScore = Math.min(20, Math.round(score * 0.2));
        const controlScore = Math.max(0, Math.min(40, score - practiceScore - attendanceScore));
        grades.push({
          userId: student.userId, title, term, assessment, threshold: 60, score,
          practiceScore, attendanceScore, controlScore, finalGrade, passed,
        });
        const failed = term === 4 ? score < 60 : assessment === "TEST" ? passed === false : finalGrade === 2;
        if (failed) {
          const key = student.group.name + "|" + title + "|" + term;
          if (!failedSeen.has(key)) {
            failedSeen.add(key);
            failedByGroup.get(student.group.name).push({ title, term });
          }
        }
      }
    }
  }
  await insertMany("grade", grades, 500);

  /* ---------- 6. Групповое расписание: 5 пар в неделю на 13 недель ---------- */
  const groupLessonPlan = [];
  const usedGroupLessonKeys = new Set();
  const regularGroupLessons = [];
  const commentPool = [
    "Возьмите конспекты и ноутбуки",
    "Контрольная работа по пройденному материалу",
    "Разбор домашнего задания",
    "Подготовьте вопросы к зачёту",
    "Занятие в формате командной работы",
  ];
  for (const [groupIndex, group] of groups.entries()) {
    const subjects = subjectsByCode[group.code];
    for (let week = WEEK_FROM; week <= WEEK_TO; week += 1) {
      for (let day = 0; day < 5; day += 1) {
        const dayOffset = monday + week * 7 + day;
        const time = slotTimes[(day + groupIndex + (week - WEEK_FROM)) % slotTimes.length];
        const type = day < 4 ? ["LECTURE", "PRACTICE", "LAB", "SEMINAR"][day] : (week + groupIndex) % 3 === 0 ? "EXAM" : "TEST";
        const title = subjects[(week - WEEK_FROM + day + groupIndex * 2) % subjects.length];
        const startsAt = at(dayOffset, time[0]);
        const endsAt = at(dayOffset, time[1]);
        const key = group.name + "|" + (+startsAt);
        if (usedGroupLessonKeys.has(key)) continue;
        usedGroupLessonKeys.add(key);
        const moved = (groupIndex * 5 + (week - WEEK_FROM) * 3 + day) % 23 === 0;
        const commented = moved || (groupIndex + (week - WEEK_FROM) + day) % 11 === 0;
        groupLessonPlan.push({
          groupId: groupRows.get(group.name).id,
          title,
          teacher: subjectTeacher[title] ?? pick(staffMembers.map((staff) => staff.name)),
          room: rooms[(day + groupIndex + week - WEEK_FROM) % rooms.length],
          type,
          campus: (day + groupIndex) % 4 === 0 ? null : campuses[(day + groupIndex) % campuses.length],
          teachers: teacher(subjectTeacher[title] ?? "Белова А. С."),
          comment: moved ? "Перенесено из аудитории 204" : commented ? pick(commentPool) : null,
          originalStartsAt: moved ? shift(startsAt, -1) : null,
          originalEndsAt: moved ? shift(endsAt, -1) : null,
          startsAt,
          endsAt,
        });
      }
    }
  }
  const createdGroupLessons = await insertManyAndReturn("groupLesson", groupLessonPlan, 400);
  regularGroupLessons.push(...createdGroupLessons);

  // Две дополнительные пары ИВТ-21-1 на сегодня: одна с QR-кодом, одна без отметок
  // для сценария «Посещение» у сотрудника. Время всегда в будущем.
  const groupOneId = groupRows.get("ИВТ-21-1").id;
  const busyGroupOne = regularGroupLessons
    .filter((lesson) => lesson.groupId === groupOneId)
    .map((lesson) => [+lesson.startsAt, +lesson.endsAt]);
  const pickFreeStart = (base) => {
    let start = +base;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (!busyGroupOne.some(([from, to]) => start < to && start + 90 * 60000 > from)) break;
      start += 25 * 60000;
    }
    const result = new Date(start);
    busyGroupOne.push([+result, +result + 90 * 60000]);
    return result;
  };
  let seededTodayStart = roundUpMinutes(new Date(+now + 25 * 60000), 5);
  if (dayKey(seededTodayStart) !== todayKey) seededTodayStart = at(1, "09:30");
  const lessonAStart = pickFreeStart(seededTodayStart);
  const lessonBStart = pickFreeStart(new Date(+lessonAStart + 2 * 3600000));
  const extraGroupLessons = await insertManyAndReturn("groupLesson", [
    {
      groupId: groupOneId, title: "Консультация по курсовой работе", teacher: "Волкова А. Н.", room: "204", type: "SEMINAR",
      campus: campusMain, teachers: teacher("Волкова А. Н."), comment: "Консультация перед защитой курсовых · аудитория 204",
      startsAt: lessonAStart, endsAt: new Date(+lessonAStart + 90 * 60000),
    },
    {
      groupId: groupOneId, title: "Практикум по подготовке к сессии", teacher: "Орлов Д. В.", room: "320", type: "PRACTICE",
      campus: campusMain, teachers: teacher("Орлов Д. В."), comment: "Разбираем типовые задачи к экзамену",
      startsAt: lessonBStart, endsAt: new Date(+lessonBStart + 90 * 60000),
    },
  ], 10);
  const allGroupLessons = [...regularGroupLessons, ...extraGroupLessons];

  /* ---------- 7. QR-коды: 1–2 активные пары ИВТ-21-1, истекают через 10–15 минут ---------- */
  await db.attendanceQr.createMany({
    data: extraGroupLessons.map((lesson, index) => ({
      lessonId: lesson.id,
      token: randomBytes(24).toString("hex"),
      expiresAt: new Date(+now + (12 + index * 3) * 60000),
    })),
  });

  /* ---------- 8. Личные занятия: 2 в неделю на студента (≈2000+) ---------- */
  const personalPlan = [
    { title: "Электив: олимпиадное программирование", type: "PRACTICE", teacher: "Калинина И. В." },
    { title: "Индивидуальная консультация по курсовой работе", type: "SEMINAR", teacher: "Гусев А. П." },
    { title: "Физическая культура · секция волейбола", type: "PRACTICE", teacher: "Сидоров П. А." },
    { title: "Лабораторный практикум по сетям", type: "LAB", teacher: "Никитин В. Ю." },
    { title: "Консультация по выпускной работе", type: "SEMINAR", teacher: "Орлов Д. В." },
    { title: "Тренажёр по алгоритмам и структурам данных", type: "PRACTICE", teacher: "Подгорный М. С." },
    { title: "Кружок робототехники и встраиваемых систем", type: "LAB", teacher: "Романов К. И." },
    { title: "Английский разговорный клуб", type: "SEMINAR", teacher: "Морозова Н. К." },
    { title: "Учебная практика: консультация руководителя", type: "SEMINAR", teacher: "Лебедева О. И." },
    { title: "Подготовительный курс к олимпиаде по математике", type: "PRACTICE", teacher: "Тимофеев С. П." },
  ];
  // 17:40 и позже: групповые пары заканчиваются в 17:30, поэтому пересечений нет.
  const personalTimes = [["17:40", "19:10"], ["18:50", "20:20"]];
  const personalPlanRows = [];
  const personalKeys = new Set();
  for (const [studentIndex, student] of students.entries()) {
    const days = [(studentIndex * 3) % 5, (studentIndex * 3 + 2) % 5];
    for (let week = WEEK_FROM; week <= WEEK_TO; week += 1) {
      for (const [slotIndex, day] of days.entries()) {
        const dayOffset = monday + week * 7 + day;
        const time = personalTimes[slotIndex];
        const plan = personalPlan[(studentIndex * 2 + slotIndex + (week - WEEK_FROM)) % personalPlan.length];
        const startsAt = at(dayOffset, time[0]);
        const endsAt = at(dayOffset, time[1]);
        const key = student.userId + "|" + (+startsAt);
        if (personalKeys.has(key)) continue;
        personalKeys.add(key);
        const moved = (studentIndex * 3 + (week - WEEK_FROM) * 2 + slotIndex) % 41 === 0;
        personalPlanRows.push({
          userId: student.userId,
          title: plan.title,
          teacher: plan.teacher,
          room: rooms[(studentIndex + day + week - WEEK_FROM) % rooms.length],
          type: plan.type,
          groups: [student.group.name],
          campus: (studentIndex + week) % 13 === 0 ? null : campuses[(studentIndex + day) % campuses.length],
          teachers: teacher(plan.teacher),
          originalStartsAt: moved ? shift(startsAt, -2) : null,
          originalEndsAt: moved ? shift(endsAt, -2) : null,
          startsAt,
          endsAt,
        });
      }
    }
  }
  const createdPersonalLessons = await insertManyAndReturn("lesson", personalPlanRows, 500);
  const personalByUser = new Map();
  for (const lesson of createdPersonalLessons) {
    personalByUser.set(lesson.userId, [...(personalByUser.get(lesson.userId) ?? []), lesson]);
  }
  for (const lessons of personalByUser.values()) lessons.sort((left, right) => +left.startsAt - +right.startsAt);

  /* ---------- 9. Посещаемость групповых пар (все прошедшие — отмечены) ---------- */
  const studentsByGroupIds = new Map(groups.map((group) => [group.name, []]));
  for (const student of students) studentsByGroupIds.get(student.group.name).push(student.userId);
  const pastGroupLessons = allGroupLessons.filter((lesson) => +lesson.endsAt <= +now);
  const studentId = usersByLogin.get("student").id;
  const lastGroupOnePast = pastGroupLessons
    .filter((lesson) => lesson.groupId === groupOneId)
    .sort((left, right) => +right.startsAt - +left.startsAt)
    .slice(0, 2)
    .map((lesson) => lesson.id);
  const forcePresentGroup = new Set(lastGroupOnePast);
  const groupAttendanceRows = [];
  for (const lesson of pastGroupLessons) {
    const groupName = groupNameById.get(lesson.groupId);
    const memberIds = studentsByGroupIds.get(groupName) ?? [];
    for (const memberId of memberIds) {
      const roll = random();
      let status = roll < 0.9 ? "PRESENT" : roll < 0.96 ? "ABSENT" : "EXCUSED";
      if (memberId === studentId && forcePresentGroup.has(lesson.id)) status = "PRESENT";
      groupAttendanceRows.push({ lessonId: lesson.id, userId: memberId, status });
    }
  }
  await insertMany("groupAttendance", groupAttendanceRows, 1000);

  /* ---------- 10. Посещаемость личных занятий ---------- */
  const pastPersonalByUser = new Map();
  for (const [userId, lessons] of personalByUser.entries()) {
    pastPersonalByUser.set(userId, lessons.filter((lesson) => +lesson.endsAt <= +now));
  }
  const forcePresentPersonal = new Set(
    (pastPersonalByUser.get(studentId) ?? []).slice(-2).map((lesson) => lesson.id),
  );
  const attendanceRows = [];
  for (const lesson of createdPersonalLessons) {
    if (+lesson.endsAt > +now) continue;
    const roll = random();
    let status = roll < 0.88 ? "PRESENT" : roll < 0.95 ? "ABSENT" : "EXCUSED";
    if (lesson.userId === studentId && forcePresentPersonal.has(lesson.id)) status = "PRESENT";
    attendanceRows.push({ lessonId: lesson.id, userId: lesson.userId, status });
  }
  await insertMany("attendance", attendanceRows, 1000);

  /* ---------- 11. Дедлайны: 4–6 на студента, −25…+35 дней ---------- */
  const deadlineKinds = ["Отчёт по лабораторной работе", "Курсовая работа", "Реферат", "Домашнее задание", "Презентация проекта", "Контрольная работа", "Эссе"];
  const deadlineTimes = ["23:59", "18:00", "12:00", "16:00"];
  const deadlines = [];
  for (const [studentIndex, student] of students.entries()) {
    const subjects = subjectsByCode[student.group.code];
    const personalLessons = personalByUser.get(student.userId) ?? [];
    let plan;
    if (student.login === "student") {
      plan = [
        { title: "Отчёт по лабораторной № 3", course: "Технологии программирования", offset: 1, time: "23:59", completed: null },
        { title: "Реферат по ИС", course: "Управление данными", offset: -1, time: "18:00", completed: null },
        { title: "Презентация проекта", course: "Проектирование интерфейсов", offset: -1, time: "16:00", completed: -1 },
        { title: "Курсовая работа", course: "Базы данных", offset: 12, time: "12:00", completed: null },
        { title: "Эссе по философии", course: "Философия", offset: 5, time: "23:59", completed: null },
        { title: "Лабораторная по сетям", course: "Компьютерные сети", offset: 3, time: "23:59", completed: null },
      ];
    } else {
      const count = student.monitor ? 6 : 5;
      // Разброс по всему окну −25…+35 дней от сегодня, с прошедшими (часть сдана)
      // и будущими работами.
      const base = [-22, -12, -3, 5, 18, 33];
      plan = Array.from({ length: count }, (_, index) => {
        const subject = subjects[(studentIndex + index) % subjects.length];
        return {
          title: deadlineKinds[(studentIndex + index * 3) % deadlineKinds.length] + " «" + subject + "»",
          course: subject,
          offset: base[index % base.length] + (studentIndex % 5) - 2,
          time: deadlineTimes[(studentIndex + index) % deadlineTimes.length],
          completed: base[index % base.length] < 0 && (studentIndex + index) % 3 !== 0 ? base[index % base.length] + 1 : null,
        };
      });
    }
    for (const [index, item] of plan.entries()) {
      const dueAt = at(item.offset, item.time);
      const lesson = index < 3 && personalLessons[index] ? personalLessons[index] : (personalLessons.length && chance(0.35) ? pick(personalLessons) : null);
      deadlines.push({
        userId: student.userId,
        title: item.title,
        course: item.course,
        dueAt,
        lessonId: lesson?.id ?? null,
        completedAt: item.completed === null ? null : at(item.completed, "12:00"),
      });
    }
  }
  await insertMany("deadline", deadlines, 500);

  /* ---------- 12. Заявки: 120+ на всю базу ---------- */
  const statusPlan = ["NEW", "PROCESSING", "READY", "REJECTED", "CANCELLED", "NEW", "READY", "PROCESSING", "NEW", "READY"];
  const typePlan = ["STUDY", "MILITARY", "APPOINTMENT"];
  const requestTimePool = ["09:10", "10:00", "11:30", "12:45", "14:00", "15:45", "17:20"];
  const readyComments = [
    "Справка готова. Заберите в учебном офисе, кабинет 302.",
    "Документ подписан, можно забирать.",
    "Готово, проверьте личный кабинет.",
  ];
  const rejectComments = ["Не хватает документов — обратитесь в деканат.", "Нужна запись через деканат.", "Перенесено на следующую неделю."];
  const requestPlanRows = [];
  let requestNumberCounter = 10001;
  const pushRequest = (userId, type, status, createdAt, options = {}) => {
    const updatedAt = status === "NEW" ? null : shift(createdAt, 1);
    requestPlanRows.push({
      userId,
      type,
      status,
      number: "З-2026-" + String(requestNumberCounter).padStart(5, "0"),
      comment: options.comment ?? null,
      readyBy: options.readyBy ?? null,
      revision: options.revision ?? 0,
      createdAt,
      updatedAt,
    });
    requestNumberCounter += 1;
  };
  for (const [studentIndex, student] of students.entries()) {
    if (student.login === "student") {
      pushRequest(student.userId, "STUDY", "READY", at(-5, "10:00"), { comment: "Справка готова. Заберите в кабинете 302 до 25 ноября.", readyBy: at(-1, "23:59"), revision: 1 });
      pushRequest(student.userId, "MILITARY", "PROCESSING", at(-3, "14:20"), { readyBy: at(-2, "23:59"), revision: 1 });
      pushRequest(student.userId, "APPOINTMENT", "NEW", at(-1, "09:40"));
      continue;
    }
    const count = student.monitor ? 3 : 2;
    for (let index = 0; index < count; index += 1) {
      const status = statusPlan[(studentIndex * 2 + index) % statusPlan.length];
      const type = typePlan[(studentIndex + index) % typePlan.length];
      const createdAt = at(-randInt(1, 29), pick(requestTimePool));
      const options = { revision: status === "NEW" ? 0 : randInt(0, 2) };
      if (status === "READY") {
        options.comment = pick(readyComments);
        options.readyBy = at(-randInt(1, 10), "23:59");
      } else if (status === "REJECTED") {
        options.comment = pick(rejectComments);
      } else if (status === "CANCELLED") {
        options.comment = "Отменена студентом.";
      } else if (chance(0.45)) {
        // Просроченные заявки в работе — для дашборда сотрудника.
        options.readyBy = at(-randInt(1, 9), "23:59");
      } else if (chance(0.5)) {
        options.readyBy = at(randInt(2, 10), "23:59");
      }
      pushRequest(student.userId, type, status, createdAt, options);
    }
  }
  await insertMany("serviceRequest", requestPlanRows, 300);

  /* ---------- 13. Уведомления: 150+, последние 2 недели ---------- */
  const notificationPool = [
    { title: "Заявка обработана", body: "Справка об обучении готова: кабинет 302." },
    { title: "Перенос занятия", body: "Лабораторная по проектированию интерфейсов перенесена на 12:40." },
    { title: "Новый дедлайн", body: "Отчёт по лабораторной № 3 — до завтра." },
    { title: "Зачёт по базам данных", body: "Консультация в среду в 11:15, аудитория 204." },
    { title: "Стипендия", body: "Выплата за ноябрь поступит до 25 ноября." },
    { title: "Библиотека", body: "Книга «Основы алгоритмов» ждёт вас на выдаче." },
    { title: "Запись подтверждена", body: "Ждём вас в коворкинге в субботу в 10:00." },
    { title: "Изменение расписания", body: "Пара по базам данных перенесена в аудиторию 320." },
  ];
  const notifications = [];
  for (const [studentIndex, student] of students.entries()) {
    if (student.login === "student") {
      notifications.push(
        { userId: student.userId, title: "Заявка обработана", body: "Справка об обучении готова: кабинет 302.", readAt: at(-1, "12:00"), createdAt: at(-2, "10:15") },
        { userId: student.userId, title: "Перенос занятия", body: "Лабораторная по проектированию интерфейсов перенесена на 12:40.", readAt: null, createdAt: at(-1, "18:40") },
        { userId: student.userId, title: "Новый дедлайн", body: "Отчёт по лабораторной № 3 — до завтра.", readAt: null, createdAt: at(0, "08:30") },
        { userId: student.userId, title: "Зачёт по базам данных", body: "Консультация в среду в 11:15, аудитория 204.", readAt: at(-2, "19:00"), createdAt: at(-3, "15:00") },
        { userId: student.userId, title: "Стипендия", body: "Выплата за ноябрь поступит до 25 ноября.", readAt: null, createdAt: at(-4, "11:00") },
      );
      continue;
    }
    for (let index = 0; index < 2; index += 1) {
      const item = notificationPool[(studentIndex * 2 + index) % notificationPool.length];
      const createdAt = at(-randInt(0, 13), pick(requestTimePool));
      notifications.push({
        userId: student.userId,
        title: item.title,
        body: item.body,
        createdAt,
        readAt: chance(0.45) ? new Date(+createdAt + randInt(1, 20) * 3600000) : null,
      });
    }
  }
  // Сотрудникам — уведомления о новых заявках.
  for (const staff of staffMembers) {
    notifications.push({
      userId: staff.userId,
      title: "Новая заявка",
      body: "Поступила заявка от студента вашей группы. Проверьте раздел «Заявки».",
      createdAt: at(-randInt(0, 5), "09:30"),
      readAt: chance(0.5) ? at(-randInt(0, 3), "10:00") : null,
    });
  }
  await insertMany("notification", notifications, 500);

  /* ---------- 14. Новости: аудитории all / group / faculty / course / staff ---------- */
  const newsAuthor = (login) => usersByLogin.get(login).id;
  const newsRows = [
    { title: "Приём заявок на справки", body: "Справку об обучении можно заказать во вкладке «Услуги». Статус заявки обновляется там же.", audience: "all", createdById: newsAuthor("office") },
    { title: "График зимней сессии", body: "Расписание зачётов и экзаменов опубликуют до 1 декабря в разделе «Календарь».", audience: "all", createdById: newsAuthor("office2") },
    { title: "Стипендия за ноябрь", body: "Выплата поступит на карты до 25 ноября. Вопросы — в учебный офис.", audience: "all", kind: "reminder", createdById: newsAuthor("office") },
    { title: "Запись в библиотеку", body: "Электронный каталог доступен в «Сервисах кампуса»: бронирование книг и продление.", audience: "all", createdById: newsAuthor("office4") },
    { title: "Хакатон кампуса", body: "Регистрация команд до 30 ноября. Ищите объявление на доске «Сервисов кампуса».", audience: "all", createdById: newsAuthor("office3") },
  ];
  for (const [index, group] of groups.entries()) {
    newsRows.push({
      title: "Консультация для группы " + group.name,
      body: "В четверг в 16:00 разберём вопросы по курсовой работе в аудитории 204. Приходите с черновиками.",
      audience: "group:" + groupRows.get(group.name).id,
      kind: index % 2 === 0 ? "reminder" : "news",
      createdById: newsAuthor(staffForGroup(group.name)),
    });
  }
  for (const faculty of [facultyOne, facultyTwo, facultyThree]) {
    newsRows.push(
      {
        title: "День открытых дверей · " + faculty,
        body: "Помогите с навигацией абитуриентов в субботу. Запись у куратора группы.",
        audience: "faculty:" + faculty,
        createdById: newsAuthor("office"),
      },
      {
        title: "График консультаций преподавателей",
        body: "Консультации по курсовым работам проходят по вторникам и четвергам с 16:00 до 18:00.",
        audience: "faculty:" + faculty,
        kind: "reminder",
        createdById: newsAuthor("office"),
      },
    );
  }
  for (let course = 1; course <= 4; course += 1) {
    newsRows.push({
      title: "Курсовые работы · " + course + " курс",
      body: "Темы курсовых утверждены. Загрузите черновик в личный кабинет до конца месяца.",
      audience: "course:" + course,
      kind: course % 2 === 0 ? "reminder" : "news",
      createdById: newsAuthor("office"),
    });
  }
  for (const staff of staffMembers) {
    newsRows.push({
      title: "Сообщение для групп · " + staff.name,
      body: "Проверьте актуальность дедлайнов и посещаемости в разделе «Дедлайны». Вопросы — на консультации.",
      audience: "staff:" + staff.userId,
      createdById: staff.userId,
    });
  }
  for (const [index, row] of newsRows.entries()) {
    row.createdAt = at(-randInt(0, 20), pick(requestTimePool));
    row.kind = row.kind ?? (index % 4 === 0 ? "reminder" : "news");
  }
  await db.news.createMany({ data: newsRows });

  /* ---------- 15. Аудит: 150+ записей по разным группам ---------- */
  const auditSummaries = [
    (group, student) => "Проверены заявки группы " + group,
    (group) => "Опубликовано объявление для группы " + group,
    (group) => "Отмечена посещаемость группы " + group,
    (group) => "Добавлено занятие для группы " + group,
    (group, student, title) => "Оценка · " + student + " · " + title + " · 68/60",
    (group, student) => "Дедлайн · " + student + " · отчёт сдан",
    (group, student) => "Подтверждено посещение физкультуры · " + student,
    (group) => "Заявка З-2026-10" + randInt(100, 999) + " · В работе → Готово",
  ];
  const auditRows = [];
  for (let index = 0; index < 180; index += 1) {
    const group = groups[index % groups.length];
    const members = groupMembers.get(group.name);
    const student = members[index % members.length];
    const summary = auditSummaries[index % auditSummaries.length](group.name, student.name, subjectsByCode[group.code][index % 6]);
    const actor = staffByGroup.get(group.name) ?? staffMembers[0];
    auditRows.push({
      groupId: groupRows.get(group.name).id,
      actorId: usersByLogin.get(actor.login).id,
      summary,
      createdAt: at(-randInt(0, 29), pick(requestTimePool)),
    });
    // Общие действия без привязки к группе (например, объявление для всех групп).
    if (index % 17 === 0) {
      auditRows.push({
        groupId: null,
        actorId: usersByLogin.get("office").id,
        summary: "Опубликовано общее объявление для всех групп",
        createdAt: at(-randInt(0, 29), pick(requestTimePool)),
      });
    }
  }
  await db.auditEntry.createMany({ data: auditRows });

  /* ---------- 16. Библиотека: 30+ книг ---------- */
  const bookPlan = [
    ["Базы данных: практикум", "Л. Облачный", "978-5-97060-101-1"],
    ["Основы алгоритмов", "М. Янтарная", "978-5-97060-102-8"],
    ["Компьютерные сети", "Р. Лунин", "978-5-97060-103-5"],
    ["Проектирование интерфейсов", "А. Волкова", "978-5-97060-104-2"],
    ["Дискретная математика", "И. Гусев", "978-5-97060-105-9"],
    ["История информатики", "Е. Соколова", "978-5-97060-106-6"],
    ["Английский для ИТ", "Н. Морозова", "978-5-97060-107-3"],
    ["Безопасность жизнедеятельности", "П. Орлов", "978-5-97060-108-0"],
    ["Веб-разработка", "Д. Белов", "978-5-97060-109-7"],
    ["Математический анализ", "С. Тимофеев", "978-5-97060-110-3"],
    ["Технологии программирования на Java", "А. Калинина", "978-5-97060-111-0"],
    ["Управление данными: учебник", "М. Подгорный", "978-5-97060-112-7"],
    ["Информационная безопасность", "В. Никитин", "978-5-97060-113-4"],
    ["Криптография: курс лекций", "К. Романов", "978-5-97060-114-1"],
    ["Теория вероятностей и статистика", "М. Ершова", "978-5-97060-115-8"],
    ["Программирование на Python", "И. Лебедева", "978-5-97060-116-5"],
    ["Архитектура вычислительных систем", "Д. Орлов", "978-5-97060-117-2"],
    ["Операционные системы", "С. Гусев", "978-5-97060-118-9"],
    ["Компиляторы: принципы и практика", "А. Волкова", "978-5-97060-119-6"],
    ["Базы данных: теория и практика", "Л. Облачный", "978-5-97060-120-2"],
    ["Машинное обучение: вводный курс", "П. Соколов", "978-5-97060-121-9"],
    ["Алгоритмы на графах", "М. Янтарная", "978-5-97060-122-6"],
    ["Численные методы", "С. Тимофеев", "978-5-97060-123-3"],
    ["Физика для инженеров", "Н. Волкова", "978-5-97060-124-0"],
    ["Экономика ИТ-проектов", "Е. Соколова", "978-5-97060-125-7"],
    ["Философия науки", "О. Лебедева", "978-5-97060-126-4"],
    ["История России: краткий курс", "М. Морозова", "978-5-97060-127-1"],
    ["Правоведение", "И. Соколов", "978-5-97060-128-8"],
    ["Робототехника и микроконтроллеры", "К. Романов", "978-5-97060-129-5"],
    ["3D-моделирование", "А. Белова", "978-5-97060-130-1"],
    ["UX-исследования", "А. Волкова", "978-5-97060-131-8"],
    ["DevOps: практика", "Д. Белов", "978-5-97060-132-5"],
  ];
  const bookRows = await insertManyAndReturn("campusBook", bookPlan.map(([title, author, isbn]) => ({ title, author, isbn })), 200);
  const bookByTitle = keyed(bookRows, (row) => row.title);

  /* ---------- 17. Кампус: слоты на 2–3 недели ---------- */
  const slotKeys = new Set();
  const slotPlanRows = [];
  const addSlot = (row) => {
    const key = row.kind + "|" + row.place + "|" + (+row.startsAt);
    if (slotKeys.has(key)) return null;
    slotKeys.add(key);
    slotPlanRows.push(row);
    return row;
  };
  const staffId = (login) => usersByLogin.get(login).id;
  const nextSaturday = ((5 - dow + 7) % 7) || 7;
  const genericSlots = [
    ["COWORKING", "Рабочее место · коворкинг", "Коворкинг · зал А", 1, "10:00", "12:00", 6, "office6"],
    ["COWORKING", "Рабочее место · коворкинг", "Коворкинг · зал Б", 2, "10:00", "12:00", 6, "office6"],
    ["COWORKING", "Рабочее место · коворкинг", "Коворкинг · зал А", 6, "10:00", "12:00", 4, "office"],
    ["COWORKING", "Рабочее место · коворкинг", "Коворкинг · зал Б", 7, "10:00", "12:00", 4, "office"],
    ["COWORKING", "Рабочее место · коворкинг", "Коворкинг · зал А", 8, "20:30", "21:30", 4, "office"],
    ["COWORKING", "Рабочее место · коворкинг", "Коворкинг · зал Б", 13, "10:00", "12:00", 4, "office"],
    ["ROOM", "Комната для командных встреч", "Аудитория 105", 1, "14:00", "15:00", 1, "office"],
    ["ROOM", "Комната для командных встреч", "Аудитория 108", 3, "20:30", "21:30", 2, "office6"],
    ["ROOM", "Переговорная для проектной команды", "Переговорная 2-14", 6, "14:00", "15:30", 4, "office"],
    ["ROOM", "Комната для командных встреч", "Аудитория 105", 9, "20:30", "21:30", 1, "office"],
    ["EQUIPMENT", "Комплект микроконтроллеров", "Лаборатория 203", 2, "14:00", "16:00", 2, "office6"],
    ["EQUIPMENT", "Медиастудия для записи", "Медиастудия", 5, "20:30", "21:30", 1, "office"],
    ["EQUIPMENT", "Комплект микроконтроллеров", "Лаборатория 203", 8, "14:00", "16:00", 3, "office6"],
    ["EQUIPMENT", "3D-принтер", "Лаборатория 203", 12, "20:30", "21:30", 2, "office6"],
    ["SPORT", "Тренировка по физкультуре", "Спортивный зал", 1, "12:00", "13:30", 8, "office"],
    ["SPORT", "Тренировка по физкультуре", "Спортивный зал", 4, "20:30", "21:30", 8, "office"],
    ["SPORT", "Секция волейбола", "Тренажёрный зал", 7, "12:00", "13:30", 6, "office"],
    ["SPORT", "Тренировка по физкультуре", "Спортивный зал", 11, "20:30", "21:30", 8, "office"],
    ["CONSULTATION", "Консультация по базам данных", "Аудитория 204", 2, "11:00", "12:00", 4, "office", "ИВТ-21-1"],
    ["CONSULTATION", "Консультация по курсовой работе", "Аудитория 320", 5, "11:00", "12:00", 3, "office2", "ПИ-22-1"],
    ["CONSULTATION", "Консультация по матанализу", "Аудитория 105", 6, "11:00", "12:00", 4, "office5", "ПМИ-22-1"],
    ["CONSULTATION", "Консультация по алгоритмам", "Аудитория 204", 9, "11:00", "12:00", 4, "office3", "ИВТ-21-2"],
    ["CONSULTATION", "Консультация по ИБ", "Аудитория 320", 13, "11:00", "12:00", 3, "office2", "ИБ-23-1"],
    ["CONSULTATION", "Консультация по теории вероятностей", "Аудитория 105", 16, "11:00", "12:00", 4, "office5", "ПМИ-23-1"],
  ];
  for (const [kind, title, place, offset, from, to, capacity, login, groupName] of genericSlots) {
    addSlot({
      kind, title, place, capacity,
      startsAt: at(offset, from), endsAt: at(offset, to),
      staffId: staffId(login),
      groupId: groupName ? groupRows.get(groupName).id : null,
      retakeTerm: null,
    });
  }
  // Пересдачи: только по реально проваленным предметам конкретных групп.
  const retakePreferred = [
    { groupName: "ИВТ-21-1", title: "Управление данными", term: 4 },
    { groupName: "ИВТ-21-1", title: "Базы данных", term: 3 },
    { groupName: "ИВТ-21-1", title: "Проектирование интерфейсов", term: 2 },
  ];
  const retakeQueue = [...retakePreferred];
  for (const group of groups) {
    const failed = failedByGroup.get(group.name);
    for (const item of failed.slice(0, 2)) {
      if (!retakeQueue.some((row) => row.groupName === group.name && row.title === item.title && row.term === item.term)) {
        retakeQueue.push({ groupName: group.name, title: item.title, term: item.term });
      }
    }
  }
  const retakePlaces = ["Аудитория 320", "Аудитория 204", "Аудитория 108", "Аудитория 105"];
  const retakeTimes = ["10:00", "11:00", "12:00", "15:00", "16:00"];
  for (const [index, item] of retakeQueue.entries()) {
    const group = groups.find((row) => row.name === item.groupName);
    const offset = index < 3 ? nextSaturday : 1 + (index % 12);
    const from = retakeTimes[index % retakeTimes.length];
    const place = retakePlaces[index % retakePlaces.length];
    addSlot({
      kind: "RETAKE",
      title: item.title,
      place,
      capacity: 2 + (index % 3),
      startsAt: at(offset, from),
      endsAt: at(offset, String(Number(from.slice(0, 2)) + 1).padStart(2, "0") + ":" + from.slice(3)),
      staffId: staffId(staffByGroup.get(item.groupName).login),
      groupId: groupRows.get(item.groupName).id,
      retakeTerm: item.term,
    });
  }
  const createdSlots = await insertManyAndReturn("campusSlot", slotPlanRows, 200);
  const futureSlots = createdSlots.filter((slot) => +slot.startsAt > +now).sort((left, right) => +left.startsAt - +right.startsAt);

  /* ---------- 18. Записи студентов на слоты (без пересечений с расписанием) ---------- */
  const busyByUser = new Map();
  for (const lesson of allGroupLessons) {
    const groupName = groupNameById.get(lesson.groupId);
    for (const memberId of studentsByGroupIds.get(groupName) ?? []) {
      busyByUser.set(memberId, [...(busyByUser.get(memberId) ?? []), [+lesson.startsAt, +lesson.endsAt]]);
    }
  }
  for (const lesson of createdPersonalLessons) {
    busyByUser.set(lesson.userId, [...(busyByUser.get(lesson.userId) ?? []), [+lesson.startsAt, +lesson.endsAt]]);
  }
  const bookingRows = [];
  const bookedPairs = new Set();
  const tryBook = (student, slot) => {
    if (!slot) return false;
    const key = slot.id + "|" + student.userId;
    if (bookedPairs.has(key)) return false;
    const busy = busyByUser.get(student.userId) ?? [];
    if (busy.some(([from, to]) => +slot.startsAt < to && +slot.endsAt > from)) return false;
    bookedPairs.add(key);
    bookingRows.push({ slotId: slot.id, userId: student.userId, attended: false });
    return true;
  };
  const studentAccount = students.find((student) => student.login === "student");
  for (const slot of futureSlots) {
    if (bookingRows.length >= 3) break;
    if (slot.kind === "RETAKE") continue;
    tryBook(studentAccount, slot);
  }
  for (const [index, slot] of futureSlots.entries()) {
    if (bookingRows.length >= 26) break;
    for (let attempt = 0; attempt < 6 && bookingRows.length < 26; attempt += 1) {
      const student = students[(index * 7 + attempt * 13) % students.length];
      tryBook(student, slot);
    }
  }
  await insertMany("campusBooking", bookingRows, 300);

  /* ---------- 19. Выдачи книг: 40+, часть просрочены ---------- */
  const loanRows = [];
  const loanPairs = new Set();
  const addLoan = (student, book, { overdue = false, renewed = false } = {}) => {
    const key = book.id + "|" + student.userId;
    if (!book || loanPairs.has(key)) return false;
    loanPairs.add(key);
    loanRows.push({
      bookId: book.id,
      userId: student.userId,
      dueAt: overdue ? at(-randInt(2, 12), "18:00") : at(randInt(2, 16), "18:00"),
      renewed,
    });
    return true;
  };
  // Особые выдачи аккаунта student — как в прежнем демо.
  addLoan(students.find((student) => student.login === "student"), bookByTitle.get("Базы данных: практикум"), {});
  addLoan(students.find((student) => student.login === "student"), bookByTitle.get("Основы алгоритмов"), { overdue: true, renewed: true });
  const loanTarget = 48;
  for (let index = 0; index < 500 && loanRows.length < loanTarget; index += 1) {
    const student = students[(index * 7 + 3) % students.length];
    if (student.login === "student") continue;
    const book = bookRows[(index * 13 + 5) % bookRows.length];
    addLoan(student, book, { overdue: index % 3 === 0, renewed: index % 7 === 0 });
  }
  await insertMany("campusLoan", loanRows, 300);

  /* ---------- 20. Очередь на книги: 20+ ---------- */
  const holdRows = [];
  const holdPairs = new Set();
  for (let index = 0; index < 200 && holdRows.length < 24; index += 1) {
    const student = students[(index * 11 + 5) % students.length];
    const book = bookRows[(index * 5 + 11) % bookRows.length];
    const key = book.id + "|" + student.userId;
    if (loanPairs.has(key) || holdPairs.has(key)) continue;
    holdPairs.add(key);
    holdRows.push({ bookId: book.id, userId: student.userId, createdAt: at(-randInt(0, 20), "13:00") });
  }
  await insertMany("campusHold", holdRows, 200);

  /* ---------- 21. Доска объявлений: 25+ постов, 20+ ответов ---------- */
  const categories = ["Команды", "Общежитие", "Репетиторы"];
  const postPlan = [
    { login: "student", category: "Команды", title: "Собираем команду на хакатон", body: "Ищем участника для проекта по навигации в кампусе. Нужен фронтенд и немного дизайна." },
    { login: "student2", category: "Команды", title: "Обмен конспектами по матанализу", body: "Готовлюсь к контрольной, могу поделиться конспектами и разборами задач.", phone: "+7 900 110-11-11" },
    { login: "student3", category: "Команды", title: "Продаю учебник по базам данных", body: "Состояние хорошее, цена договорная. Пишите в личные сообщения." },
    { login: "student7", category: "Команды", title: "Встреча клуба веб-разработки", body: "В пятницу в коворкинге разберём серверные компоненты и сборку проектов." },
    { login: "student9", category: "Команды", title: "Найдена зачётка", body: "Нашёл в аудитории 105, обращайтесь в общежитие № 2." },
    { login: "student4", category: "Общежитие", title: "Меняю место в общежитии", body: "Ищу место ближе к учебному корпусу, этаж не важен." },
    { login: "student5", category: "Общежитие", title: "Нужен сосед в комнату", body: "Свободно место в комнате на 3 этаже, тихий блок." },
    { login: "student6", category: "Общежитие", title: "Отдам учебники первокурсникам", body: "Забирать в общежитии № 2, вход со стороны спортивной площадки." },
    { login: "student8", category: "Репетиторы", title: "Помогу с дискретной математикой", body: "Разбираю темы и задачи, возможны онлайн-занятия." },
    { login: "student10", category: "Репетиторы", title: "Репетитор по английскому", body: "Подготовка к зачёту, разговорная практика, помощь с эссе." },
  ];
  for (const row of postPlan) {
    const student = students.find((item) => item.login === row.login);
    row.userId = student.userId;
  }
  // Ещё 18 постов от разных студентов.
  const extraPostTitles = [
    "Ищу команду на курсовой проект", "Обменяю лабораторные по сетям", "Продаю монитор", "Сдам комнату в общежитии",
    "Помогу с физикой", "Нужны конспекты по истории", "Ищу напарника на хакатон", "Куплю учебник по компиляторам",
    "Репетитор по Python", "Отдам билеты на конференцию", "Собираю команду на олимпиаду", "Ищу велосипед на время сессии",
    "Помогу с вёрсткой", "Обменяю место в общежитии", "Продаю клавиатуру", "Ищу компанию для физкультуры",
    "Репетитор по математике", "Отдам старые конспекты",
  ];
  for (const [index, title] of extraPostTitles.entries()) {
    const student = students[(index * 5 + 13) % students.length];
    postPlan.push({
      userId: student.userId,
      category: categories[index % categories.length],
      title,
      body: "Подробности в личных сообщениях. Отвечаю быстро, можно договориться о встрече в кампусе.",
      phone: index % 3 === 0 ? "+7 900 110-2" + String(10 + index).slice(-2) + "-" + String(10 + (index * 7) % 90) : undefined,
    });
  }
  const postRows = await db.campusPost.createManyAndReturn({
    data: postPlan.map((row, index) => ({
      userId: row.userId,
      category: row.category,
      title: row.title,
      body: row.body,
      contactPhone: row.phone ?? null,
      contactEmail: null,
      expiresAt: index % 13 === 12 ? at(-2, "21:00") : at(3 + (index % 16), "21:00"),
      closed: index % 11 === 10,
      flagged: [4, 12, 19, 24].includes(index),
      createdAt: at(-randInt(0, 18), pick(requestTimePool)),
    })),
  });

  /* ---------- 22. Ответы на объявления: 20+ ---------- */
  const replyBodies = [
    "Готов присоединиться, напишите в личку.",
    "Скиньте, пожалуйста, подробности.",
    "Актуально? Могу подойти после пар.",
    "Интересно, давайте обсудим в коворкинге.",
    "Отпишусь в личные сообщения.",
    "Могу помочь с этим, пишите.",
  ];
  const replyRows = [];
  const replyPairs = new Set();
  for (let index = 0; index < 200 && replyRows.length < 22; index += 1) {
    const post = postRows[(index * 7 + 2) % postRows.length];
    const student = students[(index * 13 + 3) % students.length];
    const key = post.id + "|" + student.userId;
    if (post.userId === student.userId || replyPairs.has(key)) continue;
    replyPairs.add(key);
    replyRows.push({ postId: post.id, userId: student.userId, body: replyBodies[index % replyBodies.length] });
  }
  await insertMany("campusReply", replyRows, 200);

  /* ---------- 23. Портфолио: 60+ записей, часть shared ---------- */
  const portfolioPlan = [
    { login: "student", title: "Победитель хакатона «Кампус 2026»", kind: "Достижение", description: "Командный проект навигации по кампусу, роль — фронтенд.", link: "https://example.ru/projects/campus", shared: true },
    { login: "student", title: "Курс по TypeScript", kind: "Сертификат", description: "Сертификат о прохождении курса, 40 часов.", link: null, shared: false },
    { login: "student", title: "Староста группы ИВТ-21-1", kind: "Достижение", description: "Веду журнал посещаемости и помогаю куратору.", link: null, shared: true },
    { login: "student2", title: "Статья в студенческом сборнике", kind: "Проект", description: "Обзор методов кластеризации данных.", link: null, shared: true },
    { login: "student7", title: "Волонтёрство на дне открытых дверей", kind: "Достижение", description: "Помогал с навигацией абитуриентов.", link: null, shared: true },
  ];
  const portfolioTitles = ["Проект на React", "Участник олимпиады по программированию", "Сертификат по базам данных", "Мобильное приложение для расписания", "Публикация в сборнике", "Волонтёрский проект", "Курс по машинному обучению", "Хакатон по ИБ"];
  const portfolioKinds = ["Проект", "Достижение", "Сертификат"];
  const portfolioRows = [];
  for (const item of portfolioPlan) {
    const student = students.find((row) => row.login === item.login);
    portfolioRows.push({
      userId: student.userId, title: item.title, kind: item.kind, description: item.description,
      link: item.link, occurredAt: at(-randInt(20, 150), "12:00"), shared: item.shared,
    });
  }
  for (const [index, student] of students.entries()) {
    portfolioRows.push({
      userId: student.userId,
      title: portfolioTitles[(index + 3) % portfolioTitles.length] + (index % 4 === 0 ? " · " + student.group.name : ""),
      kind: portfolioKinds[index % portfolioKinds.length],
      description: "Учебный проект и общественная активность: команда из четырёх студентов, защита прошла успешно.",
      link: index % 5 === 0 ? "https://example.ru/portfolio/" + index : null,
      occurredAt: at(-randInt(10, 220), "12:00"),
      shared: index % 3 === 0,
    });
  }
  await insertMany("campusPortfolio", portfolioRows, 300);

  /* ---------- 24. Электронные пропуска: у каждого студента ---------- */
  await insertMany("campusPass", students.map((student) => {
    const token = randomBytes(24).toString("hex");
    return {
      userId: student.userId,
      digest: createHash("sha256").update(token).digest("hex"),
      expiresAt: endOfToday,
    };
  }), 200);

  /* ---------- 25. Итоговые счётчики ---------- */
  const [userCount, groupCount, studentCount, staffCount, counts, lessonRange, groupLessonRange] = await Promise.all([
    db.user.count(),
    db.studyGroup.count(),
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "STAFF" } }),
    (async () => ({
      lesson: await db.lesson.count(),
      groupLesson: await db.groupLesson.count(),
      grade: await db.grade.count(),
      deadline: await db.deadline.count(),
      serviceRequest: await db.serviceRequest.count(),
      notification: await db.notification.count(),
      news: await db.news.count(),
      attendance: await db.attendance.count(),
      groupAttendance: await db.groupAttendance.count(),
      auditEntry: await db.auditEntry.count(),
      campusSlot: await db.campusSlot.count(),
      campusBook: await db.campusBook.count(),
      campusLoan: await db.campusLoan.count(),
      campusHold: await db.campusHold.count(),
      campusPost: await db.campusPost.count(),
      campusReply: await db.campusReply.count(),
      campusPortfolio: await db.campusPortfolio.count(),
      campusPass: await db.campusPass.count(),
      campusBooking: await db.campusBooking.count(),
      attendanceQr: await db.attendanceQr.count(),
    }))(),
    db.lesson.aggregate({ _min: { startsAt: true }, _max: { startsAt: true } }),
    db.groupLesson.aggregate({ _min: { startsAt: true }, _max: { startsAt: true } }),
  ]);
  const formatDay = (date) => date ? dayKey(date) : "—";
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log([
    "Сид завершён за " + seconds + " с.",
    "Пользователи: " + userCount + " (студентов " + studentCount + ", сотрудников " + staffCount + ")",
    "Группы: " + groupCount,
    "Lesson: " + counts.lesson + " (" + formatDay(lessonRange._min.startsAt) + " … " + formatDay(lessonRange._max.startsAt) + ")",
    "GroupLesson: " + counts.groupLesson + " (" + formatDay(groupLessonRange._min.startsAt) + " … " + formatDay(groupLessonRange._max.startsAt) + ")",
    "Grade: " + counts.grade,
    "Deadline: " + counts.deadline,
    "ServiceRequest: " + counts.serviceRequest,
    "Notification: " + counts.notification,
    "News: " + counts.news,
    "Attendance: " + counts.attendance,
    "GroupAttendance: " + counts.groupAttendance,
    "AuditEntry: " + counts.auditEntry,
    "CampusSlot: " + counts.campusSlot,
    "CampusBook: " + counts.campusBook,
    "CampusLoan: " + counts.campusLoan,
    "CampusHold: " + counts.campusHold,
    "CampusBooking: " + counts.campusBooking,
    "CampusPost: " + counts.campusPost,
    "CampusReply: " + counts.campusReply,
    "CampusPortfolio: " + counts.campusPortfolio,
    "CampusPass: " + counts.campusPass,
    "AttendanceQr: " + counts.attendanceQr,
  ].join("\n"));
  console.log("Сегодня: " + todayKey + " · окно расписания: " + dayKey(at(monday + WEEK_FROM * 7, "08:30")) + " … " + dayKey(at(monday + WEEK_TO * 7 + 4, "17:30")));
} finally {
  await db.$disconnect();
}
