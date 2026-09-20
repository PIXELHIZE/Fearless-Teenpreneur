import "server-only";
import { askForJson } from "../ai";
import { replaceUnits, recordRevision } from "../repo";
import type { Goal } from "@/lib/types";

interface UnitDraft {
  title: string;
  summary: string;
  difficulty: number;
  weight: number;
}

const UNIT_SCHEMA = {
  type: "object",
  properties: {
    plan_summary: { type: "string", description: "이 커리큘럼이 목표까지 어떻게 데려다 주는지 2~3문장" },
    units: {
      type: "array",
      description: "앞에서부터 순서대로 공부할 단원. 8~14개.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "단원 이름. 짧고 구체적으로." },
          summary: { type: "string", description: "이 단원에서 배우는 것 한 문장" },
          difficulty: { type: "integer", description: "체감 난이도 1(쉬움)~5(어려움)" },
          weight: { type: "integer", description: "목표 달성에 얼마나 중요한지 1~5" },
        },
        required: ["title", "summary", "difficulty", "weight"],
      },
    },
  },
  required: ["units"],
};

const SYSTEM = `당신은 한 학생을 전담하는 과외 선생님입니다.
학생의 목표와 현재 수준을 보고, 목표에 도달하기까지의 학습 단원을 순서대로 설계합니다.

규칙:
- 지금 수준에서 바로 시작할 수 있는 단원부터 배치하고, 뒤로 갈수록 목표에 가까워지게 합니다.
- 단원 하나는 30~90분 수업 한 번에 다룰 수 있는 크기로 쪼갭니다.
- 기초가 부족하다고 판단되면 앞쪽에 복습 단원을 넣습니다.
- 모든 문장은 한국어로, 학생이 읽고 이해할 수 있게 씁니다.`;

export async function buildCurriculum(
  userId: string,
  goal: Goal,
  profile: { name: string; age: number | null; note?: string },
) {
  const result = await askForJson<{ plan_summary?: string; units: UnitDraft[] }>({
    system: SYSTEM,
    name: "design_curriculum",
    description: "학생의 목표에 맞는 학습 단원을 순서대로 설계한다.",
    schema: UNIT_SCHEMA,
    messages: [
      {
        role: "user",
        content: [
          `학생 이름: ${profile.name || "학생"}`,
          profile.age ? `나이: ${profile.age}세` : "",
          `목표: ${goal.title}`,
          goal.subject ? `과목/영역: ${goal.subject}` : "",
          goal.level ? `현재 수준: ${goal.level}` : "",
          goal.detail ? `상세: ${goal.detail}` : "",
          goal.target_date ? `목표 시점: ${goal.target_date}` : "",
          profile.note ? `참고: ${profile.note}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const units = (result.units ?? [])
    .filter((unit) => unit?.title)
    .slice(0, 16)
    .map((unit) => ({
      title: unit.title,
      summary: unit.summary ?? "",
      difficulty: clamp(unit.difficulty, 1, 5, 3),
      weight: clamp(unit.weight, 1, 5, 3),
    }));

  if (!units.length) throw new Error("커리큘럼을 만들지 못했습니다.");

  replaceUnits(userId, goal.id, units);
  return { units, summary: result.plan_summary ?? "" };
}

/** AI 없이도 서비스가 굴러가도록 하는 최소 커리큘럼 */
export function fallbackCurriculum(userId: string, goal: Goal) {
  const units = [
    { title: `${goal.title} 진단`, summary: "현재 실력을 확인하고 출발점을 정합니다.", difficulty: 2, weight: 5 },
    { title: "기초 개념 정리", summary: "자주 쓰이는 기본 개념을 다시 훑습니다.", difficulty: 2, weight: 4 },
    { title: "유형별 연습", summary: "대표 유형을 나눠서 반복합니다.", difficulty: 3, weight: 4 },
    { title: "약점 보완", summary: "틀린 유형을 모아 다시 풉니다.", difficulty: 4, weight: 5 },
    { title: "실전 점검", summary: "시간을 재고 실전처럼 풀어 봅니다.", difficulty: 4, weight: 5 },
  ];
  replaceUnits(userId, goal.id, units);
  recordRevision(userId, {
    goalId: goal.id,
    reason: "기본 커리큘럼으로 시작했습니다.",
    changes: units.map((unit) => `추가 · ${unit.title}`),
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });
  return units;
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
