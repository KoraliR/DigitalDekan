import { PrismaClient, CampusSlotKind } from "@prisma/client";

if (process.env.DEMO_2FA_ENABLED !== "true") throw new Error("Разрешено только для учебной базы.");
const db = new PrismaClient();
try {
  const student = await db.user.findUniqueOrThrow({ where: { login: "demo-student-1" }, include: { studentProfile: true } });
  const staff = await db.user.findUniqueOrThrow({ where: { login: "demo-staff" }, include: { staffProfile: { include: { groups: true } } } });
  const groupId = student.studentProfile?.groupId;
  if (!groupId || !staff.staffProfile?.groups.some(({ id }) => id === groupId)) throw new Error("Сначала создайте демогруппу и учётные записи.");
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Moscow", dateStyle: "short" }).format(new Date());
  const at = (time, offset = 0) => new Date(Date.parse(day + "T" + time + ":00+03:00") + offset * 86400000);
  const rows = [
    ["CONSULTATION", "Консультация по базам данных", "Аудитория 204", "11:15", "11:45", 1, 4],
    ["RETAKE", "Базы данных", "Аудитория 320", "11:00", "11:45", 2, 2],
    ["ROOM", "Комната для командных встреч", "Аудитория 105", "14:00", "15:00", 1, 1],
    ["COWORKING", "Рабочее место", "Коворкинг · зал А", "13:00", "15:00", 1, 4],
    ["EQUIPMENT", "Комплект микроконтроллеров", "Лаборатория 203", "15:00", "16:00", 1, 2],
    ["SPORT", "Тренировка по физкультуре", "Спортивный зал", "12:00", "12:20", 1, 8],
  ];
  await db.$transaction(async (tx) => {
    for (const [title, start, end] of [["Демо · Семинар по ИС", "09:45", "11:00"], ["Демо · Лабораторная по сетям", "12:40", "13:55"]]) {
      const startsAt = at(start, 1);
      if (!await tx.groupLesson.findFirst({ where: { groupId, title, startsAt } })) {
        await tx.groupLesson.create({ data: { groupId, title, startsAt, endsAt: at(end, 1), teacher: staff.name, room: "204", type: "PRACTICE" } });
      }
    }
    for (const [kind, title, place, start, end, offset, capacity] of rows) {
      const startsAt = at(start, offset);
      const endsAt = at(end, offset);
      await tx.campusSlot.upsert({
        where: { kind_place_startsAt: { kind, place, startsAt } }, update: {},
        create: { kind, place, startsAt, endsAt, capacity, title, staffId: staff.id, groupId, retakeTerm: kind === CampusSlotKind.RETAKE ? 1 : null },
      });
    }
    if (!await tx.grade.findFirst({ where: { userId: student.id, title: "Базы данных", term: 1 } })) {
      await tx.grade.create({ data: { userId: student.id, title: "Базы данных", term: 1, score: 47, threshold: 60, assessment: "EXAM" } });
    }

    for (const [title, author] of [["Базы данных: практикум", "Л. Облачный"], ["Основы алгоритмов", "М. Янтарная"], ["Компьютерные сети", "Р. Лунин"]]) {
      const book = await tx.campusBook.upsert({ where: { title }, update: {}, create: { title, author } });
      if (title === "Базы данных: практикум") {
        await tx.campusLoan.upsert({ where: { bookId_userId: { userId: student.id, bookId: book.id } }, update: {},
          create: { userId: student.id, bookId: book.id, dueAt: at("18:00", 2) } });
      }
    }
    if (!await tx.campusPost.findFirst({ where: { userId: student.id, title: "Собираем команду на хакатон" } })) {
      await tx.campusPost.create({ data: { userId: student.id, title: "Собираем команду на хакатон", category: "Команды",
        body: "Ищем участника для тестового проекта по навигации в кампусе.", expiresAt: at("21:00", 14) } });
    }
  });
  console.log("Слоты, учебники и демонстрационное объявление готовы.");
} finally {
  await db.$disconnect();
}
