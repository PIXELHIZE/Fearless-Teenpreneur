import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { currentUser } from "@/lib/server/auth";
import { lessonHistory } from "@/lib/server/views";
import { listFeedback } from "@/lib/server/xp";
import { PageHead } from "@/components/app/page-head";
import { Button } from "@/components/ui/button";
import { HistoryList } from "@/components/app/history-list";

export const dynamic = "force-dynamic";

/** 피드백·수업 기록 전체 */
export default async function HistoryPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <main className="app-main">
      <PageHead
        title="학습 기록"
        subtitle="받은 피드백과 지난 수업을 모두 모았어요"
        side={
          <Button asChild variant="ghost" shape="pill" size="icon" aria-label="내 정보로">
            <Link href="/me">
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
        }
      />
      <HistoryList feedback={listFeedback(user.id, 60)} lessons={lessonHistory(user.id, 60)} />
    </main>
  );
}
