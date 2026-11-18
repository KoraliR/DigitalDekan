import { Login } from "@/components/login";
export default function StaffLogin() {
  return <Login enabled={process.env.DEMO_2FA_ENABLED === "true"} staff />;
}
export const dynamic = "force-dynamic";