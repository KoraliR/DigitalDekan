import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Login } from "@/components/login";

const passLink = /^\/staff\/campus\/pass\?token=[a-f0-9]{48}$/;

export default async function StaffLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const session = await auth();
  // Сотрудник уже вошёл — сразу в кабинет, форму не показываем.
  if (session?.accountId && session.role === "STAFF") {
    redirect(typeof next === "string" && passLink.test(next) ? next : "/account");
  }
  return <Login enabled={process.env.DEMO_2FA_ENABLED === "true"} staff next={next} />;
}
export const dynamic = "force-dynamic";
