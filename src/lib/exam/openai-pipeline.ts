import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import { zodTextFormat } from "openai/helpers/zod";
import { auditSources, sourceUrlWasSearched } from "./source-audit";
import {
  draftExamSchema,
  researchPlanSchema,
  verificationBatchSchema,
  type AuditedSource,
  type DraftExam,
  type DraftQuestion,
  type FinalExam,
  type ResearchPlan,
  type VerificationBatch,
  type VerificationItem,
  type VerifiedQuestion,
} from "./schemas";

const DEFAULT_MODEL = "gpt-5.6-sol";
const MIN_VERIFICATION_CONFIDENCE = 0.78;
const MAX_REPAIR_ROUNDS = 2;

type ProgressStage =
  | "research"
  | "source-audit"
  | "draft"
  | "verify"
  | "repair"
  | "complete";

export type ProgressUpdate = {
  stage: ProgressStage;
  message: string;
};

export type GenerateExamOptions = {
  request: string;
  questionCount?: number;
  model?: string;
  onProgress?: (update: ProgressUpdate) => void;
};

type WebResult<T> = {
  parsed: T;
  searchedUrls: string[];
};

function clampQuestionCount(value: number): number {
  return Math.max(1, Math.min(30, Math.trunc(value)));
}

export function inferQuestionCount(request: string, fallback = 10): number {
  const korean = request.match(/(\d{1,2})\s*(?:문제|문항|개)/);
  const english = request.match(/(?:make|create|generate)\s+(\d{1,2})/i);
  const value = Number(korean?.[1] ?? english?.[1] ?? fallback);
  return clampQuestionCount(Number.isFinite(value) ? value : fallback);
}

export function normalizeModelName(model: string): string {
  const normalized = model.trim().toLocaleLowerCase();
  if (["gpt-sol", "gpt5.6-sol", "sol"].includes(normalized)) {
    return "gpt-5.6-sol";
  }
  return model.trim();
}

export type CoverageRequirement = {
  domain: string;
  questionCount: number;
};

const KOREAN_LANGUAGE_DOMAINS = ["화법", "작문", "언어", "매체", "독서", "문학"];

export function inferRequestedDomains(request: string): string[] {
  return KOREAN_LANGUAGE_DOMAINS.map((domain) => ({
    domain,
    index: request.indexOf(domain),
  }))
    .filter(({ index }) => index >= 0)
    .sort((a, b) => a.index - b.index)
    .map(({ domain }) => domain);
}

export function buildBalancedCoverage(
  domains: string[],
  questionCount: number,
): CoverageRequirement[] {
  if (domains.length === 0) return [];
  const base = Math.floor(questionCount / domains.length);
  const remainder = questionCount % domains.length;
  return domains.map((domain, index) => ({
    domain,
    questionCount: base + (index < remainder ? 1 : 0),
  }));
}

function normalizeDomain(domain: string): string {
  return domain.replace(/\s+/g, "").toLocaleLowerCase();
}

function getCoverageDeficits(
  questions: VerifiedQuestion[],
  requirements: CoverageRequirement[],
): CoverageRequirement[] {
  return requirements
    .map((requirement) => {
      const actual = questions.filter(
        (question) =>
          normalizeDomain(question.domain) === normalizeDomain(requirement.domain),
      ).length;
      return {
        domain: requirement.domain,
        questionCount: Math.max(0, requirement.questionCount - actual),
      };
    })
    .filter((requirement) => requirement.questionCount > 0);
}

function expandRepairCoverage(
  deficits: CoverageRequirement[],
  retryCount: number,
): CoverageRequirement[] {
  if (deficits.length === 0) return [];
  const expanded = deficits.map((requirement) => ({ ...requirement }));
  let assigned = expanded.reduce(
    (sum, requirement) => sum + requirement.questionCount,
    0,
  );
  let index = 0;
  while (assigned < retryCount) {
    expanded[index % expanded.length].questionCount += 1;
    assigned += 1;
    index += 1;
  }
  return expanded;
}

function selectQuestionsForCoverage(
  questions: VerifiedQuestion[],
  requirements: CoverageRequirement[],
  questionCount: number,
): VerifiedQuestion[] {
  if (requirements.length === 0) return questions.slice(0, questionCount);

  const selected: VerifiedQuestion[] = [];
  const selectedIds = new Set<number>();
  for (const requirement of requirements) {
    const matches = questions.filter(
      (question) =>
        normalizeDomain(question.domain) === normalizeDomain(requirement.domain),
    );
    for (const question of matches.slice(0, requirement.questionCount)) {
      selected.push(question);
      selectedIds.add(question.id);
    }
  }
  for (const question of questions) {
    if (selected.length >= questionCount) break;
    if (!selectedIds.has(question.id)) selected.push(question);
  }
  return selected.slice(0, questionCount);
}

export function extractWebSearchUrls(response: Response): string[] {
  const urls = new Set<string>();

  for (const item of response.output) {
    if (item.type === "web_search_call") {
      // Some completed Responses omit `action` even though older SDK types mark
      // it as required. Treat it as optional and also inspect included results.
      const action = (
        item as typeof item & {
          action?: {
            type?: string;
            url?: string | null;
            sources?: Array<{ url?: string | null }>;
          };
          results?: Array<{ url?: string | null }> | null;
        }
      ).action;
      if (action?.type === "search") {
        for (const source of action.sources ?? []) {
          if (source.url) urls.add(source.url);
        }
      } else if (
        (action?.type === "open_page" || action?.type === "find_in_page") &&
        action.url
      ) {
        urls.add(action.url);
      }

      const results = (item as typeof item & {
        results?: Array<{ url?: string | null }> | null;
      }).results;
      for (const result of results ?? []) {
        if (result.url) urls.add(result.url);
      }
      continue;
    }

    if (item.type === "message") {
      for (const content of item.content) {
        if (content.type !== "output_text") continue;
        for (const annotation of content.annotations) {
          if (annotation.type === "url_citation" && annotation.url) {
            urls.add(annotation.url);
          }
        }
      }
    }
  }

  return [...urls];
}

function requireParsed<T>(value: T | null, phase: string): T {
  if (!value) {
    throw new Error(`${phase} 단계에서 구조화된 응답을 받지 못했습니다.`);
  }
  return value;
}

function createClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY가 없습니다. .env.local 파일에 API 키를 설정해 주세요.",
    );
  }
  const configuredTimeout = Number(process.env.OPENAI_TIMEOUT_MS ?? 180_000);
  const timeout = Number.isFinite(configuredTimeout)
    ? Math.max(30_000, Math.min(600_000, configuredTimeout))
    : 180_000;
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout,
    maxRetries: 1,
  });
}

async function withProgressHeartbeat<T>(
  operation: () => Promise<T>,
  progress: (update: ProgressUpdate) => void,
  stage: ProgressStage,
  message: string,
): Promise<T> {
  let elapsedSeconds = 0;
  const timer = setInterval(() => {
    elapsedSeconds += 20;
    progress({ stage, message: `${message} (${elapsedSeconds}초 경과)` });
  }, 20_000);
  try {
    return await operation();
  } finally {
    clearInterval(timer);
  }
}

async function researchTopic(
  client: OpenAI,
  model: string,
  request: string,
  questionCount: number,
  requestedDomains: string[] = [],
): Promise<WebResult<ResearchPlan>> {
  const response = await client.responses.parse({
    model,
    store: false,
    reasoning: { effort: "medium" },
    max_output_tokens: 18_000,
    max_tool_calls: 16,
    include: [
      "web_search_call.action.sources",
      "web_search_call.results",
    ],
    tools: [
      {
        type: "web_search",
        external_web_access: true,
        search_context_size: "high",
        user_location: {
          type: "approximate",
          country: "KR",
          city: "Seoul",
          timezone: "Asia/Seoul",
        },
      },
    ],
    text: { format: zodTextFormat(researchPlanSchema, "exam_research") },
    instructions: [
      "당신은 시험 출제 전담 리서처다.",
      "반드시 웹 검색 도구를 여러 번 사용하되, 웹에서는 출제에 필요한 사실 근거와 수능형 문항의 추상적 설계 특징만 조사한다.",
      "사실 근거는 정부·공공기관·학술기관·공식 교육기관 등 1차 출처를 우선한다.",
      "사용자 요청 문장은 최종 맞춤형 문제 설계의 최우선 조건이다. 과목, 범위, 수준, 난이도, 문항 수와 원하는 상황을 구체적으로 해석한다.",
      "requiredDomains가 둘 이상이면 하나로 합치거나 일부를 생략하지 말고, 각 영역의 핵심 개념과 근거 출처를 따로 조사한다.",
      "수능 자료에서는 발문 구조, 자료 해석, 추론·적용 수준, 오답 설계처럼 일반화 가능한 특징만 정리한다. 기존 문항의 지문·발문·선지는 수집하거나 재사용하지 않는다.",
      "실제 시험 자료를 찾지 못하면 없는 것처럼 꾸미지 말고 researchGaps에 명시한다.",
      "source.url에는 실제로 검색하거나 열어 본 페이지 URL만 넣고, 각 출처에 S1, S2처럼 고유 id를 부여한다.",
      "상충하는 사실이 있으면 더 권위 있고 최신인 출처를 우선하고 researchGaps에 충돌을 기록한다.",
      "사용자 요청 언어를 따르며, 별도 지정이 없으면 한국어로 작성한다.",
    ].join("\n"),
    input: [
      `사용자 요청: ${request}`,
      `최종 목표 문항 수: ${questionCount}`,
      `필수 출제 영역: ${requestedDomains.length ? requestedDomains.join(", ") : "사용자 요청 전체"}`,
      "최소 4개의 관련 출처를 조사하되, 가능하면 공식 시험/공개 예시 자료 1개 이상과 사실 검증용 1차 출처 2개 이상을 포함하라.",
      requestedDomains.length > 1
        ? "각 필수 출제 영역마다 사실 검증에 쓸 수 있는 권위 있는 출처를 최소 1개 이상 포함하라."
        : "",
      "importantFacts의 모든 사실은 sourceIds로 근거를 연결하라.",
    ].filter(Boolean).join("\n\n"),
  });

  return {
    parsed: requireParsed(response.output_parsed, "자료 조사"),
    searchedUrls: extractWebSearchUrls(response),
  };
}

function researchForPrompt(research: ResearchPlan, sources: AuditedSource[]) {
  return {
    title: research.title,
    subject: research.subject,
    targetLevel: research.targetLevel,
    language: research.language,
    scope: research.scope,
    referenceExamStyle: research.referenceExamStyle,
    stylePatterns: research.stylePatterns,
    importantFacts: research.importantFacts,
    researchGaps: research.researchGaps,
    sources: sources.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      sourceType: source.sourceType,
      verifiedClaims: source.verifiedClaims,
      qualityScore: source.qualityScore,
    })),
  };
}

async function draftQuestions(
  client: OpenAI,
  model: string,
  request: string,
  research: ResearchPlan,
  sources: AuditedSource[],
  count: number,
  startId: number,
  excludedStems: string[] = [],
  coverageRequirements: CoverageRequirement[] = [],
): Promise<DraftExam> {
  const response = await client.responses.parse({
    model,
    store: false,
    reasoning: { effort: "medium" },
    max_output_tokens: 24_000,
    text: { format: zodTextFormat(draftExamSchema, "draft_exam") },
    instructions: [
      "당신은 수능형 평가 설계에 능숙한 AI 맞춤 출제자다.",
      "사용자 요청 문장을 출제 설계서로 삼아 주제, 범위, 학습 수준, 난이도, 강조점에 정확히 맞춘 새로운 문항을 직접 창작한다.",
      "웹 리서치는 사실이 맞는지 확인하는 재료일 뿐이다. 검색 결과에서 질문을 찾아 옮기거나 기존 문제를 요약해서는 안 된다.",
      "현재 버전은 개념 문제 전용이다. 별도 지문, <보기>, ㄱ·ㄴ·ㄷ 진술 묶음, 그림, 사진, 표, 그래프, 도표, 수식 이미지, 실험 결과 자료가 필요한 문항을 절대 만들지 않는다.",
      "모든 문항은 stem과 다섯 choices의 텍스트만 읽고 완전하게 풀 수 있어야 한다. 존재하지 않는 위·아래·다음 자료나 시각 요소를 참조하지 않는다.",
      "실제 수능 문항에서는 간결한 발문, 개념 간 관계 추론, 오개념을 이용한 매력적인 오답 같은 추상적 형식만 참고한다.",
      "모든 지문, 상황, 수치, 사례, 발문과 선지는 이 사용자 요청을 위해 새로 구성한다. 공개된 시험 문항의 문장을 복제하거나 일부 표현만 바꾸는 행위를 금지한다.",
      "단순 용어 암기에만 치우치지 말고, 보조 자료 없이도 개념의 원리·관계·적용을 판별하는 수능형 개념 문항을 만든다.",
      "모든 문항은 정확히 다섯 개의 서로 다른 선지를 가져야 하고 정답은 하나뿐이어야 한다.",
      "오답은 그럴듯하지만 명확히 틀려야 하며 말장난, 이중 부정, 불필요한 함정을 피한다.",
      "사실을 묻는 문항은 evidenceClaims에 검증할 핵심 주장과 근거 sourceIds를 기록한다.",
      "각 문항의 domain에는 그 문항이 실제로 평가하는 영역명을 기록한다. coverageRequirements가 있으면 domain 값을 거기에 적힌 문자열과 정확히 일치시킨다.",
      "coverageRequirements의 영역별 문항 수는 최소 기준이 아니라 정확한 배분이다. 한 영역의 개념을 다른 영역으로 표시해 수를 채우지 않는다.",
      "styleNote에는 해당 문항이 사용자 요청의 어떤 조건을 반영했고 어떤 수능형 사고 방식을 사용했는지 짧게 기록한다.",
      "정답 위치가 1~5번에 고르게 분포하도록 한다.",
      "리서치에 불확실성이나 공백으로 표시된 내용은 출제하지 않는다.",
    ].join("\n"),
    input: JSON.stringify(
      {
        userRequest: request,
        requiredQuestionCount: count,
        requiredQuestionIds: `${startId}부터 ${startId + count - 1}까지 연속된 정수`,
        excludedStems,
        coverageRequirements,
        customizationRequirements: [
          "userRequest의 모든 명시 조건을 문항 설계에 반영할 것",
          "각 문항을 새로 창작하고 기존 문제를 검색·복제·변형하지 말 것",
          "수능의 추상적 형식만 참고해 개념 이해·관계 추론·적용 중심으로 구성할 것",
          "별도 보기나 그림·표·그래프 없이 stem과 choices만으로 풀 수 있을 것",
          "문항들이 서로 다른 학습 요소와 사고 과정을 평가하도록 할 것",
        ],
        research: researchForPrompt(research, sources),
      },
      null,
      2,
    ),
  });

  const parsed = requireParsed(response.output_parsed, "문항 초안 생성");
  if (parsed.questions.length !== count) {
    throw new Error(
      `문항 초안 수가 요청과 다릅니다. 요청 ${count}개, 응답 ${parsed.questions.length}개`,
    );
  }
  return parsed;
}

async function verifyQuestions(
  client: OpenAI,
  model: string,
  request: string,
  research: ResearchPlan,
  sources: AuditedSource[],
  questions: DraftQuestion[],
  coverageRequirements: CoverageRequirement[] = [],
): Promise<WebResult<VerificationBatch>> {
  const response = await client.responses.parse({
    model,
    store: false,
    reasoning: { effort: "high" },
    max_output_tokens: 24_000,
    max_tool_calls: Math.min(40, Math.max(10, questions.length * 3)),
    include: [
      "web_search_call.action.sources",
      "web_search_call.results",
    ],
    tools: [
      {
        type: "web_search",
        external_web_access: true,
        search_context_size: "high",
        user_location: {
          type: "approximate",
          country: "KR",
          city: "Seoul",
          timezone: "Asia/Seoul",
        },
      },
    ],
    text: {
      format: zodTextFormat(verificationBatchSchema, "verified_questions"),
    },
    instructions: [
      "당신은 초안 작성자와 독립된 엄격한 시험 문항 검증자다.",
      "반드시 웹 검색으로 각 문항의 핵심 사실, 정답, 오답의 오류를 재검증한다.",
      "사용자가 제공받은 리서치 요약을 그대로 믿지 말고 권위 있는 1차 출처를 다시 찾는다.",
      "사용자 요청의 주제·범위·수준·난이도와 맞지 않는 문항은 rejected로 판정한다.",
      "coverageRequirements가 있으면 각 question.domain이 지정된 영역 중 하나인지, 실제 문항 내용도 그 영역을 평가하는지 확인한다. 라벨과 내용이 다르면 rejected로 판정한다.",
      "기존 웹 문제를 복제하거나 표현만 바꾼 흔적이 의심되면 특징적인 문구를 검색하고, 확인되면 rejected로 판정한다.",
      "별도 보기, 그림, 표, 그래프, 도표, 실험 결과 자료나 ㄱ·ㄴ·ㄷ 진술 묶음이 있어야 풀 수 있는 문항은 rejected로 판정한다.",
      "수정할 때도 사용자 맞춤 조건과 수능형 개념 추론 구조를 유지하며, stem과 choices만으로 완결되게 만든다.",
      "문항마다 정확히 하나의 정답이 있는지, 나머지 네 선지가 명백히 틀린지 확인한다.",
      "표현만 고치면 되는 문항은 revised, 이미 충분하면 approved, 사실 검증 실패·복수 정답·근거 부족이면 rejected로 판정한다.",
      "approved도 revisedStem/revisedChoices/revisedCorrectChoiceIndex/revisedExplanation에 최종 사용할 내용을 모두 채운다.",
      "supportedBySourceUrls에는 실제로 검색하거나 열어 확인한 URL만 기록한다.",
      "각 questionId는 정확히 한 번씩 반환하고 누락하지 않는다.",
      "근거가 약하면 confidence를 낮게 주고, 추측으로 승인하지 않는다.",
    ].join("\n"),
    input: JSON.stringify(
      {
        userRequest: request,
        coverageRequirements,
        researchContext: researchForPrompt(research, sources),
        questions,
      },
      null,
      2,
    ),
  });

  return {
    parsed: requireParsed(response.output_parsed, "문항 검증"),
    searchedUrls: extractWebSearchUrls(response),
  };
}

function uniqueNonEmptyChoices(choices: string[]): boolean {
  const normalized = choices.map((choice) => choice.trim().toLocaleLowerCase());
  return normalized.every(Boolean) && new Set(normalized).size === 5;
}

const EXTERNAL_STIMULUS_PATTERNS = [
  /[<\[]\s*보기\s*[>\]]/u,
  /(?:다음|위|아래|제시된)\s*(?:그림|사진|표|그래프|도표|자료|보기|실험\s*결과)/u,
  /(?:^|\s)(?:그림|사진|표|그래프|도표)\s*(?:에서|를|을|에 따르면|와 같이|과 같이)/u,
  /[ㄱㄴㄷ]\s*[~～\-]\s*[ㄱㄴㄷ]/u,
  /(?:ㄱ|ㄴ|ㄷ)\s*(?:만|과|와|,|·)\s*(?:옳|맞)/u,
];

export function requiresExternalStimulus(
  stem: string,
  choices: string[] = [],
): boolean {
  const text = [stem, ...choices].join(" ");
  return EXTERNAL_STIMULUS_PATTERNS.some((pattern) => pattern.test(text));
}

export function applyVerification(
  questions: DraftQuestion[],
  verification: VerificationBatch,
  searchedUrls: string[],
): { accepted: VerifiedQuestion[]; rejected: Array<{ id: number; reason: string }> } {
  const results = new Map<number, VerificationItem>();
  for (const item of verification.results) {
    if (!results.has(item.questionId)) results.set(item.questionId, item);
  }

  const accepted: VerifiedQuestion[] = [];
  const rejected: Array<{ id: number; reason: string }> = [];

  for (const question of questions) {
    const result = results.get(question.id);
    if (!result) {
      rejected.push({ id: question.id, reason: "검증 결과 누락" });
      continue;
    }

    const choices = result.revisedChoices;
    const dependsOnExternalStimulus = requiresExternalStimulus(
      result.revisedStem,
      choices,
    );
    const groundedUrls = result.supportedBySourceUrls.filter((url) =>
      sourceUrlWasSearched(url, searchedUrls),
    );
    const checks: string[] = [];
    if (choices.length === 5 && uniqueNonEmptyChoices(choices)) {
      checks.push("5개 선지의 비어 있지 않음·중복 없음 확인");
    }
    if (
      result.revisedCorrectChoiceIndex >= 0 &&
      result.revisedCorrectChoiceIndex < 5
    ) {
      checks.push("정답 인덱스 범위 확인");
    }
    if (groundedUrls.length > 0) {
      checks.push("검증자가 사용한 웹 검색 결과와 출처 URL 교차 확인");
    }
    if (result.conflictingSourceUrls.length === 0) {
      checks.push("보고된 상충 출처 없음");
    }
    if (!dependsOnExternalStimulus) {
      checks.push("별도 보기·시각 자료 없이 풀 수 있는 자립형 개념 문항 확인");
    }

    const failureReasons = [
      result.verdict === "rejected" ? result.reason || "모델 검증 반려" : "",
      !uniqueNonEmptyChoices(choices) ? "선지가 비어 있거나 중복됨" : "",
      result.confidence < MIN_VERIFICATION_CONFIDENCE
        ? `검증 신뢰도 부족(${result.confidence.toFixed(2)})`
        : "",
      groundedUrls.length === 0 ? "웹 검색 결과로 교차 확인된 근거 URL 없음" : "",
      result.conflictingSourceUrls.length > 0 ? "상충하는 출처가 남아 있음" : "",
      dependsOnExternalStimulus
        ? "별도 보기·그림·표·그래프 등 외부 자료가 필요한 문항"
        : "",
    ].filter(Boolean);

    if (failureReasons.length > 0) {
      rejected.push({ id: question.id, reason: failureReasons.join("; ") });
      continue;
    }

    accepted.push({
      ...question,
      stem: result.revisedStem,
      choices,
      correctChoiceIndex: result.revisedCorrectChoiceIndex,
      explanation: result.revisedExplanation,
      verification: {
        verdict: result.verdict === "approved" ? "approved" : "revised",
        confidence: result.confidence,
        reason: result.reason,
        factualFindings: result.factualFindings,
        sourceUrls: groundedUrls,
        conflictingSourceUrls: result.conflictingSourceUrls,
        deterministicChecks: checks,
      },
    });
  }

  return { accepted, rejected };
}

function dedupeQuestions(questions: VerifiedQuestion[]): VerifiedQuestion[] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = question.stem.replace(/\s+/g, " ").trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function generateExam(options: GenerateExamOptions): Promise<FinalExam> {
  const request = options.request.trim();
  if (!request) throw new Error("공부하고 싶은 내용을 입력해 주세요.");

  const fallbackCount = Number(process.env.DEFAULT_QUESTION_COUNT ?? 10);
  const questionCount = clampQuestionCount(
    options.questionCount ?? inferQuestionCount(request, fallbackCount),
  );
  const requestedDomains = inferRequestedDomains(request);
  if (requestedDomains.length > questionCount) {
    throw new Error(
      `${requestedDomains.join(", ")} 영역을 모두 포함하려면 최소 ${requestedDomains.length}문항이 필요합니다.`,
    );
  }
  const finalCoverage = buildBalancedCoverage(requestedDomains, questionCount);
  const model = normalizeModelName(
    options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
  );
  const progress = options.onProgress ?? (() => undefined);
  const client = createClient();

  progress({
    stage: "research",
    message: "사용자 조건을 분석하고 사실 근거와 수능형 설계 특징을 조사합니다.",
  });
  const researchResult = await withProgressHeartbeat(
    () =>
      researchTopic(
        client,
        model,
        request,
        questionCount,
        requestedDomains,
      ),
    progress,
    "research",
    "웹에서 사실 근거와 영역별 출처를 확인하고 있습니다.",
  );

  progress({ stage: "source-audit", message: "검색 결과와 인용 출처를 교차 확인합니다." });
  const auditedSources = auditSources(
    researchResult.parsed.sources,
    researchResult.searchedUrls,
  );
  const usableSources = auditedSources.filter(
    (source) => source.searchedByTool && source.qualityScore >= 45,
  );
  if (usableSources.length < 2) {
    throw new Error(
      `검증 가능한 출처가 부족합니다(${usableSources.length}개). 주제를 더 구체적으로 입력해 주세요.`,
    );
  }

  const bufferCount = Math.min(3, Math.max(1, Math.ceil(questionCount * 0.2)));
  const firstBatchCount = Math.min(30, questionCount + bufferCount);
  const firstBatchCoverage = buildBalancedCoverage(
    requestedDomains,
    firstBatchCount,
  );
  progress({
    stage: "draft",
    message: `보기·그림 없이 풀 수 있는 맞춤형 수능 개념 문항 ${firstBatchCount}개를 생성합니다.${firstBatchCoverage.length ? ` 영역 배분: ${firstBatchCoverage.map((item) => `${item.domain} ${item.questionCount}개`).join(", ")}` : ""}`,
  });
  let nextId = 1;
  let draft = await withProgressHeartbeat(
    () =>
      draftQuestions(
        client,
        model,
        request,
        researchResult.parsed,
        usableSources,
        firstBatchCount,
        nextId,
        [],
        firstBatchCoverage,
      ),
    progress,
    "draft",
    "맞춤형 개념 문항을 작성하고 있습니다.",
  );
  nextId += draft.questions.length;

  progress({ stage: "verify", message: "각 문항의 정답과 사실을 웹에서 독립 검증합니다." });
  let verification = await withProgressHeartbeat(
    () =>
      verifyQuestions(
        client,
        model,
        request,
        researchResult.parsed,
        usableSources,
        draft.questions,
        finalCoverage,
      ),
    progress,
    "verify",
    "정답과 출처를 독립적으로 검증하고 있습니다.",
  );
  let evaluated = applyVerification(
    draft.questions,
    verification.parsed,
    verification.searchedUrls,
  );
  let accepted = dedupeQuestions(evaluated.accepted);
  let coverageDeficits = getCoverageDeficits(accepted, finalCoverage);
  const summaries = [verification.parsed.summary];
  const rejectionLog = [...evaluated.rejected];

  for (
    let round = 1;
    (accepted.length < questionCount || coverageDeficits.length > 0) &&
    round <= MAX_REPAIR_ROUNDS;
    round += 1
  ) {
    const missing = Math.max(0, questionCount - accepted.length);
    const deficitCount = coverageDeficits.reduce(
      (sum, requirement) => sum + requirement.questionCount,
      0,
    );
    const retryCount = Math.min(30, Math.max(missing, deficitCount) + 1);
    const repairCoverage = coverageDeficits.length
      ? expandRepairCoverage(coverageDeficits, retryCount)
      : buildBalancedCoverage(requestedDomains, retryCount);
    progress({
      stage: "repair",
      message: `검증 탈락분과 영역 부족분을 보충합니다. ${round}/${MAX_REPAIR_ROUNDS}차, ${retryCount}개 생성${repairCoverage.length ? ` (${repairCoverage.map((item) => `${item.domain} ${item.questionCount}개`).join(", ")})` : ""}`,
    });
    draft = await withProgressHeartbeat(
      () =>
        draftQuestions(
          client,
          model,
          request,
          researchResult.parsed,
          usableSources,
          retryCount,
          nextId,
          accepted.map((question) => question.stem),
          repairCoverage,
        ),
      progress,
      "repair",
      "부족한 영역의 대체 문항을 작성하고 있습니다.",
    );
    nextId += draft.questions.length;
    verification = await withProgressHeartbeat(
      () =>
        verifyQuestions(
          client,
          model,
          request,
          researchResult.parsed,
          usableSources,
          draft.questions,
          finalCoverage,
        ),
      progress,
      "verify",
      "대체 문항의 정답과 출처를 검증하고 있습니다.",
    );
    evaluated = applyVerification(
      draft.questions,
      verification.parsed,
      verification.searchedUrls,
    );
    accepted = dedupeQuestions([...accepted, ...evaluated.accepted]);
    coverageDeficits = getCoverageDeficits(accepted, finalCoverage);
    rejectionLog.push(...evaluated.rejected);
    summaries.push(verification.parsed.summary);
  }

  if (accepted.length < questionCount || coverageDeficits.length > 0) {
    const details = rejectionLog
      .slice(-8)
      .map((item) => `Q${item.id}: ${item.reason}`)
      .join(" | ");
    const coverageMessage = coverageDeficits.length
      ? ` 영역 부족: ${coverageDeficits.map((item) => `${item.domain} ${item.questionCount}개`).join(", ")}.`
      : "";
    throw new Error(
      `검증을 통과한 문항이 ${accepted.length}/${questionCount}개입니다.${coverageMessage} 안전을 위해 JSON 문제지를 만들지 않았습니다. ${details}`,
    );
  }

  const finalQuestions = selectQuestionsForCoverage(
    accepted,
    finalCoverage,
    questionCount,
  ).map((question, index) => ({
    ...question,
    id: index + 1,
  }));

  progress({ stage: "complete", message: `${questionCount}개 문항이 검증을 통과했습니다.` });
  return {
    generatedAt: new Date().toISOString(),
    userRequest: request,
    model,
    research: researchResult.parsed,
    sources: auditedSources,
    title: researchResult.parsed.title,
    instructions: [
      "각 문항의 정답으로 가장 적절한 하나를 고르시오.",
      "문항당 정답은 하나이며, 총 다섯 개의 선택지가 제시됩니다.",
      "정답과 해설은 별도 해설 JSON 파일에서 확인하세요.",
    ],
    questions: finalQuestions,
    verificationSummary: [
      ...summaries,
      `초안 중 ${rejectionLog.length}개는 기준 미달로 제외되었고 ${questionCount}개만 채택되었습니다.`,
      finalCoverage.length
        ? `최종 영역 배분: ${finalCoverage.map((item) => `${item.domain} ${item.questionCount}개`).join(", ")}.`
        : "",
    ].filter(Boolean).join(" "),
  };
}
