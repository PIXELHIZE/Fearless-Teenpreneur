import "server-only";
import { db } from "./db";
import {
  acquireLock,
  getMaterial,
  getProgress,
  lessonsNeedingAnalysis,
  listGoals,
  releaseLock,
  saveAnalysis,
  setLessonStatus,
  upcomingLessons,
} from "./repo";
import { aiEnabled } from "./ai";
import { analyzeLesson } from "./agent/analysis";
import { generateMaterial } from "./agent/material";
import { fallbackPlan, planLessons } from "./agent/schedule";
import { agentEditWindow } from "./policy";
import { nowMinutes, todayStr } from "@/lib/time";

/** 앞으로 몇 개 수업까지 자료를 미리 만들어 둘지 */
const PREPARE_AHEAD = 2;
/** 다가오는 수업이 이보다 적으면 일정을 더 짠다 */
const MIN_UPCOMING = 4;

/**
 * 한 사용자에 대해 "지금 해야 할 일"을 순서대로 처리한다.
 *
 * 1. 끝난 수업 상태 정리
 * 2. 끝난 수업 분석 → 커리큘럼 조정 (다음 날 수업부터 반영)
 * 3. 앞으로의 일정이 비어 있으면 다시 배치
 * 4. 다가오는 수업의 자료를 미리 생성 (수업 직전이 아니라 이 시점에)
 *
 * 순서가 중요하다. 분석과 커리큘럼 조정이 끝난 뒤에 자료를 만들어야
 * 다음 수업 자료가 방금 드러난 약점을 반영한다.
 */
export async function runDueWork(userId: string) {
  const key = `due:${userId}`;
  if (!acquireLock(key)) return { skipped: true };
  const report = { analyzed: 0, planned: 0, prepared: 0 };

  try {
    syncLessonStatuses(userId);

    for (const lesson of lessonsNeedingAnalysis(userId)) {
      try {
        if (aiEnabled()) await analyzeLesson(userId, lesson.id);
        else offlineAnalysis(userId, lesson.id);
        report.analyzed += 1;
      } catch (error) {
        console.error("[pipeline] 분석 실패", lesson.id, error);
        offlineAnalysis(userId, lesson.id);
      }
    }

    if (listGoals(userId).length && upcomingLessons(userId, MIN_UPCOMING).length < MIN_UPCOMING) {
      const window = agentEditWindow(userId);
      try {
        const created = aiEnabled()
          ? await planLessons(userId, { fromDate: window.fromDate, days: 14 })
          : fallbackPlan(userId, window.fromDate, 14);
        report.planned = created.length;
      } catch (error) {
        console.error("[pipeline] 일정 배치 실패", error);
      }
    }

    for (const lesson of upcomingLessons(userId, PREPARE_AHEAD)) {
      const material = getMaterial(lesson.id);
      if (material.status === "ready") continue;
      if (material.status === "failed" && material.error) continue;
      if (!aiEnabled()) continue;
      try {
        await generateMaterial(userId, lesson.id);
        report.prepared += 1;
      } catch (error) {
        console.error("[pipeline] 자료 생성 실패", lesson.id, error);
      }
    }
  } finally {
    releaseLock(key);
  }

  return report;
}

/** 수업을 열려고 할 때 자료가 아직 없으면 그 자리에서 만든다. */
export async function ensureMaterial(userId: string, lessonId: string) {
  const current = getMaterial(lessonId);
  if (current.status === "ready") return current;
  if (!aiEnabled()) return current;

  const key = `material:${lessonId}`;
  if (!acquireLock(key)) return current;
  try {
    return await generateMaterial(userId, lessonId);
  } catch {
    return getMaterial(lessonId);
  } finally {
    releaseLock(key);
  }
}

/** 시간이 지난 수업의 상태를 실제 상황에 맞춘다. */
function syncLessonStatuses(userId: string) {
  const today = todayStr();
  const minutes = nowMinutes();
  const lessons = db
    .prepare(`SELECT * FROM lessons WHERE user_id = ? AND status IN ('scheduled','in_progress')`)
    .all(userId) as { id: string; date: string; start_min: number; end_min: number }[];

  for (const lesson of lessons) {
    const ended = lesson.date < today || (lesson.date === today && lesson.end_min <= minutes);
    const started = lesson.date < today || (lesson.date === today && lesson.start_min <= minutes);
    if (ended) {
      const progress = getProgress(lesson.id);
      setLessonStatus(lesson.id, progress.entered_at ? "completed" : "missed");
    } else if (started) {
      setLessonStatus(lesson.id, "in_progress");
    }
  }
}

/** AI 를 못 쓸 때도 기록은 남긴다. */
function offlineAnalysis(userId: string, lessonId: string) {
  const progress = getProgress(lessonId);
  const attended = Boolean(progress.entered_at);
  saveAnalysis(userId, lessonId, {
    summary: attended ? "수업에 참여했어요." : "이 수업에는 참여하지 않았어요.",
    strengths: [],
    weaknesses: attended ? [] : ["예정한 학습을 하지 못했습니다."],
    feedback: attended
      ? "기록은 남겨 뒀어요. 자세한 분석은 잠시 뒤 다시 확인해 주세요."
      : "이번 수업은 넘어갔어요. 못 한 만큼은 다음 일정에 나눠 담을게요.",
    accuracy: 0,
    focus_seconds: progress.active_seconds,
  });
  setLessonStatus(lessonId, attended ? "completed" : "missed");
}
