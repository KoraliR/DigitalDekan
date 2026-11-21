/**
 * Экспорт демонстрационных аккаунтов из базы в docs/ACCOUNTS.md и docs/accounts.csv.
 *
 * Читает пользователей из PostgreSQL (Prisma), собирает человекочитаемый
 * справочник для жюри/QA и CSV для Excel (UTF-8 с BOM, разделитель «;», LF).
 *
 * Запуск:  npm run db:accounts
 *          node --env-file-if-exists=.env scripts/export-accounts.mjs
 * Пароль:  DEMO_ACCOUNT_PASSWORD (по умолчанию «dekanat-2026»);
 *          в базе лежит только bcrypt-хеш, поэтому в выгрузку попадает
 *          значение переменной окружения, а не данные из БД.
 */

import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const password = process.env.DEMO_ACCOUNT_PASSWORD ?? "dekanat-2026";
const db = new PrismaClient();

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = dirname(scriptDir);
const docsDir = join(projectDir, "docs");
const markdownPath = join(docsDir, "ACCOUNTS.md");
const csvPath = join(docsDir, "accounts.csv");

/** Числовая сортировка логинов: student < student2 < … < student10 < student11. */
function loginSortKey(login) {
  const match = /^([a-zа-яё]+)(\d*)$/i.exec(login);
  if (!match) return { prefix: login, number: 1 };
  return { prefix: match[1].toLowerCase(), number: match[2] ? Number(match[2]) : 1 };
}
function compareLogins(left, right) {
  if (left.login === right.login) return 0;
  const a = loginSortKey(left.login);
  const b = loginSortKey(right.login);
  const byPrefix = a.prefix.localeCompare(b.prefix, "ru");
  if (byPrefix !== 0) return byPrefix;
  if (a.number !== b.number) return a.number - b.number;
  return left.login.localeCompare(right.login, "ru");
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[;"\n\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
function cell(value) {
  const text = value === null || value === undefined || value === "" ? "—" : String(value);
  return text.replaceAll("|", "\\|");
}
function fileLink(path) {
  return relative(projectDir, path).replaceAll("\\", "/");
}
/** Ссылка для Markdown из docs/: файлы лежат в том же каталоге. */
function docLink(path) {
  return path.split(/[\\/]/).pop();
}

const MONITOR_YES = "да";
const MONITOR_NO = "нет";

function studentRow(user) {
  const profile = user.studentProfile;
  const group = profile?.group ?? null;
  return {
    login: user.login,
    password,
    role: "STUDENT",
    name: user.name,
    group: group?.name ?? profile?.groupName ?? "",
    faculty: group?.faculty ?? profile?.faculty ?? "",
    course: group?.course ?? profile?.course ?? "",
    studentId: profile?.studentId ?? "",
    email: profile?.contactEmail ?? "",
    phone: profile?.phone ?? "",
    monitor: profile?.isMonitor ? MONITOR_YES : MONITOR_NO,
    staffGroups: "",
  };
}

function staffRow(user) {
  const profile = user.staffProfile;
  const groups = profile?.groups ?? [];
  return {
    login: user.login,
    password,
    role: "STAFF",
    name: user.name,
    group: "",
    faculty: "",
    course: "",
    studentId: "",
    email: "",
    phone: "",
    monitor: "",
    staffGroups: groups.map((group) => group.name).join(", "),
  };
}

try {
  const [users, groupCount] = await Promise.all([
    db.user.findMany({
      orderBy: { login: "asc" },
      include: {
        studentProfile: { include: { group: true } },
        staffProfile: { include: { groups: { orderBy: { name: "asc" } } } },
      },
    }),
    db.studyGroup.count(),
  ]);

  const staff = users.filter((user) => user.role === "STAFF").map(staffRow).sort(compareLogins);
  const students = users.filter((user) => user.role === "STUDENT").map(studentRow).sort(compareLogins);
  const accountRows = [...staff, ...students];

  /* ---------- CSV для Excel: BOM, разделитель «;», LF ---------- */
  const csvHeader = ["login", "password", "role", "name", "group", "faculty", "course", "student_id", "email", "phone", "monitor", "staff_groups"];
  const csvLines = [csvHeader.join(";")];
  for (const row of accountRows) {
    csvLines.push([
      row.login, row.password, row.role, row.name, row.group, row.faculty,
      row.course, row.studentId, row.email, row.phone, row.monitor, row.staffGroups,
    ].map(csvCell).join(";"));
  }
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(csvPath, "\uFEFF" + csvLines.join("\n") + "\n", "utf8");

  /* ---------- Markdown-справочник ---------- */
  const studentAccounts = students.filter((row) => row.group);
  const facultyOrder = [
    "Факультет программной инженерии",
    "Факультет информационной безопасности",
    "Факультет прикладной математики и информатики",
  ];
  const groupNames = [...new Set(students.map((row) => row.group).filter(Boolean))].sort((left, right) => {
    const leftFaculty = students.find((row) => row.group === left)?.faculty ?? "";
    const rightFaculty = students.find((row) => row.group === right)?.faculty ?? "";
    return (facultyOrder.indexOf(leftFaculty) - facultyOrder.indexOf(rightFaculty)) || left.localeCompare(right, "ru");
  });
  const faculties = [...new Set(students.map((row) => row.faculty).filter(Boolean))].sort((left, right) => {
    const leftIndex = facultyOrder.indexOf(left);
    const rightIndex = facultyOrder.indexOf(right);
    if (leftIndex !== rightIndex) return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
    return left.localeCompare(right, "ru");
  });

  const lines = [];
  lines.push("# Аккаунты демонстрационной базы «Цифровой деканат»");
  lines.push("");
  lines.push("Справочник собран скриптом `scripts/export-accounts.mjs` из текущего состояния базы.");
  lines.push("Он предназначен для проверки демо-стенда: для реальной эксплуатации нужны собственные пароли");
  lines.push("и раздельные роли с ограниченными правами.");
  lines.push("");
  lines.push("## Как войти");
  lines.push("");
  lines.push("- **Студенты:** `/login` — логины `student`, `student2`, `student3`, …");
  lines.push("- **Сотрудники:** `/staff-login` — логины `office`, `office2`, `office3`, …");
  lines.push("- **Единый демо-пароль:** `" + password + "` (задаётся переменной окружения `DEMO_ACCOUNT_PASSWORD`, по умолчанию `dekanat-2026`).");
  lines.push("- **Двухшаговый вход.** Сначала введите логин и пароль. После успешной проверки пароля");
  lines.push("  приложение показывает на экране шестизначный код подтверждения и создаёт короткоживущую");
  lines.push("  сессию входа. Введите код на втором шаге; код действует **5 минут**, после истечения");
  lines.push("  вход нужно начать заново. Это демонстрационный режим (`DEMO_2FA_ENABLED=true`),");
  lines.push("  а не настоящее SMS/почтовое подтверждение.");
  lines.push("");
  lines.push("> **Важно про пароль.** В базе данных пароль хранится **только в виде bcrypt-хеша** —");
  lines.push("> исходное значение прочитать из БД нельзя, поэтому в этой таблице указан общий");
  lines.push("> демонстрационный пароль. Студент может сменить пароль сам в разделе «Профиль»;");
  lines.push("> у сотрудников страницы профиля нет — пароль меняется из терминала:");
  lines.push("> `npm run db:password -- <login>` (на сервере — `docker compose ... exec -it app npm run db:password -- office`).");
  lines.push("> Для реальной эксплуатации обязательно задайте свои пароли для каждого аккаунта,");
  lines.push("> включите настоящий второй фактор и не публикуйте файлы с паролями в открытом доступе.");
  lines.push("");
  lines.push("## Состав базы");
  lines.push("");
  lines.push("| Показатель | Значение |");
  lines.push("| --- | --- |");
  lines.push("| Всего аккаунтов | " + accountRows.length + " |");
  lines.push("| Студентов | " + students.length + " |");
  lines.push("| Сотрудников | " + staff.length + " |");
  lines.push("| Групп | " + groupCount + " |");
  lines.push("| Факультетов | " + faculties.length + " |");
  lines.push("| Студентов с группой | " + studentAccounts.length + " |");
  lines.push("");
  lines.push("Машиночитаемая версия для Excel: [`" + docLink(csvPath) + "`](" + docLink(csvPath) + ")");
  lines.push("(UTF-8 с BOM, разделитель `;`, переносы строк LF, колонки: login, password, role, name, group, faculty, course, student_id, email, phone, monitor, staff_groups).");
  lines.push("Готовая книга Excel с листами «Аккаунты», «Сотрудники», «Группы» и «Инструкция» — [`accounts.xlsx`](accounts.xlsx).");
  lines.push("");
  lines.push("## Сотрудники");
  lines.push("");
  lines.push("| Логин | ФИО | Закреплённые группы |");
  lines.push("| --- | --- | --- |");
  for (const row of staff) {
    lines.push("| `" + row.login + "` | " + cell(row.name) + " | " + (row.staffGroups ? cell(row.staffGroups) : "—") + " |");
  }
  lines.push("");
  lines.push("## Студенты");
  lines.push("");
  lines.push("Отсортированы по номеру логина: `student`, `student2`, … `student10`, `student11`, … — так же, как в CSV.");
  lines.push("");
  lines.push("| Логин | ФИО | Группа | Курс | Студенческий билет | Староста |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of students) {
    lines.push("| `" + row.login + "` | " + cell(row.name) + " | " + cell(row.group) + " | " + cell(row.course) + " | " + cell(row.studentId) + " | " + (row.monitor === MONITOR_YES ? "★ " + MONITOR_YES : "—") + " |");
  }
  lines.push("");
  lines.push("## Сводка по факультетам и группам");
  lines.push("");
  lines.push("| Факультет | Группа | Курс | Студентов | Староста |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const faculty of faculties) {
    const facultyStudents = students.filter((row) => row.faculty === faculty);
    const facultyGroups = groupNames.filter((name) => facultyStudents.some((row) => row.group === name));
    for (const groupName of facultyGroups) {
      const rows = facultyStudents.filter((row) => row.group === groupName);
      const monitor = rows.find((row) => row.monitor === MONITOR_YES);
      const course = rows.find((row) => row.course !== "")?.course ?? "—";
      lines.push("| " + cell(faculty) + " | " + cell(groupName) + " | " + cell(course) + " | " + rows.length + " | " + (monitor ? "`" + monitor.login + "` · " + cell(monitor.name) : "—") + " |");
    }
    lines.push("| **" + cell(faculty) + "** | **Итого** | — | **" + facultyStudents.length + "** | — |");
  }
  lines.push("");
  lines.push("## Подсказки для проверки");
  lines.push("");
  lines.push("- `student` — староста группы ИВТ-21-1: у него доступен журнал посещаемости (`/attendance`),");
  lines.push("  а в личном кабинете есть заявки, дедлайны, низкие баллы и запись на пересдачу.");
  lines.push("- `office` — Мария Орлова, закреплена за всеми группами; `office7` — Ольга Никитина,");
  lines.push("  закреплена только за группой ИБ-20-1 (удобно проверять ограничение видимости).");
  lines.push("- Все студенты имеют электронный пропуск, выданные книги и объявления на доске кампуса.");
  lines.push("- Часть заявок в статусах «Новая»/«В работе» имеет истёкший срок готовности —");
  lines.push("  такие заявки показываются сотруднику как просроченные.");
  lines.push("");
  writeFileSync(markdownPath, lines.join("\n"), "utf8");

  console.log([
    "Готово: " + fileLink(markdownPath) + ", " + fileLink(csvPath),
    "Аккаунтов: " + accountRows.length + " (студентов " + students.length + ", сотрудников " + staff.length + ")",
    "Групп: " + groupCount,
    "Демо-пароль: " + password,
    "CSV: " + accountRows.length + " строк + заголовок, UTF-8 BOM, разделитель «;»",
  ].join("\n"));
} finally {
  await db.$disconnect();
}
