import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";

export default async function RootPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  redirect(user.onboarded_at ? "/home" : "/onboarding");
}
