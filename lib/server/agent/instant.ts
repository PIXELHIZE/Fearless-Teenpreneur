import "server-only";
import { askForJson, aiEnabled } from "../ai";
import { createLesson, listGoals, listUnits } from "../repo";
import { generateMaterial } from "./material";
import { recentWeaknesses } from "../xp";
import { nowMinutes, todayStr } from "@/lib/time";
import type { Lesson } from "@/lib/types";

/**
 * 즉시 과외. "지금부터 n분" 을 받아 바로 수업을 만들고 자료까지 준비한다.
 * 끝나면 예약 수업과 똑같이 분석되고 커리큘럼이 조정된다.
 */
export async function startInstantLesson(
  userId: string,
  input: { minutes: number; topic?: string },
): Promise<Lesson> {
  const minutes = Math.min(120, Math.max(15, Math.round(input.minutes)));
  const goals = listGoals(userId);
  if (!goals.length) throw new Error("목표를 먼저 정해 주세요.");

  const units = listUnits(userId);
  const weaknesses = recentWeaknesses(userId);
  const topic = input.topic?.trim();

  // 무엇을 다룰지 고른다. 주제를 적었으면 그걸 우선하고, 아니면 약점·다음 단원에서 고른다.
  let goalId = goals[0].id;
  let unitId: string | null = null;
  let title = topic ? `${topic} 집중 과외` : "즉시 과외";

  if (aiEnabled()) {
    try {
      const pick = await askForJson<{ goal_id: string; unit_title?: string; title: string }>({
        system: `학생이 지금 바로 ${minutes}분 동안 과외를 받고 싶어 합니다. 무엇을 다룰지 정하세요.
- 학생이 주제를 적었으면 그 주제를 다루고, 관련 있는 단원을 고릅니다.
- 주제가 없으면 최근 약점이나 숙련도가 낮은 다음 단원에서 고릅니다.
- ${minutes}분 안에 끝낼 수 있는 크기로 제목을 정합니다. 한국어로.`,
        name: "pick_topic",
        description: "즉시 과외에서 다룰 목표·단원·제목을 정한다.",
        schema: {
          type: "object",
          properties: {
            goal_id: { type: "string" },
            unit_title: { type: "string", description: "커리큘럼 단원 이름. 없으면 생략." },
            title: { type: "string", description: "수업 제목" },
          },
          required: ["goal_id", "title"],
        },
        messages: [
          {
            role: "user",
            content: [
              topic ? `학생이 적은 주제: ${topic}` : "주제 없음",
              "",
              "[목표]",
              ...goals.map((g) => `- ${g.id} · ${g.title}`),
              "[단원]",
              ...units.map((u) => `- [${u.goal_id}] ${u.title} · 숙련도 ${u.mastery}% · ${u.status}`),
              weaknesses.length ? `[최근 약점] ${weaknesses.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        maxTokens: 600,
      });
      if (goals.some((g) => g.id === pick.goal_id)) goalId = pick.goal_id;
      unitId = units.find((u) => u.goal_id === goalId && u.title === pick.unit_title)?.id ?? null;
      if (pick.title) title = pick.title;
    } catch {
      /* 아래 기본값으로 진행 */
    }
  }

  if (!unitId) {
    const next = units.find((u) => u.goal_id === goalId && u.status !== "done");
    unitId = next?.id ?? null;
    if (!topic && next) title = next.title;
  }

  const start = nowMinutes();
  const lesson = createLesson(userId, {
    goal_id: goalId,
    unit_id: unitId,
    series_id: null,
    title,
    date: todayStr(),
    start_min: start,
    end_min: Math.min(24 * 60 - 1, start + minutes),
    status: "in_progress",
    origin: "instant",
  });

  if (aiEnabled()) await generateMaterial(userId, lesson.id);
  return lesson;
}
