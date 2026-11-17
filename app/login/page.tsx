import { Login } from "@/components/login";
export default function LoginPage() {
  return <Login enabled={process.env.DEMO_2FA_ENABLED === "true"} />;
}
export const dynamic = "force-dynamic";