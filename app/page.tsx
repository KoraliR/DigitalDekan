import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  // Если сессия уже есть, сразу уводим в кабинет: иначе после закрытия вкладки
  // или перезапуска браузера пользователь снова попадает на форму входа,
  // хотя «Запомнить меня» уже сработало.
  if (session?.accountId) redirect("/account");
  redirect(process.env.DEMO_2FA_ENABLED === "true" ? "/login" : "/demo/today");
}
export const dynamic = "force-dynamic";
