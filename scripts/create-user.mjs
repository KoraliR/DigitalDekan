import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

const [role, login, ...name] = process.argv.slice(2);
if (!["STUDENT", "STAFF"].includes(role) || !login || login.length > 80 || !name.length) {
  console.error("npm run db:user -- STUDENT student Имя Фамилия");
  process.exit(1);
}
if (!process.stdin.isTTY) throw new Error("Для безопасного ввода пароля нужен интерактивный терминал.");
const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
const prompt = createInterface({ input: process.stdin, output: muted, terminal: true });
process.stdout.write("Пароль (ввод скрыт): ");
const password = await prompt.question("");
prompt.close();
process.stdout.write("\n");
if (password.length < 10 || Buffer.byteLength(password) > 72) throw new Error("Пароль: минимум 10 символов, максимум 72 байта.");
const db = new PrismaClient();
try {
  await db.user.create({ data: {
    login: login.trim().toLowerCase(), name: name.join(" "), role, passwordHash: await hash(password, 12),
  } });
  console.log("Учётная запись создана.");
} finally {
  await db.$disconnect();
}