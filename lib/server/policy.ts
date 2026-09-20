import "server-only";
import { addDaysStr, nowMinutes, todayStr } from "@/lib/time";
import { upcomingLessons } from "./repo";

/**
 * 무엇을 언제부터 바꿀 수 있는지에 대한 규칙.
 *
 * - 오늘 수업은 어떤 경로로도 바꾸거나 지울 수 없다.
 * - AI Agent 가 바꾸는 스케줄·커리큘럼은 "다가오는 수업" 을 건드리지 않는다.
 *   가장 가까운 수업은 그대로 두고, 그 다음 수업부터 반영한다.
 * - 수업이 끝난 뒤의 자동 분석은 다음 날 수업부터 반영한다.
 */

export interface EditWindow {
  /** 이 날짜(포함)부터 수정할 수 있다 */
  fromDate: string;
  /** 같은 날이라면 이 분 이후부터 수정할 수 있다 */
  fromMinute: number;
  /** 보호되는 수업 id (다가오는 수업) */
  protectedLessonId: string | null;
  reason: string;
}

/** 에이전트가 스케줄·커리큘럼을 바꿀 수 있는 시점 */
export function agentEditWindow(userId: string): EditWindow {
  const today = todayStr();
  const next = upcomingLessons(userId, 1)[0];

  // 오늘은 언제나 보호된다.
  let fromDate = addDaysStr(today, 1);
  let fromMinute = 0;
  let protectedLessonId: string | null = null;
  let reason = "오늘 수업은 바꿀 수 없어요.";

  if (next) {
    protectedLessonId = next.id;
    if (next.date > fromDate || (next.date === fromDate && next.end_min > fromMinute)) {
      fromDate = next.date;
      fromMinute = next.end_min;
    }
    reason = "다가오는 수업은 그대로 두고, 그 다음 수업부터 바꿨어요.";
  }

  return { fromDate, fromMinute, protectedLessonId, reason };
}

/** 분석 결과로 커리큘럼을 조정할 때는 다음 날부터 반영한다. */
export function analysisEffectiveFrom(): string {
  return addDaysStr(todayStr(), 1);
}

export function isLessonLocked(lesson: { id: string; date: string; start_min: number }, window: EditWindow): boolean {
  if (lesson.id === window.protectedLessonId) return true;
  if (lesson.date < window.fromDate) return true;
  if (lesson.date === window.fromDate && lesson.start_min < window.fromMinute) return true;
  return false;
}

/** 오늘 수업인지 (사용자도 지울 수 없다) */
export function isToday(dateStr: string): boolean {
  return dateStr === todayStr();
}

/** 이미 지나간 시각인지 */
export function isPast(dateStr: string, endMin: number): boolean {
  const today = todayStr();
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  return endMin <= nowMinutes();
}
