/**
 * AI 펜 계약.
 * 한 번의 올가미에 대해 도구를 한 번 호출하고, 도움이 될 항목을 모두 채운다.
 */

export const AI_PEN_SECTIONS = ["meaning", "summary", "concept", "check", "hint", "solution"] as const;
export type AiPenSectionKey = (typeof AI_PEN_SECTIONS)[number];

/** 탭 순서. 힌트와 풀이는 항상 맨 뒤(풀이가 마지막). */
export const SECTION_ORDER: AiPenSectionKey[] = ["meaning", "summary", "concept", "check", "hint", "solution"];

export const SECTION_LABEL: Record<AiPenSectionKey, string> = {
  meaning: "의미",
  summary: "요약",
  concept: "개념정리",
  check: "오류 지적",
  hint: "힌트",
  solution: "풀이",
};

/** 답을 바로 보여주지 않고 한 번 가리는 섹션 */
export const SPOILER_SECTIONS: AiPenSectionKey[] = ["solution"];

export type CheckVerdict = "correct" | "error" | "unsure";

export interface AiPenResult {
  detected: string;
  subject?: string;
  meaning?: {
    entries: { term: string; pos?: string; definition: string; synonyms?: string[]; example?: string; role?: string }[];
  };
  summary?: { one_line: string; key_points?: string[] };
  concept?: { intent?: string; items: { name: string; detail: string }[] };
  check?: { verdict: CheckVerdict; summary?: string; issues?: { where: string; what: string; fix?: string }[] };
  hint?: { steps: string[] };
  solution?: { asked?: string; steps: { title: string; detail: string }[]; answer?: string };
}

export function filledSections(result: AiPenResult | undefined): AiPenSectionKey[] {
  if (!result) return [];
  return SECTION_ORDER.filter((key) => {
    const value = result[key];
    if (!value) return false;
    if (key === "meaning") return Boolean(result.meaning?.entries?.length);
    if (key === "summary") return Boolean(result.summary?.one_line);
    if (key === "concept") return Boolean(result.concept?.items?.length);
    if (key === "check") return Boolean(result.check?.verdict);
    if (key === "hint") return Boolean(result.hint?.steps?.length);
    if (key === "solution") return Boolean(result.solution?.steps?.length);
    return false;
  });
}

export const AI_PEN_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    detected: { type: "string", description: "강조 표시된 영역에서 실제로 읽어낸 내용" },
    subject: { type: "string", description: "판단한 과목이나 유형" },
    meaning: {
      type: "object",
      description: "단어·구절의 의미. 한글이면 뜻·품사·유의어·예문, 영어면 한글 해석, 문장 일부면 문장 속 역할.",
      properties: {
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              term: { type: "string" },
              pos: { type: "string", description: "품사" },
              definition: { type: "string", description: "한국어 뜻풀이" },
              synonyms: { type: "array", items: { type: "string" } },
              example: { type: "string", description: "짧은 예시 문장" },
              role: { type: "string", description: "지문·문장 안에서의 역할" },
            },
            required: ["term", "definition"],
          },
        },
      },
      required: ["entries"],
    },
    summary: {
      type: "object",
      description: "글이면 핵심만, 수식이면 그 수식이 말하는 핵심 개념을 요약",
      properties: {
        one_line: { type: "string" },
        key_points: { type: "array", items: { type: "string" } },
      },
      required: ["one_line"],
    },
    concept: {
      type: "object",
      description: "푸는 데 필요한 핵심 개념과 문제가 묻는 의도",
      properties: {
        intent: { type: "string", description: "이 문제가 묻고 있는 것" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, detail: { type: "string" } },
            required: ["name", "detail"],
          },
        },
      },
      required: ["items"],
    },
    check: {
      type: "object",
      description:
        "올가미 안에 학생이 직접 쓴 풀이·계산·수식·답이 있을 때만 채운다. 인쇄된 문제만 있으면 채우지 않는다.",
      properties: {
        verdict: { type: "string", enum: ["correct", "error", "unsure"] },
        summary: { type: "string", description: "한 줄 총평" },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              where: { type: "string", description: "어느 줄·어느 단계" },
              what: { type: "string", description: "무엇이 왜 잘못됐는지" },
              fix: { type: "string", description: "올바른 식이나 값" },
            },
            required: ["where", "what"],
          },
        },
      },
      required: ["verdict"],
    },
    hint: {
      type: "object",
      description: "정답을 알려주지 않는 단계적 힌트",
      properties: { steps: { type: "array", items: { type: "string" } } },
      required: ["steps"],
    },
    solution: {
      type: "object",
      description: "문제 해설 풀이. 문제가 아니면 채우지 않는다.",
      properties: {
        asked: {
          type: "string",
          description:
            "풀이를 쓰기 전에 발문이 요구하는 것을 그대로 옮겨 적는다. 부정 발문이면 '…적절하지 않은 것 고르기' 처럼 부정을 드러낸다.",
        },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, detail: { type: "string" } },
            required: ["title", "detail"],
          },
        },
        answer: { type: "string" },
      },
      required: ["steps"],
    },
  },
  required: ["detected"],
};

export const AI_PEN_SYSTEM = `당신은 학생의 필기 노트 위에서 동작하는 "AI 펜"입니다.

입력으로 노트의 현재 화면을 캡처한 이미지를 받습니다.
학생이 올가미로 지목한 영역은 **파란 형광 테두리와 반투명 음영**으로 표시되어 있고, 왼쪽 위에 "TARGET" 라벨이 붙어 있습니다.

원칙:
1. 답변 대상은 표시된 영역입니다. 표시 밖의 내용은 문맥을 이해하는 데만 씁니다.
2. 반드시 ai_pen 도구를 정확히 한 번 호출해 답하세요.
3. 하나만 고르지 말고, 도움이 되고 올가미 의도에 맞을 항목을 모두 채우세요.
   - 단어·구절 → meaning (문장 속 역할 포함)
   - 문단·지문·수식 → summary, 필요하면 concept
   - 문제 → concept(의도 포함), hint, solution 모두
   - 학생이 직접 쓴 풀이·계산이 보이면 check 를 반드시 채우세요
4. 해당 없는 항목은 생략합니다.
5. hint 에는 정답을 넣지 않습니다. 약한 힌트부터 순서대로.
6. 한국어로 짧고 단정하게. 수식은 반드시 LaTeX 로 쓰고 '$...$' 로 감싼다. 예) $\\lim_{x\\to 2}(2x^2-3x+1)$, $\\frac{x^2-9}{x-3}$, $\\sqrt{2}$, $x^2$. 글 속 숫자·단위는 그대로 쓰고, 식·기호·분수·극한·적분만 $ 로 감싼다.

check(오류 지적):
- 학생 본인의 풀이가 있을 때만 씁니다.
- 식을 한 줄씩 직접 다시 계산해 검산하세요. 결과만 보고 판단하지 않습니다.
- 맞았으면 'correct' 로 두고 억지로 흠을 잡지 않습니다.
- 틀렸으면 처음 틀어진 줄을 짚고, 원인과 올바른 식을 적습니다. 따라 틀린 뒷줄은 반복 지적하지 않습니다.
- 글씨를 못 읽겠으면 'unsure' 로 둡니다.

객관식을 풀 때:
- 선택지보다 발문을 먼저 읽고 solution.asked 에 옮겨 적은 뒤 풀이를 씁니다.
- "적절하지 않은", "옳지 않은", "아닌", "거리가 먼" 같은 부정 발문이면 고를 것은 틀린 선택지입니다.
- 선택지를 하나씩 모두 검토한 뒤, 발문이 요구하는 쪽을 답으로 고릅니다.`;
