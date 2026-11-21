import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { passwordError } from "../lib/password.mjs";

/**
 * Смена пароля учётной записи из терминала (нужна для сотрудников: у них нет
 * страницы профиля со сменой пароля, как у студентов).
 *
 * Использование:
 *   npm run db:password -- office
 *   docker compose ... exec -it app npm run db:password -- office
 *
 * Пароль вводится скрыто и сохраняется только bcrypt-хешем. Все незавершённые
 * попытки входа (loginChallenge) для аккаунта удаляются.
 */
const login = (process.argv[2] ?? "").trim().toLowerCase();
if (!login || login.length > 80) {
  console.error("Использование: npm run db:password -- <login>");
  process.exit(1);
}
if (!process.stdin.isTTY) throw new Error("Для безопасного ввода пароля нужен интерактивный терминал.");

const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
const prompt = createInterface({ input: process.stdin, output: muted, terminal: true });
process.stdout.write("Новый пароль для " + login + " (ввод скрыт): ");
const password = await prompt.question("");
process.stdout.write("\nПовторите пароль: ");
const repeat = await prompt.question("");
process.stdout.write("\n");
prompt.close();

const issue = passwordError(password);
if (issue) throw new Error(issue);
if (password !== repeat) throw new Error("Пароли не совпадают.");

const db = new PrismaClient();
try {
  const user = await db.user.findUnique({ where: { login }, select: { id: true, name: true, role: true } });
  if (!user) throw new Error("Аккаунт " + login + " не найден.");
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hash(password, 12) } }),
    db.loginChallenge.deleteMany({ where: { userId: user.id } }),
  ]);
  console.log("Пароль изменён: " + login + " (" + user.name + ", " + user.role + ").");
} finally {
  await db.$disconnect();
}
