import { Login } from "@/components/login";
export default async function StaffLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <Login enabled={process.env.DEMO_2FA_ENABLED === "true"} staff next={(await searchParams).next} />;
}
export const dynamic = "force-dynamic";
