import { redirect } from "next/navigation";
import { account } from "@/lib/access";
export default async function AccountPage() {
  const user = await account();
  redirect(user.role === "STAFF" ? "/staff" : "/cabinet/today");
}