"use server";

import { requireUser } from "@/lib/server/auth";
import { listGoals } from "@/lib/server/repo";
import { aiEnabled } from "@/lib/server/ai";
import { generateDrills, loadDrillSet, recordDrillResult } from "@/lib/server/agent/drills";
import { awardXp, XP } from "@/lib/server/xp";
import type { DrillItem } from "@/lib/types";

export interface DrillPack {
  goalId: string | null;
  goalTitle: string;
  items: DrillItem[];
  generated: boolean;
  error?: string;
}

/**
 * 홈에서 여는 기초 학습.
 * 목표에 맞춰 만들어 둔 묶음이 있으면 쓰고, 없으면 지금 만든다.
 */
export async function loadDrills(kind: "ox" | "flip" | "trace"): Promise<DrillPack> {
  const user = await requireUser();
  const goal = listGoals(user.id)[0];
  if (!goal) return { goalId: null, goalTitle: "", items: [], generated: false, error: "목표를 먼저 정해 주세요." };

  const cached = loadDrillSet(user.id, goal.id, kind);
  if (cached.length) return { goalId: goal.id, goalTitle: goal.title, items: cached, generated: false };

  if (!aiEnabled()) {
    return {
      goalId: goal.id,
      goalTitle: goal.title,
      items: [],
      generated: false,
      error: "AI 연결이 꺼져 있어 문제를 만들 수 없어요.",
    };
  }

  try {
    const packs = await generateDrills(user.id, goal.id);
    return { goalId: goal.id, goalTitle: goal.title, items: packs[kind], generated: true };
  } catch (error) {
    return {
      goalId: goal.id,
      goalTitle: goal.title,
      items: [],
      generated: false,
      error: error instanceof Error ? error.message : "문제를 만들지 못했어요.",
    };
  }
}

export async function saveDrillResult(goalId: string | null, kind: string, score: number, total: number) {
  const user = await requireUser();
  recordDrillResult(user.id, goalId, kind, score, total);
  awardXp(user.id, score * XP.drillCorrect, `기초 학습 ${kind}`);
}
