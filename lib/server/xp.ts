import "server-only";
import { db, now, uid } from "./db";
import { addDaysStr, fromDateStr, todayStr } from "@/lib/time";
import type { FeedbackEntry } from "@/lib/types";

/** 하루 목표 공부 시간(분). 홈의 링이 이 값을 향해 찬다. */
export const DAILY_GOAL_MINUTES = 20;

export const XP = {
  quizCorrect: 10,
  drillCorrect: 5,
  lessonComplete: 50,
  examPoint: 2,
  instantComplete: 30,
} as const;

export function awardXp(userId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  db.prepare(`INSERT INTO xp_events (id, user_id, amount, reason, day, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uid("xp_"),
    userId,
    Math.round(amount),
    reason,
    todayStr(),
    now(),
  );
}

export function totalXp(userId: string): number {
  const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS s FROM xp_events WHERE user_id = ?`).get(userId) as { s: number };
  return row.s;
}

/** 레벨은 200XP 마다 하나. 다음 레벨까지 얼마나 남았는지도 함께 돌려준다. */
export function levelInfo(xp: number) {
  const per = 200;
  const level = Math.floor(xp / per) + 1;
  const into = xp % per;
  return { level, into, per, percent: Math.round((into / per) * 100) };
}

/** 오늘 실제로 공부한 분 (수업 참여 시간 기준) */
export function todayMinutes(userId: string): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(p.active_seconds), 0) AS s
       FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id
       WHERE p.user_id = ? AND l.date = ?`,
    )
    .get(userId, todayStr()) as { s: number };
  return Math.round(row.s / 60);
}

export interface ActivityDay {
  date: string;
  weekday: number;
  minutes: number;
  xp: number;
  isToday: boolean;
}

/** 최근 7일(오늘 포함) 활동. 주간 그래프에 쓴다. */
export function weeklyActivity(userId: string): ActivityDay[] {
  const today = todayStr();
  const from = addDaysStr(today, -6);
  const minutes = db
    .prepare(
      `SELECT l.date AS date, COALESCE(SUM(p.active_seconds), 0) AS s
       FROM lesson_progress p JOIN lessons l ON l.id = p.lesson_id
       WHERE p.user_id = ? AND l.date BETWEEN ? AND ? GROUP BY l.date`,
    )
    .all(userId, from, today) as { date: string; s: number }[];
  const xp = db
    .prepare(`SELECT day, COALESCE(SUM(amount), 0) AS a FROM xp_events WHERE user_id = ? AND day BETWEEN ? AND ? GROUP BY day`)
    .all(userId, from, today) as { day: string; a: number }[];

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDaysStr(from, index);
    return {
      date,
      weekday: fromDateStr(date).getDay(),
      minutes: Math.round((minutes.find((row) => row.date === date)?.s ?? 0) / 60),
      xp: xp.find((row) => row.day === date)?.a ?? 0,
      isToday: date === today,
    };
  });
}

// ── 피드백 로그 ───────────────────────────────────────────────────────

export function logFeedback(
  userId: string,
  entry: Omit<FeedbackEntry, "id" | "created_at">,
) {
  db.prepare(
    `INSERT INTO feedback_log (id, user_id, kind, ref_id, title, summary, strengths, weaknesses, feedback, accuracy, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    uid("fb_"),
    userId,
    entry.kind,
    entry.ref_id,
    entry.title,
    entry.summary,
    JSON.stringify(entry.strengths),
    JSON.stringify(entry.weaknesses),
    entry.feedback,
    entry.accuracy,
    now(),
  );
}

export function listFeedback(userId: string, limit = 20): FeedbackEntry[] {
  const rows = db
    .prepare(`SELECT * FROM feedback_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(userId, limit) as (Omit<FeedbackEntry, "strengths" | "weaknesses"> & { strengths: string; weaknesses: string })[];
  return rows.map((row) => ({ ...row, strengths: parse(row.strengths), weaknesses: parse(row.weaknesses) }));
}

/** 자료를 만들 때 참고할 최근 약점 목록 */
export function recentWeaknesses(userId: string, limit = 5): string[] {
  const rows = listFeedback(userId, limit);
  return [...new Set(rows.flatMap((row) => row.weaknesses))].slice(0, 8);
}

function parse(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
