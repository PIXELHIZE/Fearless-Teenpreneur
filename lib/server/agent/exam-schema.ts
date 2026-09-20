import "server-only";
import { uid } from "../db";
import type { ExamItem } from "@/lib/types";

/** 모의고사형 시험지 문항 스키마. 수업 자료와 맞춤 시험지가 같이 쓴다. */
export const EXAM_ITEMS_SCHEMA = {
  type: "array",
  description: "모의고사 형식의 시험지 문항. 학생이 노트에 손으로 푼다.",
  items: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["choice", "short", "essay"], description: "choice 는 5지선다" },
      passage: { type: "string", description: "문제 앞에 붙는 지문·조건·보기 자료. 없으면 생략." },
      question: { type: "string", description: "발문. 모의고사처럼 정확하고 간결하게." },
      choices: { type: "array", items: { type: "string" }, description: "choice 일 때 정확히 5개. 번호 없이 내용만." },
      answer: { type: "string", description: "choice 는 정답 번호(1~5), 나머지는 모범 답안" },
      rubric: { type: "string", description: "채점 기준. 부분 점수를 어떻게 주는지." },
      points: { type: "integer", description: "배점. 5지선다는 보통 3~4점." },
    },
    required: ["kind", "question", "answer", "rubric", "points"],
  },
};

export const EXAM_RULES = `시험지 규칙 (모의고사 형식):
- 5지선다(choice)가 기본이고, 보기는 정확히 5개. 오답 보기는 흔한 실수를 반영해 그럴듯하게 만든다.
- 쉬운 문항 → 어려운 문항 순서로 배치한다.
- 계산·서술이 필요한 내용은 short(단답) 또는 essay(서술)로 낸다.
- 발문은 모의고사 문체로 쓴다. 예) "다음 중 옳은 것은?", "…의 값은?"
- 부정 발문("옳지 않은 것은?")은 발문에 밑줄 대신 '않은'을 분명히 쓴다.
- 지문·조건이 필요하면 passage 에 넣고, question 에는 발문만 쓴다.
- 수식은 반드시 LaTeX 로 쓰고 '$...$' 로 감싼다. 예) $\\lim_{x\\to 2}(2x^2-3x+1)$, $\\frac{x^2-9}{x-3}$, $\\sqrt{2}$, $x^2$. 글 속 숫자·단위는 그대로 쓰고, 식·기호·분수·극한·적분만 $ 로 감싼다.`;

export function normalizeExam(raw: unknown, max: number): ExamItem[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .slice(0, max)
    .filter((item) => item && typeof item.question === "string" && item.question.trim())
    .map((item, index) => {
      const kind: ExamItem["kind"] = item.kind === "essay" ? "essay" : item.kind === "short" ? "short" : "choice";
      let choices: string[] | undefined = Array.isArray(item.choices) ? item.choices.filter(Boolean).map(String) : undefined;
      if (kind === "choice") {
        choices = (choices ?? []).slice(0, 5);
        while (choices.length < 5) choices.push("해당 없음");
      } else {
        choices = undefined;
      }
      return {
        id: uid("e_"),
        number: index + 1,
        kind,
        passage: typeof item.passage === "string" && item.passage.trim() ? item.passage : undefined,
        question: String(item.question),
        choices,
        answer: String(item.answer ?? ""),
        rubric: String(item.rubric ?? ""),
        points: clamp(item.points, 1, 30, kind === "choice" ? 4 : 10),
      };
    });
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
