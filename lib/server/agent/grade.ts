import "server-only";
import { askForJson } from "../ai";
import { getMaterial, saveAnswer } from "../repo";
import type { ExamItem } from "@/lib/types";

const SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_id: { type: "string" },
          score: { type: "integer", description: "0 ~ 배점" },
          correct: { type: "boolean", description: "배점을 거의 다 받았으면 true" },
          comment: { type: "string", description: "무엇이 맞고 무엇이 빠졌는지 한두 문장" },
        },
        required: ["question_id", "score", "correct", "comment"],
      },
    },
    overall: { type: "string", description: "시험지 전체에 대한 짧은 총평" },
  },
  required: ["results"],
};

const SYSTEM = `당신은 학생의 시험지를 채점하는 선생님입니다.
각 문항의 채점 기준(rubric)에 따라 점수를 주고, 왜 그 점수인지 짧게 설명합니다.

규칙:
- 표현이 달라도 뜻이 맞으면 맞은 것으로 봅니다. 글자 그대로 같은지 따지지 않습니다.
- 부분 점수를 적극적으로 줍니다. 들어간 요소만큼 점수를 줍니다.
- 빈 답이면 0점이고, 무엇을 썼어야 하는지 한 문장으로 알려 줍니다.
- 설명은 학생에게 말하듯 한국어로 짧게 씁니다.`;

export async function gradeExam(
  userId: string,
  lessonId: string,
  submissions: { question_id: string; answer: string }[],
) {
  const material = getMaterial(lessonId);
  const exam = material.exam;
  if (!exam.length) return { results: [], overall: "" };

  const result = await askForJson<{
    results: { question_id: string; score: number; correct: boolean; comment: string }[];
    overall?: string;
  }>({
    system: SYSTEM,
    name: "grade_exam",
    description: "시험지를 채점한다.",
    schema: SCHEMA,
    maxTokens: 6000,
    messages: [
      {
        role: "user",
        content: exam
          .map((item) => {
            const given = submissions.find((s) => s.question_id === item.id)?.answer ?? "";
            return [
              `[${item.id}] ${item.number}번 (${item.points}점)`,
              `문제: ${item.question}`,
              item.choices?.length ? `보기: ${item.choices.map((c, i) => `${i + 1}. ${c}`).join(" / ")}` : "",
              `모범 답안: ${item.answer}`,
              `채점 기준: ${item.rubric}`,
              `학생 답: ${given || "(빈칸)"}`,
            ]
              .filter(Boolean)
              .join("\n");
          })
          .join("\n\n"),
      },
    ],
  });

  for (const item of exam) {
    const row = result.results?.find((r) => r.question_id === item.id);
    const given = submissions.find((s) => s.question_id === item.id)?.answer ?? "";
    saveAnswer(userId, lessonId, {
      kind: "exam",
      question_id: item.id,
      given,
      correct: item.answer,
      is_correct: Boolean(row?.correct),
      score: clampScore(row?.score, item),
      comment: row?.comment ?? "",
    });
  }

  return { results: result.results ?? [], overall: result.overall ?? "" };
}

/** AI 를 못 쓸 때는 정답 문자열 비교로라도 채점한다. */
export function gradeExamOffline(userId: string, lessonId: string, submissions: { question_id: string; answer: string }[]) {
  const material = getMaterial(lessonId);
  for (const item of material.exam) {
    const given = (submissions.find((s) => s.question_id === item.id)?.answer ?? "").trim();
    const isCorrect = given.length > 0 && normalize(given) === normalize(item.answer);
    saveAnswer(userId, lessonId, {
      kind: "exam",
      question_id: item.id,
      given,
      correct: item.answer,
      is_correct: isCorrect,
      score: isCorrect ? item.points : 0,
      comment: isCorrect ? "정답과 일치합니다." : "모범 답안과 비교해 보세요.",
    });
  }
}

function normalize(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function clampScore(score: unknown, item: ExamItem) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.min(item.points, Math.max(0, Math.round(n)));
}
