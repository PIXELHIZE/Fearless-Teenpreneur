"use server";

import { revalidatePath } from "next/cache";
import { db, now } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { addAvailability, createGoal, listGoals } from "@/lib/server/repo";
import { aiEnabled } from "@/lib/server/ai";
import { buildCurriculum, fallbackCurriculum } from "@/lib/server/agent/curriculum";
import { fallbackPlan, planLessons } from "@/lib/server/agent/schedule";
import { agentEditWindow } from "@/lib/server/policy";
import { todayStr } from "@/lib/time";

export interface OnboardingPayload {
  name: string;
  gender: string;
  birthYear: number | null;
  slots: { weekday: number; start: number; end: number }[];
  goal: { title: string; subject: string; level: string; targetDate: string; detail: string };
}

export interface OnboardingResult {
  ok: boolean;
  error?: string;
  unitCount?: number;
  lessonCount?: number;
  summary?: string;
}

/**
 * 온보딩 마지막 단계.
 * 기본 정보 저장 → 공부 가능 시간 저장 → 목표 저장 → 커리큘럼 설계 → 첫 스케줄 배치까지
 * 한 번에 끝낸다. 이 시점부터 백그라운드 준비 작업이 돌기 시작한다.
 */
export async function completeOnboarding(payload: OnboardingPayload): Promise<OnboardingResult> {
  const user = await requireUser();

  if (!payload.goal.title.trim()) return { ok: false, error: "목표를 적어 주세요." };
  if (!payload.slots.length) return { ok: false, error: "공부할 수 있는 시간을 하나 이상 골라 주세요." };

  db.prepare(`UPDATE users SET name = ?, gender = ?, birth_year = ?, onboarded_at = ? WHERE id = ?`).run(
    payload.name.trim() || "학생",
    payload.gender,
    payload.birthYear,
    now(),
    user.id,
  );

  for (const slot of payload.slots) {
    if (slot.end - slot.start < 30) continue;
    addAvailability(user.id, {
      kind: "weekly",
      weekday: slot.weekday,
      date: null,
      start_min: slot.start,
      end_min: slot.end,
    });
  }

  const existing = listGoals(user.id);
  const goal =
    existing.find((g) => g.title === payload.goal.title.trim()) ??
    createGoal(user.id, {
      title: payload.goal.title.trim(),
      subject: payload.goal.subject.trim(),
      detail: payload.goal.detail.trim(),
      level: payload.goal.level.trim(),
      target_date: payload.goal.targetDate || null,
    });

  let unitCount = 0;
  let summary = "";
  try {
    if (aiEnabled()) {
      const result = await buildCurriculum(user.id, goal, {
        name: payload.name,
        age: payload.birthYear ? new Date().getFullYear() - payload.birthYear + 1 : null,
      });
      unitCount = result.units.length;
      summary = result.summary;
    } else {
      unitCount = fallbackCurriculum(user.id, goal).length;
      summary = "기본 커리큘럼으로 시작했어요. 공부하면서 나에게 맞게 바뀝니다.";
    }
  } catch (error) {
    console.error("[onboarding] 커리큘럼 실패", error);
    unitCount = fallbackCurriculum(user.id, goal).length;
    summary = "우선 기본 계획으로 시작할게요. 곧 다시 다듬을게요.";
  }

  // 온보딩 직후에는 오늘부터 바로 시작할 수 있게 한다.
  let lessonCount = 0;
  try {
    const from = todayStr();
    const created = aiEnabled()
      ? await planLessons(user.id, { fromDate: from, days: 14 })
      : fallbackPlan(user.id, from, 14);
    lessonCount = created.length;
  } catch (error) {
    console.error("[onboarding] 스케줄 실패", error);
    lessonCount = fallbackPlan(user.id, agentEditWindow(user.id).fromDate, 14).length;
  }

  revalidatePath("/home");
  return { ok: true, unitCount, lessonCount, summary };
}
