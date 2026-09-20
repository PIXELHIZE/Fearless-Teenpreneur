import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, ChevronRight, Flame, Layers, PencilLine, Play, Sparkles, Zap } from "lucide-react";
import { currentUser } from "@/lib/server/auth";
import { homeData } from "@/lib/server/views";
import { InstantTutorCard } from "@/components/app/instant-tutor";
import { ActivityChart } from "@/components/app/activity-chart";
import { absoluteMinutes, durationLabel, minToKorean, nowMinutes, relativeDateLabel, todayStr } from "@/lib/time";

export const dynamic = "force-dynamic";

const QUICK = [
  { href: "/study/ox", label: "OX 퀴즈", desc: "3분", icon: BookOpenCheck, tone: "brand" },
  { href: "/study/flip", label: "카드 뒤집기", desc: "3분", icon: Layers, tone: "grape" },
  { href: "/study/trace", label: "따라쓰기", desc: "5분", icon: PencilLine, tone: "flame" },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 6) return "늦은 밤이에요";
  if (hour < 12) return "좋은 아침이에요";
  if (hour < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

function untilLabel(date: string, startMin: number) {
  const diff = absoluteMinutes(date, startMin) - absoluteMinutes(todayStr(), nowMinutes());
  if (diff <= 0) return "지금";
  if (diff < 60) return `${diff}분 뒤`;
  if (diff < 60 * 24) return `${Math.round(diff / 60)}시간 뒤`;
  return `${Math.round(diff / (60 * 24))}일 뒤`;
}

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const data = homeData(user.id, user.name);
  const next = data.next;

  return (
    <main className="app-main">
      <header className="greeting row-between rise" style={{ paddingTop: 18, alignItems: "flex-start" }}>
        <div>
          <h1>
            {greeting()},
            <br />
            {data.name}님
          </h1>
          <p>{data.streak > 0 ? `${data.streak}일 연속으로 공부하고 있어요` : "오늘 첫 수업을 시작해 볼까요"}</p>
        </div>
        <div className="row" style={{ gap: 6, flex: "none" }}>
          <span className="level-chip tnum" title={`${data.xp} XP · 다음 레벨까지 ${data.level.per - data.level.into} XP`}>
            <Zap size={13} aria-hidden />
            LV {data.level.level}
          </span>
          <span className="streak-chip tnum">
            <Flame size={15} aria-hidden />
            {data.streak}
          </span>
        </div>
      </header>

      <section className="rise rise-1">
        {next ? (
          <Link
            href={next.isLive || next.status === "completed" ? `/lesson/${next.id}` : "/lessons"}
            className="hero"
            data-live={next.isLive ? "true" : undefined}
          >
            <div className="hero-eyebrow">
              <span>
                <span className="dot" aria-hidden />
                {next.isLive ? "지금 수업 중" : "다음 수업"}
              </span>
              <span>{next.isLive ? `${next.minutes}분` : untilLabel(next.date, next.start_min)}</span>
            </div>
            <div>
              <div className="hero-time">
                {minToKorean(next.start_min)}
                <small>{relativeDateLabel(next.date)}</small>
              </div>
              <p className="hero-title" style={{ marginTop: 10 }}>
                {next.title}
              </p>
            </div>
            <div className="hero-meta">
              <span>{durationLabel(next.minutes)}</span>
              {next.goalTitle ? <span>{next.goalTitle}</span> : null}
              <span>{next.materialReady ? "자료 준비됨" : "자료 준비 중"}</span>
            </div>
            <span className="hero-cta" data-quiet={next.isLive ? undefined : "true"}>
              {next.isLive ? (
                <>
                  <Play size={18} aria-hidden /> 수업 시작하기
                </>
              ) : (
                <>
                  전체 일정 보기 <ArrowRight size={16} aria-hidden />
                </>
              )}
            </span>
          </Link>
        ) : (
          <div className="hero-empty">
            <strong>예정된 수업이 없어요</strong>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>
              공부할 수 있는 시간을 알려 주면 에이전트가 수업을 넣어 둘게요.
            </p>
            <Link href="/calendar" className="lesson-go" style={{ marginTop: 0 }}>
              공부 시간 설정하기 <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        )}
      </section>

      <section className="rise rise-2">
        <InstantTutorCard hasGoal={data.goals.length > 0} />
      </section>

      <section className="rise rise-2">
        <div className="section-title">
          <h2>이번 주</h2>
          <Link href="/calendar">
            스케줄 <ChevronRight size={14} aria-hidden />
          </Link>
        </div>
        <ActivityChart days={data.activity} goal={data.dailyGoal} todayMinutes={data.todayMinutes} />
      </section>

      <section className="rise rise-2">
        <div className="section-title">
          <h2>가볍게 한 판</h2>
        </div>
        <div className="quick-grid">
          {QUICK.map((item) => {
            const Icon = item.icon;
            const stat = data.drills.find((row) => row.kind === item.href.split("/").pop());
            return (
              <Link key={item.href} href={item.href} className="quick-card" data-tone={item.tone}>
                <span className="icon" aria-hidden>
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{stat && stat.total > 0 ? `정답률 ${Math.round((stat.score / stat.total) * 100)}%` : item.desc}</small>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {data.lastFeedback ? (
        <section className="rise rise-3">
          <div className="section-title">
            <h2>지난 수업 피드백</h2>
            <Link href="/me/history">
              기록 <ChevronRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="card-muted stack" style={{ gap: 10 }}>
            <div className="row-between">
              <span className="row" style={{ gap: 6, fontSize: 12.5, fontWeight: 800, color: "var(--grape-ink)" }}>
                <Sparkles size={14} aria-hidden /> {data.lastFeedback.title}
              </span>
              <span className="pill tnum" data-tone="ok">정답률 {data.lastFeedback.accuracy}%</span>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.75 }}>{data.lastFeedback.feedback}</p>
          </div>
        </section>
      ) : null}

      <section className="rise rise-3">
        <div className="section-title">
          <h2>목표</h2>
          <Link href="/me">
            관리 <ChevronRight size={14} aria-hidden />
          </Link>
        </div>
        {data.goals.length ? (
          <div className="card-list">
            {data.goals.map(({ goal, total, done, mastery }) => (
              <div key={goal.id} className="goal-row">
                <div className="row-between">
                  <strong>{goal.title}</strong>
                  <span className="muted tnum" style={{ fontSize: 12.5, flex: "none" }}>
                    {done}/{total} 단원
                  </span>
                </div>
                <div className="bar" data-tone="ok">
                  <span style={{ width: `${mastery}%` }} />
                </div>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  평균 숙련도 {mastery}%{goal.target_date ? ` · 목표일 ${goal.target_date}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>
            아직 목표가 없어요.
          </p>
        )}
      </section>

    </main>
  );
}
