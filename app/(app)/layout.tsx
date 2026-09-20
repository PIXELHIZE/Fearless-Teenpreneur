import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { runDueWork } from "@/lib/server/pipeline";
import { TabBar } from "@/components/app/tab-bar";
import { AgentChat } from "@/components/app/agent-chat";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.onboarded_at) redirect("/onboarding");

  // 서버가 잠들어 있던 동안 밀린 분석·자료 준비를 여기서도 따라잡는다.
  void runDueWork(user.id).catch(() => undefined);

  return (
    <div className="app-shell">
      {children}
      <AgentChat />
      <TabBar />
    </div>
  );
}
