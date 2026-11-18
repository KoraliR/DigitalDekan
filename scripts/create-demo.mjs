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
    const first = await tx.studyGroup.create({ data: { name: "ДЕМО-101", faculty: "Прикладные технологии", course: 1 } });
    const second = await tx.studyGroup.create({ data: { name: "ДЕМО-202", faculty: "Прикладные технологии", course: 2 } });
    const one = await tx.user.create({ data: { login: "demo-student-1", name: "Мира Искрина", passwordHash, studentProfile: { create: { groupId: first.id } } } });
    const two = await tx.user.create({ data: { login: "demo-student-2", name: "Лев Облачный", passwordHash, studentProfile: { create: { groupId: second.id } } } });
    await tx.user.create({ data: { login: "demo-staff", name: "Нина Ветрова", role: "STAFF", passwordHash, staffProfile: { create: { groups: { connect: { id: first.id } } } } } });
    await tx.serviceRequest.createMany({ data: [{ userId: one.id, type: "STUDY" }, { userId: two.id, type: "MILITARY" }] });
    await tx.grade.create({ data: { userId: one.id, title: "Базы данных", score: 47, threshold: 60, term: 1 } });
    await tx.deadline.create({ data: { userId: one.id, title: "Зачёт", course: "Базы данных", dueAt: new Date(Date.now() + 3 * 86400000) } });
  });
  console.log("Созданы demo-staff, demo-student-1 и demo-student-2.");
} finally {
  await db.$disconnect();
}