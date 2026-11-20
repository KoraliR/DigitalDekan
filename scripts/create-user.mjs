import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { passwordError } from "../lib/password.mjs";

const raw = process.argv.slice(2);
const groupName = raw.find((value) => value.startsWith("--group="))?.slice("--group=".length);
const [role, login, ...name] = raw.filter((value) => !value.startsWith("--group="));
if (!["STUDENT", "STAFF"].includes(role) || !login || login.length > 80 || !name.length) {
  console.error("npm run db:user -- STUDENT student Имя Фамилия [--group=ИВТ-21-1]");
  process.exit(1);
}
if (!process.stdin.isTTY) throw new Error("Для безопасного ввода пароля нужен интерактивный терминал.");
const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
const prompt = createInterface({ input: process.stdin, output: muted, terminal: true });
process.stdout.write("Пароль (ввод скрыт): ");
const password = await prompt.question("");
prompt.close();
process.stdout.write("\n");
const issue = passwordError(password);
if (issue) throw new Error(issue);
const db = new PrismaClient();
try {
  const user = await db.user.create({ data: {
    login: login.trim().toLowerCase(), name: name.join(" "), role, passwordHash: await hash(password, 12),
    ...(role === "STUDENT" ? { studentProfile: { create: {} } } : { staffProfile: { create: {} } }),
  } });
  if (groupName) {
    const group = await db.studyGroup.upsert({
      where: { name: groupName },
      update: {},
      create: { name: groupName, faculty: "Не указан", course: 1 },
    });
    if (role === "STUDENT") {
      await db.studentProfile.update({ where: { userId: user.id }, data: { groupId: group.id, groupName: group.name } });
    } else {
      await db.staffProfile.update({ where: { userId: user.id }, data: { groups: { connect: { id: group.id } } } });
    }
  }
  console.log("Учётная запись создана." + (groupName ? " Группа: " + groupName : ""));
} finally {
  await db.$disconnect();
}
