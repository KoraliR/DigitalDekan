import { redirect } from "next/navigation";
export default function Home() {
  redirect(process.env.DEMO_2FA_ENABLED === "true" ? "/login" : "/demo/today");
}
export const dynamic = "force-dynamic";