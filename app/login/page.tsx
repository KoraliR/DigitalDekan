import { Login } from "@/components/login";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <Login next={(await searchParams).next} enabled={process.env.DEMO_2FA_ENABLED === "true"} />;
}
export const dynamic = "force-dynamic";