import "server-only";
import { askForJson } from "../ai";
import { db, now, uid } from "../db";
import { listGoals, listUnits } from "../repo";
import { recentWeaknesses } from "../xp";
import { EXAM_ITEMS_SCHEMA, EXAM_RULES, normalizeExam } from "./exam-schema";
import type { ExamItem } from "@/lib/types";

export type ExamStyle = "choice" | "short" | "essay" | "mixed";

const STYLE_LABEL: Record<ExamStyle, string> = {
  choice: "5지선다만",
  short: "단답형만",
  essay: "서술형만",
  mixed: "5지선다 위주로 단답·서술을 섞어서",
};

const SYSTEM = `당신은 학생 한 명을 전담하는 과외 선생님이고, 학생이 요청한 주제로 시험지를 출제합니다.
학생의 목표·현재 커리큘럼·최근 약점을 알고 있으니 그 수준에 맞춰 냅니다.
모든 문장은 한국어입니다.

${EXAM_RULES}`;

/**
 * 맞춤 시험지. 주제·문항 수·유형을 받아 노트로 만든다.
 */
export async function createCustomExam(
  userId: string,
  input: { topic: string; count: number; style: ExamStyle },
): Promise<{ noteId: string; items: ExamItem[] }> {
  const count = Math.min(20, Math.max(3, Math.round(input.count)));
  const goals = listGoals(userId);
  const units = listUnits(userId).slice(0, 12);
  const weaknesses = recentWeaknesses(userId);

  const result = await askForJson<{ title: string; exam: unknown }>({
    system: SYSTEM,
    name: "make_exam",
    description: "요청한 주제로 모의고사형 시험지를 만든다.",
    maxTokens: 10000,
    schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "시험지 제목. 예) 이차함수 모의고사 10문항" },
        exam: EXAM_ITEMS_SCHEMA,
      },
      required: ["title", "exam"],
    },
    messages: [
      {
        role: "user",
        content: [
          `주제: ${input.topic}`,
          `문항 수: ${count}개`,
          `유형: ${STYLE_LABEL[input.style]}`,
          "",
          goals.length ? `[학생의 목표] ${goals.map((g) => g.title).join(" / ")}` : "",
          units.length ? `[커리큘럼] ${units.map((u) => `${u.title}(${u.mastery}%)`).join(", ")}` : "",
          weaknesses.length ? `[최근 약점] ${weaknesses.join(", ")}` : "",
          "",
          `정확히 ${count}문항을 만들어 주세요.`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const items = normalizeExam(result.exam, count);
  if (!items.length) throw new Error("시험지를 만들지 못했습니다.");

  const noteId = uid("n_");
  db.prepare(
    `INSERT INTO notes (id, user_id, lesson_id, title, kind, paper, exam_json, pins_json, topic, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'custom', 'plain', ?, '[]', ?, ?, ?)`,
  ).run(noteId, userId, result.title || `${input.topic} 시험지`, JSON.stringify(items), input.topic, now(), now());

  return { noteId, items };
}
