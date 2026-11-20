import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const password = process.env.DEMO_ACCOUNT_PASSWORD;
if (process.env.DEMO_2FA_ENABLED !== "true" || !password || password.length < 10 || Buffer.byteLength(password) > 72) {
  throw new Error("Включите DEMO_2FA_ENABLED и задайте DEMO_ACCOUNT_PASSWORD (10 символов или больше, до 72 байт).");
}
const db = new PrismaClient();
const passwordHash = await hash(password, 12);
try {
  await db.$transaction(async (tx) => {
    const first = await tx.studyGroup.upsert({
      where: { name: "ДЕМО-101" },
      update: { faculty: "Прикладные технологии", course: 1 },
      create: { name: "ДЕМО-101", faculty: "Прикладные технологии", course: 1 },
    });
    const second = await tx.studyGroup.upsert({
      where: { name: "ДЕМО-202" },
      update: { faculty: "Прикладные технологии", course: 2 },
      create: { name: "ДЕМО-202", faculty: "Прикладные технологии", course: 2 },
    });
    const one = await tx.user.upsert({
      where: { login: "demo-student-1" },
      update: { name: "Мира Искрина", role: "STUDENT", passwordHash, studentProfile: { upsert: { create: { groupId: first.id }, update: { groupId: first.id } } } },
      create: { login: "demo-student-1", name: "Мира Искрина", passwordHash, studentProfile: { create: { groupId: first.id } } },
    });
    const two = await tx.user.upsert({
      where: { login: "demo-student-2" },
      update: { name: "Лев Облачный", role: "STUDENT", passwordHash, studentProfile: { upsert: { create: { groupId: second.id }, update: { groupId: second.id } } } },
      create: { login: "demo-student-2", name: "Лев Облачный", passwordHash, studentProfile: { create: { groupId: second.id } } },
    });
    await tx.user.upsert({
      where: { login: "demo-staff" },
      update: { name: "Нина Ветрова", role: "STAFF", passwordHash, staffProfile: { upsert: { create: { groups: { connect: [{ id: first.id }] } }, update: { groups: { set: [{ id: first.id }] } } } } },
      create: { login: "demo-staff", name: "Нина Ветрова", role: "STAFF", passwordHash, staffProfile: { create: { groups: { connect: [{ id: first.id }] } } } },
    });

    const roster = [one];
    for (const [login, name] of [["demo-student-3", "Алиса Янтарная"], ["demo-student-4", "Роман Лунин"]]) {
      roster.push(await tx.user.upsert({
        where: { login },
        update: {},
        create: { login, name, passwordHash, studentProfile: { create: { groupId: first.id } } },
      }));
    }
    for (const [index, title] of ["Проектирование интерфейсов", "Основы программирования", "Компьютерные сети"].entries()) {
      const userId = roster[index].id;
      await tx.grade.upsert({
        where: { userId_title_term: { userId, title, term: 1 } },
        update: {},
        create: { userId, title, term: 1, score: 68 + index * 6, threshold: 60, assessment: "EXAM" },
      });
    }

    const requests = [
      { userId: one.id, type: "STUDY", number: "З-ДЕМО-0001" },
      { userId: two.id, type: "MILITARY", number: "З-ДЕМО-0002" },
    ];
    for (const request of requests) {
      const existing = await tx.serviceRequest.findFirst({ where: { userId: request.userId, type: request.type } });
      if (!existing) await tx.serviceRequest.create({ data: request });
    }

    await tx.grade.upsert({
      where: { userId_title_term: { userId: one.id, title: "Базы данных", term: 1 } },
      update: { score: 47, threshold: 60 },
      create: { userId: one.id, title: "Базы данных", score: 47, threshold: 60, term: 1, assessment: "EXAM" },
    });
    await tx.deadline.deleteMany({ where: { userId: one.id, title: "Зачёт" } });
    await tx.deadline.create({
      data: { userId: one.id, title: "Зачёт", course: "Базы данных", dueAt: new Date(Date.now() + 3 * 86400000) },
    });
    await tx.groupLesson.deleteMany({ where: { groupId: first.id } });
    await tx.groupLesson.create({
      data: {
        groupId: first.id, title: "Практикум по ИС", teacher: "Гусев А. П.", room: "105", type: "PRACTICE",
        campus: "Главный корпус, ул. Примерная, 1", teachers: [{ name: "Гусев Алексей Петрович", position: "доцент" }],
        startsAt: new Date(Date.now() + 2 * 86400000), endsAt: new Date(Date.now() + 2 * 86400000 + 5400000),
      },
    });
  });
  console.log("Созданы demo-staff, demo-student-1, demo-student-2 и демонстрационные данные.");
} finally {
  await db.$disconnect();
}
