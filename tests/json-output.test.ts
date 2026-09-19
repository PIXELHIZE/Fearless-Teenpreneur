import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildExplanationDocument,
  buildQuestionDocument,
  normalizeJsonBasePath,
  writeExamJsonPair,
} from "../src/lib/exam/json-output";
import type { FinalExam } from "../src/lib/exam/schemas";

const exam: FinalExam = {
  generatedAt: "2026-09-19T00:00:00.000Z",
  userRequest: "고등학교 생명과학 세포 호흡 수능형 1문제",
  model: "test-model",
  title: "맞춤형 세포 호흡 문제",
  instructions: ["가장 알맞은 답을 하나 고르시오."],
  verificationSummary: "공식 자료와 독립 웹 검증 결과를 교차 확인했습니다.",
  research: {
    title: "맞춤형 세포 호흡 문제",
    subject: "생명과학",
    targetLevel: "고등학교",
    language: "한국어",
    scope: "세포 호흡",
    referenceExamStyle: "수능형 자료 분석 5지선다",
    sources: [],
    stylePatterns: [],
    importantFacts: [],
    researchGaps: [],
  },
  sources: [
    {
      id: "S1",
      title: "공식 학습 자료",
      url: "https://example.edu/cell-respiration",
      publisher: "공식 교육기관",
      sourceType: "government_or_public",
      publishedOrUpdated: "2026",
      verifiedClaims: ["세포 호흡의 핵심 사실"],
      usage: "사실 검증",
      normalizedUrl: "https://example.edu/cell-respiration",
      searchedByTool: true,
      trustedDomain: true,
      https: true,
      qualityScore: 90,
    },
  ],
  questions: [
    {
      id: 1,
      domain: "세포 호흡",
      stem: "새롭게 구성한 자료를 분석할 때 옳은 것은?",
      choices: ["첫째", "둘째", "셋째", "넷째", "다섯째"],
      correctChoiceIndex: 2,
      explanation: "자료의 조건에 따르면 셋째가 정답이다.",
      learningObjective: "세포 호흡 자료를 분석한다.",
      difficulty: "medium",
      evidenceClaims: [{ claim: "검증할 사실", sourceIds: ["S1"] }],
      styleNote: "사용자 범위와 수능형 자료 분석을 반영함",
      verification: {
        verdict: "approved",
        confidence: 0.97,
        reason: "사실과 정답을 확인함",
        factualFindings: ["핵심 사실 확인"],
        sourceUrls: ["https://example.edu/cell-respiration"],
        conflictingSourceUrls: [],
        deterministicChecks: ["5개 선지 확인"],
        choiceChecks: [],
      },
    },
  ],
};

test("문제 JSON과 해설 JSON 두 파일만 저장한다", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "study-exam-json-"));
  const files = await writeExamJsonPair(exam, path.join(dir, "맞춤시험.json"));

  assert.equal(files.questionsJson, path.join(dir, "맞춤시험-questions.json"));
  assert.equal(
    files.explanationsJson,
    path.join(dir, "맞춤시험-explanations.json"),
  );
  assert.deepEqual((await readdir(dir)).sort(), [
    "맞춤시험-explanations.json",
    "맞춤시험-questions.json",
  ]);
});

test("문제 파일에는 정답·해설을 넣지 않고 간단한 출처만 남긴다", () => {
  const questions = buildQuestionDocument(exam);
  const first = questions.questions[0];

  assert.equal("correctChoice" in first, false);
  assert.equal("explanation" in first, false);
  assert.deepEqual(first.sourceIds, ["S1"]);
  assert.deepEqual(questions.sources[0], {
    id: "S1",
    title: "공식 학습 자료",
    publisher: "공식 교육기관",
    url: "https://example.edu/cell-respiration",
  });
});

test("해설 파일에는 정답과 설명을 문항 번호로 연결한다", () => {
  const explanations = buildExplanationDocument(exam);
  assert.deepEqual(explanations.answers[0], {
    id: 1,
    domain: "세포 호흡",
    correctChoice: 3,
    explanation: "자료의 조건에 따르면 셋째가 정답이다.",
    learningObjective: "세포 호흡 자료를 분석한다.",
    verificationConfidence: 0.97,
    verifiedSourceUrls: exam.questions[0].verification.sourceUrls,
    choiceChecks: [],
    evidenceClaims: exam.questions[0].evidenceClaims,
    sourceIds: ["S1"],
  });
});

test("JSON 확장자는 기본 경로에서 제거한다", () => {
  assert.equal(normalizeJsonBasePath("result.JSON").endsWith("result"), true);
});

test("저장된 두 JSON을 다시 파싱할 수 있다", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "study-exam-json-"));
  const files = await writeExamJsonPair(exam, path.join(dir, "시험"));
  const questions = JSON.parse(await readFile(files.questionsJson, "utf8"));
  const explanations = JSON.parse(
    await readFile(files.explanationsJson, "utf8"),
  );

  assert.equal(questions.questions.length, 1);
  assert.equal(explanations.answers.length, 1);
});
