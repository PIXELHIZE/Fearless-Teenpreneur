import "server-only";
import { askForJson } from "../ai";
import { getLesson, getMaterial, listGoals, listUnits, markMaterialFailed, saveMaterial } from "../repo";
import { uid } from "../db";
import { listFeedback } from "../xp";
import { EXAM_ITEMS_SCHEMA, EXAM_RULES, normalizeExam } from "./exam-schema";
import type { ExamItem, QuizItem, Slide, SlideVisual } from "@/lib/types";

/** 수업 길이에 맞는 분량. 30분 수업에 20장을 만들지 않도록 코드가 먼저 정한다. */
export function planPortion(minutes: number) {
  return {
    slides: clamp(Math.round(minutes / 6), 4, 14),
    quiz: clamp(Math.round(minutes / 10), 3, 10),
    exam: clamp(Math.round(minutes / 18), 2, 6),
  };
}

const SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string", description: "이 수업에서 무엇을 하는지 한 문장" },
    slides: {
      type: "array",
      description: "카드뉴스처럼 넘기며 읽는 개념 설명 카드",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "카드 제목. 12자 내외." },
          body: { type: "string", description: "핵심 설명 2~3문장" },
          bullets: { type: "array", items: { type: "string" }, description: "기억할 점 2~3개" },
          example: { type: "string", description: "짧은 예시나 예문" },
          visual: {
            type: "object",
            description:
              "카드에 붙일 시각 자료 하나. 내용에 맞는 type 을 고른다. formula(핵심 식 크게), steps(순서), compare(두 개념 비교), bars(수치 비교 막대), table(표), example(예제와 풀이). 필요 없으면 생략.",
            properties: {
              type: { type: "string", enum: ["formula", "steps", "compare", "bars", "table", "example"] },
              text: { type: "string", description: "formula 의 식" },
              caption: { type: "string", description: "formula 의 짧은 설명" },
              items: { type: "array", items: { type: "string" }, description: "steps 의 단계들" },
              left_title: { type: "string" },
              left_items: { type: "array", items: { type: "string" } },
              right_title: { type: "string" },
              right_items: { type: "array", items: { type: "string" } },
              bars: {
                type: "array",
                items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" } }, required: ["label", "value"] },
              },
              unit: { type: "string", description: "bars 의 단위" },
              headers: { type: "array", items: { type: "string" } },
              rows: { type: "array", items: { type: "array", items: { type: "string" } }, description: "table 의 행들" },
              problem: { type: "string", description: "example 의 문제" },
              solution: { type: "string", description: "example 의 풀이" },
            },
            required: ["type"],
          },
        },
        required: ["title", "body"],
      },
    },
    quiz: {
      type: "array",
      description: "카드를 다 본 뒤 바로 확인하는 짧은 문제",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["ox", "choice"], description: "ox 또는 4지선다" },
          question: { type: "string" },
          choices: { type: "array", items: { type: "string" }, description: "choice 일 때만. 4개." },
          answer: { type: "string", description: "ox 는 O 또는 X, choice 는 정답 번호(1부터)" },
          explain: { type: "string", description: "왜 그런지 한 문장" },
        },
        required: ["kind", "question", "answer", "explain"],
      },
    },
    exam: EXAM_ITEMS_SCHEMA,
  },
  required: ["slides", "quiz", "exam"],
};

const SYSTEM = `당신은 한 학생을 전담하는 과외 선생님이고, 다음 수업에 쓸 자료를 미리 만듭니다.

규칙:
- 주어진 수업 시간 안에 다 소화할 수 있는 분량만 만듭니다. 요청된 개수를 지키세요.
- 슬라이드는 카드뉴스입니다. 한 카드에 한 가지만 담고, 앞 카드를 읽었다는 전제로 이어집니다.
- 학생이 지난 수업에서 틀렸던 부분이 주어지면 그 부분을 반드시 다시 다룹니다.
- 퀴즈는 카드에서 다룬 내용만 묻습니다. 카드에 없는 걸 묻지 않습니다.
- 카드에는 가능하면 시각 자료(visual)를 하나씩 붙입니다. 공식이 핵심이면 formula, 절차면 steps, 두 개념이 헷갈리면 compare, 수치 비교면 bars, 정리는 table, 예제는 example. 글로만 된 카드가 연달아 세 장 이상 나오지 않게 합니다.
- 시험지는 학생이 노트에 손으로 푸는 모의고사입니다. 채점 기준(rubric)은 채점하는 사람이 바로 쓸 수 있게 구체적으로 씁니다.
- 모든 문장은 한국어입니다. 수식은 반드시 LaTeX 로 쓰고 '$...$' 로 감싼다. 예) $\\lim_{x\\to 2}(2x^2-3x+1)$, $\\frac{x^2-9}{x-3}$, $\\sqrt{2}$, $x^2$. 글 속 숫자·단위는 그대로 쓰고, 식·기호·분수·극한·적분만 $ 로 감싼다.
- visual 의 formula.text 도 LaTeX 로 쓰되 $ 없이 식만 적는다.

${EXAM_RULES}`;

export async function generateMaterial(userId: string, lessonId: string) {
  const lesson = getLesson(userId, lessonId);
  if (!lesson) throw new Error("수업을 찾을 수 없습니다.");

  const minutes = lesson.end_min - lesson.start_min;
  const portion = planPortion(minutes);
  const goal = listGoals(userId).find((g) => g.id === lesson.goal_id);
  const unit = lesson.unit_id ? listUnits(userId).find((u) => u.id === lesson.unit_id) : undefined;
  const history = listFeedback(userId, 4);

  try {
    const result = await askForJson<{
      intro?: string;
      slides: (Omit<Slide, "id" | "visual"> & { visual?: Record<string, unknown> })[];
      quiz: Omit<QuizItem, "id">[];
      exam: unknown;
    }>({
      system: SYSTEM,
      name: "prepare_lesson",
      description: "다음 수업에 쓸 슬라이드·퀴즈·시험지를 만든다.",
      schema: SCHEMA,
      maxTokens: 12000,
      messages: [
        {
          role: "user",
          content: [
            `수업: ${lesson.title}`,
            `수업 시간: ${minutes}분`,
            goal ? `목표: ${goal.title}${goal.level ? ` (현재 수준 ${goal.level})` : ""}` : "",
            unit ? `다룰 단원: ${unit.title} — ${unit.summary} (난이도 ${unit.difficulty}, 숙련도 ${unit.mastery}%)` : "",
            "",
            history.length ? "[최근 피드백에서 드러난 약점]" : "",
            ...history.map((row) => `- ${row.title}: ${row.summary} / 약점: ${row.weaknesses.join(", ") || "없음"}`),
            "",
            `슬라이드 ${portion.slides}장, 퀴즈 ${portion.quiz}문제, 시험지 ${portion.exam}문항을 만들어 주세요.`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });

    const slides: Slide[] = (result.slides ?? []).slice(0, portion.slides + 2).map((slide) => ({
      id: uid("s_"),
      title: slide.title ?? "",
      body: slide.body ?? "",
      bullets: Array.isArray(slide.bullets) ? slide.bullets.filter(Boolean).slice(0, 4) : [],
      example: slide.example,
      visual: toVisual(slide.visual),
    }));

    const quiz: QuizItem[] = (result.quiz ?? [])
      .slice(0, portion.quiz + 2)
      .filter((item) => item?.question && item?.answer)
      .map((item) => ({
        id: uid("q_"),
        kind: item.kind === "choice" ? "choice" : "ox",
        question: item.question,
        choices: item.kind === "choice" ? (item.choices ?? []).slice(0, 5) : undefined,
        answer: String(item.answer).trim(),
        explain: item.explain ?? "",
      }));

    const exam: ExamItem[] = normalizeExam(result.exam, portion.exam + 1);

    if (!slides.length) throw new Error("슬라이드를 만들지 못했습니다.");

    saveMaterial(lessonId, { status: "ready", slides, quiz, exam, note: result.intro ?? "", error: "" });
    return getMaterial(lessonId);
  } catch (error) {
    markMaterialFailed(lessonId, error instanceof Error ? error.message : "자료 생성에 실패했습니다.");
    throw error;
  }
}

function clamp(value: unknown, min: number, max: number, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 모델이 준 평평한 visual 객체를 화면이 그릴 수 있는 형태로 바꾼다. 쓸 게 없으면 버린다. */
function toVisual(raw: Record<string, unknown> | undefined): SlideVisual | undefined {
  if (!raw || typeof raw.type !== "string") return undefined;
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim()).map(String) : []);
  switch (raw.type) {
    case "formula":
      return typeof raw.text === "string" && raw.text.trim()
        ? { type: "formula", text: raw.text, caption: typeof raw.caption === "string" ? raw.caption : undefined }
        : undefined;
    case "steps": {
      const items = strings(raw.items).slice(0, 6);
      return items.length >= 2 ? { type: "steps", items } : undefined;
    }
    case "compare": {
      const left = strings(raw.left_items).slice(0, 4);
      const right = strings(raw.right_items).slice(0, 4);
      return left.length && right.length
        ? {
            type: "compare",
            left: { title: String(raw.left_title ?? ""), items: left },
            right: { title: String(raw.right_title ?? ""), items: right },
          }
        : undefined;
    }
    case "bars": {
      const bars = Array.isArray(raw.bars)
        ? raw.bars
            .filter((b) => b && typeof b.label === "string" && Number.isFinite(Number(b.value)))
            .map((b) => ({ label: String(b.label), value: Number(b.value) }))
            .slice(0, 6)
        : [];
      return bars.length >= 2 ? { type: "bars", items: bars, unit: typeof raw.unit === "string" ? raw.unit : undefined } : undefined;
    }
    case "table": {
      const headers = strings(raw.headers).slice(0, 4);
      const rows = Array.isArray(raw.rows) ? raw.rows.map((r) => strings(r).slice(0, 4)).filter((r) => r.length).slice(0, 6) : [];
      return headers.length && rows.length ? { type: "table", headers, rows } : undefined;
    }
    case "example":
      return typeof raw.problem === "string" && typeof raw.solution === "string"
        ? { type: "example", problem: raw.problem, solution: raw.solution }
        : undefined;
    default:
      return undefined;
  }
}
