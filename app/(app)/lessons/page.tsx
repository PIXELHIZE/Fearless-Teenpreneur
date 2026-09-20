import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Inbox } from "lucide-react";
import { currentUser } from "@/lib/server/auth";
import { upcomingLessons } from "@/lib/server/repo";
import { decorateLessons } from "@/lib/server/views";
import { LessonCard } from "@/components/app/lesson-card";
import { PageHead } from "@/components/app/page-head";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatKoreanDate, relativeDateLabel } from "@/lib/time";
import { ActivityChart } from "@/components/app/activity-chart";
import { DAILY_GOAL_MINUTES, weeklyActivity } from "@/lib/server/xp";

export const dynamic = "force-dynamic";

export default async function LessonsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  // 현재 시각 이후의 수업 10개 (진행 중인 수업 포함)
  const lessons = decorateLessons(user.id, upcomingLessons(user.id, 10));
  const groups = lessons.reduce<Record<string, typeof lessons>>((acc, lesson) => {
    (acc[lesson.date] ??= []).push(lesson);
    return acc;
  }, {});

  const activity = weeklyActivity(user.id);

  return (
    <main className="app-main">
      <PageHead
        title="수업"
        subtitle={lessons.length ? `다가오는 수업 ${lessons.length}개` : "예정된 수업이 없어요"}
        side={
          <Button asChild variant="outline" shape="pill" size="icon" aria-label="스케줄">
            <Link href="/calendar">
              <CalendarDays aria-hidden />
            </Link>
          </Button>
        }
      />

      {lessons.length ? (
        <>
          <div className="rise">
            <ActivityChart days={activity} goal={DAILY_GOAL_MINUTES} />
          </div>

          {Object.entries(groups).map(([date, items], index) => {
            const label = relativeDateLabel(date);
            const tone = label === "오늘" ? "today" : label === "내일" ? "tomorrow" : undefined;
            return (
              <section key={date} className={`rise rise-${Math.min(index + 1, 3)}`}>
                <p className="day-label">
                  <span className="day-pill" data-tone={tone}>
                    {label}
                  </span>
                  {tone ? <span>{formatKoreanDate(date)}</span> : null}
                </p>
                <div className="stack-sm">
                  {items.map((lesson) => (
                    <LessonCard key={lesson.id} lesson={lesson} />
                  ))}
                </div>
              </section>
            );
          })}
          <p className="muted" style={{ fontSize: 13, textAlign: "center", lineHeight: 1.8 }}>
            수업 시간이 되면 눌러서 시작할 수 있어요.
            <br />
            중간에 나가도 시간 안이면 이어서 들어갈 수 있어요.
          </p>
        </>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Inbox aria-hidden />}
            title="예정된 수업이 없어요"
            description="공부할 수 있는 시간을 알려 주면 에이전트가 수업을 넣어 둘게요."
            action={
              <Button asChild variant="ok">
                <Link href="/calendar">공부 시간 설정</Link>
              </Button>
            }
          />
        </div>
      )}
    </main>
  );
}
