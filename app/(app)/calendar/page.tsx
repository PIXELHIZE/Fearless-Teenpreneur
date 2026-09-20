import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { CalendarScreen } from "@/components/app/calendar-screen";
import { todayStr } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <CalendarScreen today={todayStr()} />;
}
