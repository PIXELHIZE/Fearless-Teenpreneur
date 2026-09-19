import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVerification,
  buildBalancedCoverage,
  extractWebSearchUrls,
  inferQuestionCount,
  inferRequestedDomains,
  normalizeModelName,
  requiresExternalStimulus,
  blindQuestion,
  verifyInBatches,
  PhaseTimeoutError,
} from "../src/lib/exam/openai-pipeline";
import type { Response } from "openai/resources/responses/responses";
import { auditSources, isTrustedHost, isUsableSource, normalizeUrl, sourceUrlWasSearched } from "../src/lib/exam/source-audit";
import type { DraftQuestion, VerificationBatch } from "../src/lib/exam/schemas";

const question: DraftQuestion = {
  id: 1,
  domain: "일반 개념",
  stem: "대한민국의 수도는 어디인가?",
  choices: ["부산", "서울", "인천", "대전", "광주"],
  correctChoiceIndex: 1,
  explanation: "서울은 대한민국의 수도이다.",
  learningObjective: "대한민국의 수도를 안다.",
  difficulty: "easy",
  evidenceClaims: [{ claim: "서울은 대한민국의 수도이다.", sourceIds: ["S1"] }],
  styleNote: "기초 개념 확인",
};

const sources = auditSources([{
  id: "S1", title: "공식 자료", url: "https://www.korea.net/AboutKorea/Constitution-and-Government",
  publisher: "공공기관", sourceType: "government_or_public", publishedOrUpdated: "2026",
  verifiedClaims: ["서울은 수도이다"], usage: "사실 근거",
}], ["https://www.korea.net/AboutKorea/Constitution-and-Government"]);

function verification(overrides: Partial<VerificationBatch["results"][number]> = {}): VerificationBatch {
  return {
    summary: "검증 완료",
    results: [
      {
        questionId: 1,
        verdict: "approved",
        revisedStem: question.stem,
        revisedChoices: question.choices,
        revisedCorrectChoiceIndex: 1,
        revisedExplanation: question.explanation,
        factualFindings: ["공식 자료로 확인"],
        choiceChecks: question.choices.map((_, choiceIndex) => ({
          choiceIndex, isCorrect: choiceIndex === 1, reason: "수도에 관한 공식 자료를 적용해 판정함",
          sourceUrls: [sources[0].url],
        })),
        supportedBySourceUrls: ["https://www.korea.net/AboutKorea/Constitution-and-Government"],
        conflictingSourceUrls: [],
        confidence: 0.96,
        reason: "단일 정답과 사실 근거를 확인함",
        ...overrides,
      },
    ],
  };
}

test("자연어에서 문항 수를 추출하고 1~30으로 제한한다", () => {
  assert.equal(inferQuestionCount("한국사 15문제 만들어줘"), 15);
  assert.equal(inferQuestionCount("create 7 questions about cells"), 7);
  assert.equal(inferQuestionCount("화학 결합을 공부하고 싶어", 8), 8);
  assert.equal(inferQuestionCount("수학 99문제"), 30);
});

test("화법과 언어를 별도 출제 영역으로 나누어 균등 배분한다", () => {
  const domains = inferRequestedDomains(
    "고등학교 화법과 언어 문제를 중상 난이도로 만들어줘",
  );
  assert.deepEqual(domains, ["화법", "언어"]);
  assert.deepEqual(buildBalancedCoverage(domains, 10), [
    { domain: "화법", questionCount: 5 },
    { domain: "언어", questionCount: 5 },
  ]);
});

test("gpt-sol 별칭을 공식 GPT-5.6 Sol 모델 ID로 변환한다", () => {
  assert.equal(normalizeModelName("gpt-sol"), "gpt-5.6-sol");
  assert.equal(normalizeModelName("gpt-5.6-sol"), "gpt-5.6-sol");
});

test("action이 없는 웹 검색 응답에서도 출처 URL을 안전하게 추출한다", () => {
  const response = {
    output: [
      {
        type: "web_search_call",
        id: "search-without-action",
        status: "completed",
      },
      {
        type: "web_search_call",
        id: "search-with-results",
        status: "completed",
        results: [{ url: "https://example.edu/result" }],
      },
      {
        type: "message",
        id: "message-with-citation",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: "출처",
            annotations: [
              {
                type: "url_citation",
                url: "https://example.edu/citation",
                title: "예시 출처",
                start_index: 0,
                end_index: 2,
              },
            ],
          },
        ],
      },
    ],
  } as unknown as Response;

  assert.deepEqual(extractWebSearchUrls(response).sort(), [
    "https://example.edu/citation",
    "https://example.edu/result",
  ]);
});

test("출처 URL을 정규화하고 공공·교육 도메인을 신뢰 출처로 분류한다", () => {
  assert.equal(normalizeUrl("HTTPS://WWW.KICE.RE.KR/example/#part"), "https://www.kice.re.kr/example");
  assert.equal(isTrustedHost("https://www.kice.re.kr/example"), true);
  assert.equal(isTrustedHost("https://random-blog.example/post"), false);

  const [audited] = auditSources(
    [
      {
        id: "S1",
        title: "공식 예시",
        url: "https://www.kice.re.kr/example",
        publisher: "한국교육과정평가원",
        sourceType: "official_exam",
        publishedOrUpdated: "2026",
        verifiedClaims: ["예시 주장"],
        usage: "시험 형식 참고",
      },
    ],
    ["https://www.kice.re.kr/example/"],
  );
  assert.equal(audited.searchedByTool, true);
  assert.equal(audited.trustedDomain, true);
  assert.ok(audited.qualityScore >= 90);
});

test("검색 결과에 근거가 있고 신뢰도가 높은 5지선다만 승인한다", () => {
  const searched = ["https://www.korea.net/AboutKorea/Constitution-and-Government"];
  const accepted = applyVerification([question], verification(), searched, sources);
  assert.equal(accepted.accepted.length, 1);
  assert.equal(accepted.rejected.length, 0);
  assert.equal(accepted.accepted[0].correctChoiceIndex, 1);

  const lowConfidence = applyVerification(
    [question],
    verification({ confidence: 0.4 }),
    searched, sources,
  );
  assert.equal(lowConfidence.accepted.length, 0);
  assert.match(lowConfidence.rejected[0].reason, /신뢰도 부족/);

  const duplicateChoices = applyVerification(
    [question],
    verification({ revisedChoices: ["서울", "서울", "인천", "대전", "광주"] }),
    searched, sources,
  );
  assert.equal(duplicateChoices.accepted.length, 0);
  assert.match(duplicateChoices.rejected[0].reason, /중복/);

  const ungrounded = applyVerification([question], verification(), ["https://example.com/other"], sources);
  assert.equal(ungrounded.accepted.length, 0);
  assert.match(ungrounded.rejected[0].reason, /근거 URL 없음/);
});

test("별도 보기나 시각 자료가 필요한 문항을 감지한다", () => {
  assert.equal(requiresExternalStimulus("다음 그림에 대한 설명으로 옳은 것은?"), true);
  assert.equal(requiresExternalStimulus("<보기>의 ㄱ~ㄷ 중 옳은 것은?"), true);
  assert.equal(
    requiresExternalStimulus("광합성과 세포 호흡의 관계로 옳은 것은?"),
    false,
  );
  assert.equal(requiresExternalStimulus("국가 대표를 선발하는 원리는?"), false);
});

test("검증 결과가 외부 자료를 참조하면 자동으로 탈락시킨다", () => {
  const searched = ["https://www.korea.net/AboutKorea/Constitution-and-Government"];
  const result = applyVerification(
    [question],
    verification({ revisedStem: "아래 표를 보고 옳은 것을 고르시오." }),
    searched, sources,
  );

  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /외부 자료가 필요한 문항/);
});

test("같은 사이트의 홈페이지·다른 문서·다른 쿼리를 근거로 인정하지 않는다", () => {
  const url = "https://www.kice.re.kr/board/view?id=1";
  assert.equal(sourceUrlWasSearched(url, ["https://www.kice.re.kr/"]), false);
  assert.equal(sourceUrlWasSearched(url, ["https://www.kice.re.kr/board/view?id=2"]), false);
  assert.equal(sourceUrlWasSearched(url, [url + "&utm_source=test#section"]), true);
  assert.equal(sourceUrlWasSearched("https://www.kice.re.kr/a", ["https://www.kice.re.kr/ab"]), false);
  assert.equal(isTrustedHost("https://www.kice.re.kr.attacker.com/a"), false);
});

test("모델이 공식 출처라고 주장해도 비공식 도메인과 중복 출처는 채택하지 않는다", () => {
  const fake = { ...sources[0], url: "https://random-blog.example/fact", sourceType: "official_exam" as const };
  assert.equal(isUsableSource(auditSources([fake], [fake.url])[0]), false);
  assert.equal(auditSources([sources[0], { ...sources[0], id: "S2" }], [sources[0].url]).length, 1);
  assert.equal(auditSources([sources[0], { ...sources[0], url: sources[0].url + "other" }], [sources[0].url]).length, 0);
});

test("블라인드 검증에는 정답·해설·정답을 암시하는 주장과 학습 목표를 보내지 않는다", () => {
  assert.deepEqual(Object.keys(blindQuestion(question)).sort(), ["choices", "domain", "id", "stem"]);
});

test("출처 연결 누락·복수 정답·선지별 근거 누락·빈 해설·중복 판정은 거부한다", () => {
  const check = (q: DraftQuestion, batch: VerificationBatch) =>
    applyVerification([q], batch, [sources[0].url], sources);
  assert.equal(check({ ...question, evidenceClaims: [] }, verification()).accepted.length, 0);
  assert.equal(check({ ...question, evidenceClaims: [{ claim: "주장", sourceIds: ["unknown"] }] }, verification()).accepted.length, 0);
  const choices = verification().results[0].choiceChecks;
  for (const overrides of [
    { choiceChecks: choices.map((item) => ({ ...item, isCorrect: true })) },
    { choiceChecks: choices.slice(0, 4) },
    { choiceChecks: choices.map((item) => ({ ...item, sourceUrls: [] })) },
    { choiceChecks: choices.map((item) => ({ ...item, choiceIndex: 1 })) },
    { revisedCorrectChoiceIndex: 5 },
    { revisedCorrectChoiceIndex: 1.5 },
    { revisedCorrectChoiceIndex: 0 },
    { revisedCorrectChoiceIndex: 0, choiceChecks: choices.map((item) => ({ ...item, isCorrect: item.choiceIndex === 0 })) },
    { revisedExplanation: " " },
    { revisedStem: "다르게 고친 발문" },
  ]) {
    assert.equal(check(question, verification(overrides)).accepted.length, 0);
  }
  const duplicate = verification();
  duplicate.results.push(duplicate.results[0]);
  assert.equal(check(question, duplicate).accepted.length, 0);
  assert.equal(check(question, { summary: "누락", results: [] }).accepted.length, 0);
});

test("시간 초과 배치를 분할하고 완료 문항을 보존하며 단일 실패만 제외한다", async () => {
  const questions = [1, 2, 3].map((id) => ({ ...question, id }));
  const calls: number[][] = [];
  const evaluated = await verifyInBatches(questions, sources, async (batch) => {
    calls.push(batch.map((q) => q.id));
    if (batch.length > 1 || batch[0].id === 2) throw new PhaseTimeoutError("검증 시간 초과");
    return {
      parsed: verification({ questionId: batch[0].id }), searchedUrls: [sources[0].url],
    };
  }, () => {});
  assert.deepEqual(calls, [[1, 2], [1], [2], [3]]);
  assert.deepEqual(evaluated.accepted.map((q) => q.id), [1, 3]);
  assert.deepEqual(evaluated.rejected.map((q) => q.id), [2]);
});

test("다른 검증 배치에서 찾은 출처로 승인하지 않고 API 설정 오류는 즉시 전파한다", async () => {
  const questions = [1, 2, 3].map((id) => ({ ...question, id }));
  const evaluated = await verifyInBatches(questions, sources, async (batch) => ({
    parsed: { summary: "검증", results: batch.map((q) => verification({ questionId: q.id }).results[0]) },
    searchedUrls: batch[0].id === 1 ? [sources[0].url] : [],
  }), () => {});
  assert.deepEqual(evaluated.accepted.map((q) => q.id), [1, 2]);
  assert.deepEqual(evaluated.rejected.map((q) => q.id), [3]);
  await assert.rejects(verifyInBatches(questions, sources, async () => {
    throw new Error("401 invalid key");
  }, () => {}), /401/);
});

test("전체 파이프라인은 10문항을 분할 생성하고 탈락 영역만 보충해 5:5로 반환한다", async () => {
  const { default: OpenAI } = await import("openai");
  const { generateExam } = await import("../src/lib/exam/openai-pipeline");
  const draftSizes: number[] = [];
  const verificationSizes: number[] = [];
  let sequence = 0;
  let rejectedOnce = false;
  const secondSource = { ...sources[0], id: "S2", url: "https://www.kice.re.kr/example" };
  const client = new OpenAI({ apiKey: "test-key", fetch: async (_, init) => {
    const params = JSON.parse(String(init?.body));
    const name = params.text.format.name;
    let data: unknown;
    if (name === "exam_research") {
      data = {
        title: "통합 시험", subject: "국어", targetLevel: "고등학교", language: "한국어",
        scope: "화법과 언어", referenceExamStyle: "개념", sources: [sources[0], secondSource],
        stylePatterns: [], importantFacts: [{ fact: "감사에서 제외된 주장", sourceIds: ["S99"], confidence: 1 }], researchGaps: [],
      };
    } else if (name === "draft_exam") {
      const input = JSON.parse(params.input);
      assert.deepEqual(input.research.importantFacts, []);
      draftSizes.push(input.requiredQuestionCount);
      const domains: string[] = input.coverageRequirements.flatMap((item: { domain: string; questionCount: number }) =>
        Array(item.questionCount).fill(item.domain));
      data = { title: "시험", instructions: [], questions: domains.map((domain) => ({
        ...question, id: 1, domain, stem: `새 문제 ${++sequence}`,
      })) };
    } else {
      const input = JSON.parse(params.input);
      verificationSizes.push(input.questions.length);
      data = { summary: "독립 검증 완료", results: input.questions.map((q: DraftQuestion) => {
        assert.equal("correctChoiceIndex" in q, false);
        assert.equal("explanation" in q, false);
        const reject = !rejectedOnce && q.id === 2;
        if (reject) rejectedOnce = true;
        return verification({ questionId: q.id, revisedStem: q.stem,
          verdict: reject ? "rejected" : "approved", reason: reject ? "모호한 문항" : "근거 확인",
        }).results[0];
      }) };
    }
    const base = { id: "resp_mock", object: "response", output: [], status: "in_progress" };
    const final = { ...base, status: "completed", output: [
      { id: "web_mock", type: "web_search_call", status: "completed", action: {
        type: "search", sources: [sources[0], secondSource].map(({ url }) => ({ type: "url", url })),
      } },
      { id: "msg_mock", type: "message", role: "assistant", status: "completed", content: [
        { type: "output_text", text: JSON.stringify(data), annotations: [] },
      ] },
    ] };
    return new Response([
      { type: "response.created", response: base, sequence_number: 0 },
      { type: "response.completed", response: final, sequence_number: 1 },
    ].map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
      headers: { "Content-Type": "text/event-stream" },
    });
  } });
  const exam = await generateExam({ request: "고등학교 화법과 언어 10문항", model: "test" }, client);
  assert.deepEqual(draftSizes, [4, 4, 2, 2]);
  assert.ok(verificationSizes.every((size) => size <= 2));
  assert.equal(exam.questions.length, 10);
  assert.equal(exam.questions.filter((q) => q.domain === "화법").length, 5);
  assert.equal(exam.questions.filter((q) => q.domain === "언어").length, 5);
  assert.ok(exam.questions.some((q) => q.stem === "새 문제 1"));
  assert.ok(!exam.questions.some((q) => q.stem === "새 문제 2"));
  assert.deepEqual(exam.questions.map((q) => q.id), Array.from({ length: 10 }, (_, i) => i + 1));
});
