import "server-only";
import { db } from "./db";
import {
  getAnalysis,
  getMaterial,
  listAvailability,
  listBusy,
  listGoals,
  listLessons,
  listUnits,
  recentAnalyses,
  upcomingLessons,
} from "./repo";
import { drillStats } from "./agent/drills";
import { DAILY_GOAL_MINUTES, levelInfo, todayMinutes, totalXp, weeklyActivity, type ActivityDay } from "./xp";
import { addDaysStr, fromDateStr, mergeRanges, nowMinutes, todayStr } from "@/lib/time";
import type { Goal, Lesson } from "@/lib/types";

export interface LessonCardData extends Lesson {
  goalTitle: string;
  unitTitle: string;
  materialReady: boolean;
  minutes: number;
  isLive: boolean;
  isToday: boolean;
}

export function decorateLessons(userId: string, lessons: Lesson[]): LessonCardData[] {
  const goals = listGoals(userId);
  const units = listUnits(userId);
  const today = todayStr();
  const minutes = nowMinutes();

  return lessons.map((lesson) => ({
    ...lesson,
    goalTitle: goals.find((goal) => goal.id === lesson.goal_id)?.title ?? "",
    unitTitle: units.find((unit) => unit.id === lesson.unit_id)?.title ?? "",
    materialReady: getMaterial(lesson.id).status === "ready",
    minutes: lesson.end_min - lesson.start_min,
    // 시간 안이어도 이미 마쳤으면 LIVE 가 아니다
    isLive: lesson.status !== "completed" && lesson.date === today && lesson.start_min <= minutes && lesson.end_min > minutes,
    isToday: lesson.date === today,
  }));
}

export interface GoalProgress {
  goal: Goal;
  total: number;
  done: number;
  mastery: number;
}

export function goalProgress(userId: string): GoalProgress[] {
  return listGoals(userId).map((goal) => {
    const units = listUnits(userId, goal.id);
    const done = units.filter((unit) => unit.status === "done").length;
    const mastery = units.length
      ? Math.round(units.reduce((sum, unit) => sum + unit.mastery, 0) / units.length)
      : 0;
    return { goal, total: units.length, done, mastery };
  });
}

/** 홈에 간단히 얹는 이번 주 스트립 */
export interface WeekDay {
  date: string;
  weekday: number;
  isToday: boolean;
  lessonCount: number;
  freeMinutes: number;
}

export function weekStrip(userId: string, days = 7): WeekDay[] {
  const today = todayStr();
  const lessons = listLessons(userId, today, addDaysStr(today, days - 1));
  const availability = listAvailability(userId);

  return Array.from({ length: days }, (_, index) => {
    const date = addDaysStr(today, index);
    const weekday = fromDateStr(date).getDay();
    const open = mergeRanges(
      availability
        .filter((slot) => (slot.kind === "weekly" ? slot.weekday === weekday : slot.date === date))
        .map((slot) => ({ start: slot.start_min, end: slot.end_min })),
    );
    return {
      date,
      weekday,
      isToday: date === today,
      lessonCount: lessons.filter((lesson) => lesson.date === date).length,
      freeMinutes: open.reduce((sum, range) => sum + (range.end - range.start), 0),
    };
  });
}

export interface HomeData {
  name: string;
  next: LessonCardData | null;
  today: LessonCardData[];
  week: WeekDay[];
  goals: GoalProgress[];
  lastFeedback: { lessonId: string; title: string; summary: string; feedback: string; accuracy: number } | null;
  drills: { kind: string; runs: number; score: number; total: number }[];
  streak: number;
  xp: number;
  level: ReturnType<typeof levelInfo>;
  todayMinutes: number;
  dailyGoal: number;
  activity: ActivityDay[];
}

export function homeData(userId: string, name: string): HomeData {
  const upcoming = decorateLessons(userId, upcomingLessons(userId, 6));
  const today = todayStr();
  const analyses = recentAnalyses(userId, 1);
  const last = analyses[0];
  const lastLesson = last ? listLessons(userId).find((lesson) => lesson.id === last.lesson_id) : undefined;

  return {
    name,
    // 홈의 "다음 수업" 은 아직 마치지 않은 것 중 가장 가까운 수업
    next: upcoming.find((lesson) => lesson.status !== "completed") ?? upcoming[0] ?? null,
    today: upcoming.filter((lesson) => lesson.date === today),
    week: weekStrip(userId),
    goals: goalProgress(userId),
    lastFeedback: last
      ? {
          lessonId: last.lesson_id,
          title: lastLesson?.title ?? "지난 수업",
          summary: last.summary,
          feedback: last.feedback,
          accuracy: last.accuracy,
        }
      : null,
    drills: drillStats(userId),
    streak: studyStreak(userId),
    xp: totalXp(userId),
    level: levelInfo(totalXp(userId)),
    todayMinutes: todayMinutes(userId),
    dailyGoal: DAILY_GOAL_MINUTES,
    activity: weeklyActivity(userId),
  };
}

/** 내 정보의 수업 기록 — 지난 수업들과 결과 */
export function lessonHistory(userId: string, limit = 30) {
  const today = todayStr();
  const minutes = nowMinutes();
  const rows = db
    .prepare(`SELECT * FROM lessons WHERE user_id = ? AND date <= ? ORDER BY date DESC, start_min DESC LIMIT ?`)
    .all(userId, today, limit + 5) as Lesson[];
  return rows
    .filter((lesson) => lesson.date < today || lesson.end_min <= minutes)
    .slice(0, limit)
    .map((lesson) => {
      const progress = db.prepare(`SELECT active_seconds FROM lesson_progress WHERE lesson_id = ?`).get(lesson.id) as { active_seconds: number } | undefined;
      const analysis = getAnalysis(lesson.id);
      return {
        id: lesson.id,
        title: lesson.title,
        date: lesson.date,
        start_min: lesson.start_min,
        end_min: lesson.end_min,
        status: lesson.status,
        origin: lesson.origin,
        minutes: Math.round((progress?.active_seconds ?? 0) / 60),
        accuracy: analysis?.accuracy ?? null,
        summary: analysis?.summary ?? "",
      };
    });
}

/** 며칠 연속으로 수업에 참여했는지 */
export function studyStreak(userId: string): number {
  const rows = db
    .prepare(
      `SELECT DISTINCT l.date AS date
       FROM lessons l JOIN lesson_progress p ON p.lesson_id = l.id
       WHERE l.user_id = ? AND p.entered_at IS NOT NULL
       ORDER BY l.date DESC`,
    )
    .all(userId) as { date: string }[];

  if (!rows.length) return 0;
  const dates = new Set(rows.map((row) => row.date));
  let streak = 0;
  let cursor = todayStr();
  // 오늘 아직 안 했으면 어제부터 센다.
  if (!dates.has(cursor)) cursor = addDaysStr(cursor, -1);
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDaysStr(cursor, -1);
  }
  return streak;
}

/** 내 정보 상단에 보여 주는 누적 기록 */
export function profileStats(userId: string) {
  const done = db.prepare(`SELECT COUNT(*) AS n FROM lessons WHERE user_id = ? AND status = 'completed'`).get(userId) as { n: number };
  const seconds = db
    .prepare(`SELECT COALESCE(SUM(active_seconds), 0) AS s FROM lesson_progress WHERE user_id = ?`)
    .get(userId) as { s: number };
  return { streak: studyStreak(userId), lessonsDone: done.n, minutes: Math.round(seconds.s / 60) };
}

export { getAnalysis, listBusy };
