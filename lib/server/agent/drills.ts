import "server-only";
import { askForJson } from "../ai";
import { db, now, uid } from "../db";
import { listGoals, listUnits } from "../repo";
import type { DrillItem } from "@/lib/types";

const SCHEMA = {
  type: "object",
  properties: {
    ox: {
      type: "array",
      description: "OX 퀴즈 8문항",
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "한 문장으로 참/거짓을 가릴 수 있는 진술" },
          answer: { type: "boolean" },
          explain: { type: "string", description: "왜 그런지 한 문장" },
        },
        required: ["question", "answer", "explain"],
      },
    },
    flip: {
      type: "array",
      description: "카드 뒤집기 8장",
      items: {
        type: "object",
        properties: {
          front: { type: "string", description: "앞면. 용어나 단어." },
          back: { type: "string", description: "뒷면. 뜻이나 답." },
          hint: { type: "string", description: "짧은 힌트" },
        },
        required: ["front", "back"],
      },
    },
    trace: {
      type: "array",
      description: "따라쓰기 6개. 외워야 할 짧은 표현이나 공식.",
      items: {
        type: "object",
        properties: {
          text: { type: "string", description: "따라 쓸 글자나 짧은 식. 10자 이내." },
          guide: { type: "string", description: "무엇인지 한 줄 설명" },
        },
        required: ["text", "guide"],
      },
    },
  },
  required: ["ox", "flip", "trace"],
};

const SYSTEM = `학생의 목표와 커리큘럼에 맞는 "틈새 학습" 문항을 만듭니다.
짧은 시간에 가볍게 풀 수 있어야 하고, 지금 공부하고 있는 단원에서 나옵니다.
모든 문장은 한국어입니다. 어려운 말 대신 학생이 바로 이해할 표현을 씁니다.
수식은 반드시 LaTeX 로 쓰고 '$...$' 로 감싼다. 예) $\\lim_{x\\to 2}(2x^2-3x+1)$, $\\frac{x^2-9}{x-3}$, $\\sqrt{2}$, $x^2$. 글 속 숫자·단위는 그대로 쓰고, 식·기호·분수·극한·적분만 $ 로 감싼다. 따라쓰기(trace)의 text 만은 $ 없이 짧은 평문·기호로 쓴다.`;

/** 홈에서 자유롭게 푸는 기초 학습 문항. 목표별로 만들어 캐시한다. */
export async function generateDrills(userId: string, goalId: string) {
  const goal = listGoals(userId).find((g) => g.id === goalId);
  if (!goal) throw new Error("목표를 찾을 수 없습니다.");
  const units = listUnits(userId, goalId).filter((unit) => unit.status !== "done").slice(0, 6);

  const result = await askForJson<{
    ox: { question: string; answer: boolean; explain: string }[];
    flip: { front: string; back: string; hint?: string }[];
    trace: { text: string; guide: string }[];
  }>({
    system: SYSTEM,
    name: "make_drills",
    description: "OX·카드뒤집기·따라쓰기 문항을 만든다.",
    schema: SCHEMA,
    maxTokens: 6000,
    messages: [
      {
        role: "user",
        content: [
          `목표: ${goal.title}`,
          goal.level ? `현재 수준: ${goal.level}` : "",
          "지금 공부 중인 단원:",
          ...units.map((unit) => `- ${unit.title}: ${unit.summary}`),
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const ox: DrillItem[] = (result.ox ?? []).slice(0, 10).map((item) => ({
    id: uid("ox_"),
    kind: "ox",
    question: item.question,
    answer: Boolean(item.answer),
    explain: item.explain ?? "",
  }));
  const flip: DrillItem[] = (result.flip ?? []).slice(0, 10).map((item) => ({
    id: uid("fl_"),
    kind: "flip",
    front: item.front,
    back: item.back,
    hint: item.hint ?? "",
  }));
  const trace: DrillItem[] = (result.trace ?? []).slice(0, 8).map((item) => ({
    id: uid("tr_"),
    kind: "trace",
    text: item.text,
    guide: item.guide ?? "",
  }));

  saveDrillSet(userId, goalId, "ox", ox);
  saveDrillSet(userId, goalId, "flip", flip);
  saveDrillSet(userId, goalId, "trace", trace);

  return { ox, flip, trace };
}

export function saveDrillSet(userId: string, goalId: string, kind: string, items: DrillItem[]) {
  db.prepare(`DELETE FROM drill_sets WHERE user_id = ? AND goal_id = ? AND kind = ?`).run(userId, goalId, kind);
  db.prepare(`INSERT INTO drill_sets (id, user_id, goal_id, kind, items_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    uid("ds_"),
    userId,
    goalId,
    kind,
    JSON.stringify(items),
    now(),
  );
}

export function loadDrillSet(userId: string, goalId: string, kind: string): DrillItem[] {
  const row = db
    .prepare(`SELECT items_json FROM drill_sets WHERE user_id = ? AND goal_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1`)
    .get(userId, goalId, kind) as { items_json: string } | undefined;
  if (!row) return [];
  try {
    const list = JSON.parse(row.items_json);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordDrillResult(userId: string, goalId: string | null, kind: string, score: number, total: number) {
  db.prepare(`INSERT INTO drill_results (id, user_id, goal_id, kind, score, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uid("dr_"),
    userId,
    goalId,
    kind,
    score,
    total,
    now(),
  );
}

export function drillStats(userId: string) {
  return db
    .prepare(
      `SELECT kind, COUNT(*) AS runs, SUM(score) AS score, SUM(total) AS total
       FROM drill_results WHERE user_id = ? GROUP BY kind`,
    )
    .all(userId) as { kind: string; runs: number; score: number; total: number }[];
}
