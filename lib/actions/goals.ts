"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import { archiveGoal, createGoal, listGoals, listUnits } from "@/lib/server/repo";
import { db } from "@/lib/server/db";
import { nowMinutes, todayStr } from "@/lib/time";
import { aiEnabled } from "@/lib/server/ai";
import { buildCurriculum, fallbackCurriculum } from "@/lib/server/agent/curriculum";
import { fallbackPlan, planLessons } from "@/lib/server/agent/schedule";
import { agentEditWindow } from "@/lib/server/policy";
import type { Unit } from "@/lib/types";

export async function addGoalAction(input: {
  title: string;
  subject: string;
  level: string;
  targetDate: string;
  detail: string;
}): Promise<{ ok: boolean; error?: string; note?: string }> {
  const user = await requireUser();
  if (!input.title.trim()) return { ok: false, error: "목표를 적어 주세요." };

  const goal = createGoal(user.id, {
    title: input.title.trim(),
    subject: input.subject.trim(),
    detail: input.detail.trim(),
    level: input.level.trim(),
    target_date: input.targetDate || null,
  });

  try {
    if (aiEnabled()) await buildCurriculum(user.id, goal, { name: user.name, age: null });
    else fallbackCurriculum(user.id, goal);
  } catch {
    fallbackCurriculum(user.id, goal);
  }

  const window = agentEditWindow(user.id);
  try {
    if (aiEnabled()) await planLessons(user.id, { fromDate: window.fromDate });
    else fallbackPlan(user.id, window.fromDate);
  } catch {
    fallbackPlan(user.id, window.fromDate);
  }

  revalidatePath("/me");
  revalidatePath("/home");
  revalidatePath("/lessons");
  return { ok: true, note: window.reason };
}

/** 목표를 지우면 아직 하지 않은 관련 수업·단원·문항도 함께 정리한다. 지난 수업 기록은 남긴다. */
export async function archiveGoalAction(goalId: string): Promise<{ removedLessons: number }> {
  const user = await requireUser();
  const today = todayStr();
  const minutes = nowMinutes();
  const removed = db.transaction(() => {
    archiveGoal(user.id, goalId);
    const result = db
      .prepare(
        `DELETE FROM lessons WHERE user_id = ? AND goal_id = ?
         AND (date > ? OR (date = ? AND end_min > ?))`,
      )
      .run(user.id, goalId, today, today, minutes);
    db.prepare(`DELETE FROM units WHERE user_id = ? AND goal_id = ?`).run(user.id, goalId);
    db.prepare(`DELETE FROM drill_sets WHERE user_id = ? AND goal_id = ?`).run(user.id, goalId);
    return result.changes;
  })();
  revalidatePath("/me");
  revalidatePath("/home");
  revalidatePath("/lessons");
  return { removedLessons: removed };
}

export async function loadCurriculum(goalId: string): Promise<Unit[]> {
  const user = await requireUser();
  return listUnits(user.id, goalId);
}

export async function loadGoals() {
  const user = await requireUser();
  return listGoals(user.id);
}
