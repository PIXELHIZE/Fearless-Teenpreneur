import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { FinalExam } from "./schemas";

export function normalizeJsonBasePath(outputPath: string): string {
  const resolved = path.resolve(outputPath);
  return resolved.replace(/\.json$/i, "");
}

function sourceIdsForQuestion(question: FinalExam["questions"][number]) {
  return [
    ...new Set(question.evidenceClaims.flatMap((claim) => claim.sourceIds)),
  ];
}

export function buildQuestionDocument(exam: FinalExam) {
  const usedSourceIds = new Set(
    exam.questions.flatMap((question) => sourceIdsForQuestion(question)),
  );

  return {
    generatedAt: exam.generatedAt,
    userRequest: exam.userRequest,
    title: exam.title,
    format: "AI-generated self-contained concept questions inspired by CSAT design",
    instructions: exam.instructions,
    coverage: Object.entries(
      exam.questions.reduce<Record<string, number>>((counts, question) => {
        counts[question.domain] = (counts[question.domain] ?? 0) + 1;
        return counts;
      }, {}),
    ).map(([domain, questionCount]) => ({ domain, questionCount })),
    questions: exam.questions.map((question) => ({
      id: question.id,
      domain: question.domain,
      stem: question.stem,
      choices: question.choices,
      difficulty: question.difficulty,
      sourceIds: sourceIdsForQuestion(question),
    })),
    sources: exam.sources
      .filter((source) => usedSourceIds.has(source.id))
      .map((source) => ({
        id: source.id,
        title: source.title,
        publisher: source.publisher,
        url: source.url,
      })),
  };
}

export function buildExplanationDocument(exam: FinalExam) {
  return {
    generatedAt: exam.generatedAt,
    userRequest: exam.userRequest,
    title: `${exam.title} — 정답 및 해설`,
    answers: exam.questions.map((question) => ({
      id: question.id,
      domain: question.domain,
      correctChoice: question.correctChoiceIndex + 1,
      explanation: question.explanation,
      learningObjective: question.learningObjective,
      verificationConfidence: question.verification.confidence,
      sourceIds: sourceIdsForQuestion(question),
    })),
    verificationSummary: exam.verificationSummary,
  };
}

export type JsonOutputPair = {
  questionsJson: string;
  explanationsJson: string;
};

export async function writeExamJsonPair(
  exam: FinalExam,
  outputPath: string,
): Promise<JsonOutputPair> {
  const basePath = normalizeJsonBasePath(outputPath);
  const questionsJson = `${basePath}-questions.json`;
  const explanationsJson = `${basePath}-explanations.json`;

  await Promise.all([
    writeFile(
      questionsJson,
      `${JSON.stringify(buildQuestionDocument(exam), null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      explanationsJson,
      `${JSON.stringify(buildExplanationDocument(exam), null, 2)}\n`,
      "utf8",
    ),
  ]);

  return { questionsJson, explanationsJson };
}
