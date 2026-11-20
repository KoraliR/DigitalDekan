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
      Buffer.byteLength(password) > 72 || !password.length) return { error: "Проверьте логин и пароль." };
  const agent = (await headers()).get("x-forwarded-for") ?? "local";
  const key = login.trim().toLowerCase() + "|" + agent;
  if (rateLimited(key)) return { error: "Слишком много попыток входа. Попробуйте позже." };
  try {
    const user = await db.user.findUnique({ where: { login: login.trim().toLowerCase() } });
    const dummy = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxcdI6XG2nRf3TRMQ9RnsUq2mEu";
    const valid = await compare(password, user?.passwordHash ?? dummy);
    if (!user || !valid || user.role !== (form.get("entry") === "staff" ? "STAFF" : "STUDENT")) return { error: "Проверьте логин и пароль." };
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
      secure: process.env.AUTH_URL?.startsWith("https://") ?? false,
    });
    return { code };
  } catch {
    return { error: "Хранилище недоступно. Повторите попытку позже." };
  }
}

export async function finishLogin(form: FormData) {
  const jar = await cookies();
  try {
    const url = await signIn("credentials", {
      challenge: jar.get("dekanat-challenge")?.value ?? "",
      code: form.get("code"),
      redirectTo: "/account", redirect: false,
    });
    if (typeof url !== "string" || url.includes("error=")) return { error: "Код неверен или истёк." };
    jar.delete("dekanat-challenge");
    return { url: "/account" };
  } catch (error) {
    if (error instanceof AuthError) return { error: "Код неверен или истёк. Проверьте код либо начните заново." };
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
