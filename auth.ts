import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    accountId?: string;
    role?: "STUDENT" | "STAFF";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [Credentials({
    credentials: { challenge: {}, code: {} },
    async authorize({ challenge, code }) {
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
      return consumed.count ? { id: user.id, name: user.name, role: user.role } : null;
    },
  })],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as typeof user & { role: "STUDENT" | "STAFF" }).role;
      return token;
    },
    session({ session, token }) {
      session.accountId = token.sub;
      if (token.role === "STUDENT" || token.role === "STAFF") session.role = token.role;
      return session;
    },
  },
});