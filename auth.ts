import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { encode as encodeJwt } from "next-auth/jwt";
import { db } from "@/lib/db";

/** Длительность сессии без «Запомнить меня» — 8 часов (как было раньше). */
export const SESSION_SHORT_MAX_AGE = 8 * 60 * 60;
/** Длительность сессии с «Запомнить меня» — 30 дней. */
export const SESSION_REMEMBER_MAX_AGE = 30 * 24 * 60 * 60;

declare module "next-auth" {
  interface Session {
    accountId?: string;
    role?: "STUDENT" | "STAFF";
    remember?: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  // Базовое значение — 30 дней: лишь так Auth.js перевыставляет долгую cookie
  // при обновлении сессии. Короткий (8-часовой) срок без «Запомнить меня»
  // задаётся в jwt.encode и в finishLogin (см. app/actions.ts).
  session: { strategy: "jwt", maxAge: SESSION_REMEMBER_MAX_AGE },
  jwt: {
    async encode(params) {
      // encode() всегда перезаписывает exp, поэтому длительность JWT-сессии
      // вычисляем из флага remember, перенесённого в токен jwt-callback'ом.
      const remember = (params.token as { remember?: boolean } | undefined)?.remember === true;
      return encodeJwt({ ...params, maxAge: remember ? SESSION_REMEMBER_MAX_AGE : SESSION_SHORT_MAX_AGE });
    },
  },
  trustHost: true,
  providers: [Credentials({
    credentials: { challenge: {}, code: {}, remember: {} },
    async authorize(raw) {
      const challenge = raw?.challenge;
      const code = raw?.code;
      if (process.env.DEMO_2FA_ENABLED !== "true" ||
          typeof challenge !== "string" || !/^[a-f0-9]{64}$/.test(challenge) ||
          typeof code !== "string" || !/^\d{6}$/.test(code)) return null;

      const now = new Date();
      const available = { id: challenge, expiresAt: { gt: now }, attempts: { lt: 5 } };
      const claim = await db.loginChallenge.updateMany({ where: available, data: { attempts: { increment: 1 } } });
      if (!claim.count) return null;
      const pending = await db.loginChallenge.findUnique({ where: { id: challenge } });
      if (!pending || !(await compare(code, pending.codeHash))) return null;

      const user = await db.user.findUnique({ where: { id: pending.userId } });
      if (!user || user.passwordHash !== pending.passwordHash) return null;
      const consumed = await db.loginChallenge.deleteMany({ where: { id: challenge, expiresAt: { gt: new Date() } } });
      if (!consumed.count) return null;
      const remember = raw?.remember === "1" || raw?.remember === "true";
      return { id: user.id, name: user.name, role: user.role, remember };
    },
  })],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const extra = user as typeof user & { role?: "STUDENT" | "STAFF"; remember?: boolean };
        token.role = extra.role;
        token.remember = extra.remember === true;
      }
      return token;
    },
    session({ session, token }) {
      session.accountId = token.sub;
      if (token.role === "STUDENT" || token.role === "STAFF") session.role = token.role;
      session.remember = token.remember === true;
      return session;
    },
  },
});
