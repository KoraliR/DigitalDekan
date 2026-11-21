"use server";
import { randomBytes, randomInt } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { Prisma, RequestStatus, RequestType } from "@prisma/client";
import { db } from "@/lib/db";
import { signIn, signOut } from "@/auth";
import { account } from "@/lib/access";

/** Cookie-маркер «Запомнить меня» живёт между шагами входа и не дольше 5 минут. */
const REMEMBER_COOKIE = "dekanat-remember";
const REMEMBER_COOKIE_MAX_AGE = 300;
const secureCookies = () => process.env.AUTH_URL?.startsWith("https://") ?? false;

/**
 * Без «Запомнить меня» cookie сессии должна быть сессионной: браузер удаляет её
 * при закрытии, поэтому «запомнить» даёт заметную разницу. JWT при этом всё равно
 * живёт 8 часов (см. auth.ts), а не 30 дней.
 */
function shortenSessionCookie(jar: Awaited<ReturnType<typeof cookies>>) {
  for (const cookie of jar.getAll()) {
    if (!cookie.name.includes("session-token")) continue;
    // Имя __Secure-… браузер принимает только с флагом Secure, даже если AUTH_URL
    // ещё не переключён на https (например, при локальном dev-сервере с TLS).
    const secure = cookie.name.startsWith("__Secure-") || secureCookies();
    jar.set(cookie.name, cookie.value, {
      httpOnly: true, sameSite: "lax", path: "/", secure,
    });
  }
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, limit = 10, windowMs = 10 * 60_000) {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

function requestNumber() {
  return "З-" + new Date().getFullYear() + "-" + String(randomInt(0, 100000)).padStart(5, "0");
}

export async function startLogin(form: FormData) {
  if (process.env.DEMO_2FA_ENABLED !== "true") return { error: "Вход в учебном режиме отключён." };
  const login = form.get("login");
  const password = form.get("password");
  if (typeof login !== "string" || login.length > 80 || typeof password !== "string" ||
      Buffer.byteLength(password) > 72 || !password.length) return { error: "Введите логин и пароль." };
  const entry = form.get("entry") === "staff" ? "staff" : "student";
  const expectedRole = entry === "staff" ? "STAFF" : "STUDENT";
  const agent = (await headers()).get("x-forwarded-for") ?? "local";
  const key = login.trim().toLowerCase() + "|" + agent;
  if (rateLimited(key)) return { error: "Слишком много неудачных попыток. Подождите 10 минут и попробуйте снова." };
  try {
    const user = await db.user.findUnique({ where: { login: login.trim().toLowerCase() } });
    const dummy = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxcdI6XG2nRf3TRMQ9RnsUq2mEu";
    const valid = await compare(password, user?.passwordHash ?? dummy);
    if (!user || !valid) {
      console.warn("[auth] вход отклонён: неверный логин или пароль (" + entry + ")");
      return { error: "Неверный логин или пароль. Проверьте раскладку и Caps Lock." };
    }
    if (user.role !== expectedRole) {
      console.warn("[auth] вход отклонён: аккаунт " + user.role + " на форме " + entry);
      return { error: user.role === "STAFF"
        ? "Это аккаунт сотрудника. Откройте вкладку «Вход сотрудника»."
        : "Это аккаунт студента. Откройте вкладку «Вход студента»." };
    }
    loginAttempts.delete(key);

    const jar = await cookies();
    const previous = jar.get("dekanat-challenge")?.value;
    const id = randomBytes(32).toString("hex");
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    await db.$transaction([
      db.loginChallenge.deleteMany({ where: { OR: [
        { expiresAt: { lte: new Date() } }, ...(previous ? [{ id: previous }] : []),
      ] } }),
      db.loginChallenge.create({ data: {
        id, userId: user.id, passwordHash: user.passwordHash, codeHash: await hash(code, 10),
        expiresAt: new Date(Date.now() + 5 * 60_000),
      } }),
    ]);
    jar.set("dekanat-challenge", id, {
      httpOnly: true, sameSite: "strict", path: "/", maxAge: 300,
      secure: secureCookies(),
    });
    // Флаг «Запомнить меня» приходит из формы первого шага. Держим его в
    // короткоживущей cookie: между шагами форма перерисовывается, а сам флаг
    // нужен только finishLogin при вызове signIn.
    jar.set(REMEMBER_COOKIE, form.get("remember") === "1" ? "1" : "0", {
      httpOnly: true, sameSite: "strict", path: "/", maxAge: REMEMBER_COOKIE_MAX_AGE,
      secure: secureCookies(),
    });
    return { code };
  } catch {
    return { error: "Хранилище недоступно. Повторите попытку позже." };
  }
}

export async function finishLogin(form: FormData) {
  const jar = await cookies();
  const remember = jar.get(REMEMBER_COOKIE)?.value === "1";
  try {
    const url = await signIn("credentials", {
      challenge: jar.get("dekanat-challenge")?.value ?? "",
      code: form.get("code"),
      remember: remember ? "1" : "0",
      redirectTo: "/account", redirect: false,
    });
    if (typeof url !== "string" || url.includes("error=")) return { error: "Код неверен или истёк. Нажмите «Назад» и начните вход заново." };
    // Cookie-операции не должны ронять уже успешный вход: сессия выставлена signIn.
    try {
      jar.delete("dekanat-challenge");
      jar.delete(REMEMBER_COOKIE);
      // session.maxAge настроен на 30 дней, чтобы долгая cookie переживала
      // обновления сессии; для обычного входа сокращаем cookie до 8 часов.
      if (!remember) shortenSessionCookie(jar);
    } catch (cookieError) {
      console.warn("[auth] не удалось обновить cookie после входа:", cookieError);
    }
    return { url: "/account" };
  } catch (error) {
    if (error instanceof AuthError) {
      console.warn("[auth] код подтверждения не принят:", error.type);
      return { error: "Код неверен или истёк. Проверьте код либо начните вход заново." };
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

export async function apply(type: RequestType) {
  const user = await account("STUDENT");
  if (!Object.values(RequestType).includes(type)) return { error: "Заявка недоступна." };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.serviceRequest.create({ data: { userId: user.id, type, number: requestNumber() } });
      revalidatePath("/cabinet/services");
      revalidatePath("/staff");
      return {};
    } catch (error) {
      const retry = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4;
      if (!retry) throw error;
    }
  }
  return { error: "Не удалось создать заявку. Попробуйте ещё раз." };
}

export async function cancelRequest(id: string) {
  const user = await account("STUDENT");
  const updated = await db.serviceRequest.updateMany({
    where: { id, userId: user.id, status: { in: [RequestStatus.NEW, RequestStatus.PROCESSING] } },
    data: { status: RequestStatus.CANCELLED, revision: { increment: 1 } },
  });
  if (!updated.count) return { error: "Отменить можно только новую заявку или заявку в работе." };
  revalidatePath("/cabinet/services");
  revalidatePath("/staff");
  return {};
}

export async function markNotificationsRead() {
  const user = await account("STUDENT");
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/cabinet/today");
  revalidatePath("/cabinet/calendar");
}
