import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Login } from "@/components/login";

const checkLink = /^\/attendance\/check\?token=[a-f0-9]{48}$/;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const session = await auth();
  // Студент уже вошёл — не показываем форму повторно (сотруднику оставляем
  // возможность переключиться на студенческий вход через эту страницу).
  if (session?.accountId && session.role !== "STAFF") {
    redirect(typeof next === "string" && checkLink.test(next) ? next : "/account");
  }
  return <Login next={next} enabled={process.env.DEMO_2FA_ENABLED === "true"} />;
}
export const dynamic = "force-dynamic";
