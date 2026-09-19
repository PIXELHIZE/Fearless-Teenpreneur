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
} from "../src/lib/exam/openai-pipeline";
import type { Response } from "openai/resources/responses/responses";
import { auditSources, isTrustedHost, normalizeUrl } from "../src/lib/exam/source-audit";
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
  const accepted = applyVerification([question], verification(), searched);
  assert.equal(accepted.accepted.length, 1);
  assert.equal(accepted.rejected.length, 0);
  assert.equal(accepted.accepted[0].correctChoiceIndex, 1);

  const lowConfidence = applyVerification(
    [question],
    verification({ confidence: 0.4 }),
    searched,
  );
  assert.equal(lowConfidence.accepted.length, 0);
  assert.match(lowConfidence.rejected[0].reason, /신뢰도 부족/);

  const duplicateChoices = applyVerification(
    [question],
    verification({ revisedChoices: ["서울", "서울", "인천", "대전", "광주"] }),
    searched,
  );
  assert.equal(duplicateChoices.accepted.length, 0);
  assert.match(duplicateChoices.rejected[0].reason, /중복/);

  const ungrounded = applyVerification([question], verification(), ["https://example.com/other"]);
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
    searched,
  );

  assert.equal(result.accepted.length, 0);
  assert.match(result.rejected[0].reason, /외부 자료가 필요한 문항/);
});
