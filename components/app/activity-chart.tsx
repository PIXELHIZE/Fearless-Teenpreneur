import { WEEKDAYS_KO } from "@/lib/time";
import type { ActivityDay } from "@/lib/server/xp";

/**
 * 최근 7일 공부 시간 막대 + 오늘 목표 링.
 * 목표선을 넘긴 날은 초록으로 찬다.
 */
export function ActivityChart({ days, goal, todayMinutes }: { days: ActivityDay[]; goal: number; todayMinutes?: number }) {
  const max = Math.max(goal, ...days.map((d) => d.minutes), 1);
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  const hit = days.filter((d) => d.minutes >= goal).length;
  const today = todayMinutes ?? days.find((d) => d.isToday)?.minutes ?? 0;
  const percent = Math.min(100, Math.round((today / goal) * 100));
  const ring = 2 * Math.PI * 24;

  return (
    <div className="activity">
      <div className="activity-head">
        <div className="activity-ring" data-done={percent >= 100 ? "true" : undefined}>
          <svg viewBox="0 0 60 60" aria-hidden>
            <circle cx="30" cy="30" r="24" fill="none" stroke="var(--muted)" strokeWidth="7" />
            <circle cx="30" cy="30" r="24" fill="none" stroke="var(--ok)" strokeWidth="7" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - percent / 100)} />
          </svg>
          <strong className="tnum">{percent}%</strong>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.02em" }}>
            오늘 {today}분 <span className="muted" style={{ fontWeight: 600 }}>/ 목표 {goal}분</span>
          </strong>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            이번 주 {total >= 60 ? `${Math.round((total / 60) * 10) / 10}시간` : `${total}분`} · 목표 달성 {hit}일
          </p>
        </div>
      </div>
      <div className="activity-bars" style={{ ["--goal" as string]: `${(goal / max) * 100}%` }}>
        {days.map((day) => (
          <div key={day.date} className="activity-col" data-today={day.isToday ? "true" : undefined}>
            <div className="activity-track">
              <span
                className="activity-fill"
                data-hit={day.minutes >= goal ? "true" : undefined}
                style={{ height: `${Math.max(day.minutes ? 8 : 0, (day.minutes / max) * 100)}%` }}
              />
            </div>
            <small>{day.isToday ? "오늘" : WEEKDAYS_KO[day.weekday]}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
