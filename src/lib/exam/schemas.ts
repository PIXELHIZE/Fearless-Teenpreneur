import { z } from "zod";

export const difficultySchema = z.enum(["easy", "medium", "hard"]);

export const researchSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  publisher: z.string(),
  sourceType: z.enum([
    "official_exam",
    "government_or_public",
    "academic",
    "reputable_education",
    "other",
  ]),
  publishedOrUpdated: z.string(),
  verifiedClaims: z.array(z.string()),
  usage: z.string(),
});

export const researchPlanSchema = z.object({
  title: z.string(),
  subject: z.string(),
  targetLevel: z.string(),
  language: z.string(),
  scope: z.string(),
  referenceExamStyle: z.string(),
  sources: z.array(researchSourceSchema),
  stylePatterns: z.array(z.string()),
  importantFacts: z.array(
    z.object({
      fact: z.string(),
      sourceIds: z.array(z.string()),
      confidence: z.number().min(0).max(1),
    }),
  ),
  researchGaps: z.array(z.string()),
});

export const evidenceClaimSchema = z.object({
  claim: z.string(),
  sourceIds: z.array(z.string()),
});

export const questionSchema = z.object({
  id: z.number().int().positive(),
  domain: z.string(),
  stem: z.string(),
  choices: z.array(z.string()).length(5),
  correctChoiceIndex: z.number().int().min(0).max(4),
  explanation: z.string(),
  learningObjective: z.string(),
  difficulty: difficultySchema,
  evidenceClaims: z.array(evidenceClaimSchema),
  styleNote: z.string(),
});

export const draftExamSchema = z.object({
  title: z.string(),
  instructions: z.array(z.string()),
  questions: z.array(questionSchema),
});

export const verificationItemSchema = z.object({
  questionId: z.number().int().positive(),
  verdict: z.enum(["approved", "revised", "rejected"]),
  revisedStem: z.string(),
  revisedChoices: z.array(z.string()).length(5),
  revisedCorrectChoiceIndex: z.number().int().min(0).max(4),
  revisedExplanation: z.string(),
  factualFindings: z.array(z.string()),
  supportedBySourceUrls: z.array(z.string()),
  conflictingSourceUrls: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export const verificationBatchSchema = z.object({
  summary: z.string(),
  results: z.array(verificationItemSchema),
});

export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type ResearchPlan = z.infer<typeof researchPlanSchema>;
export type DraftQuestion = z.infer<typeof questionSchema>;
export type DraftExam = z.infer<typeof draftExamSchema>;
export type VerificationItem = z.infer<typeof verificationItemSchema>;
export type VerificationBatch = z.infer<typeof verificationBatchSchema>;

export type AuditedSource = ResearchSource & {
  searchedByTool: boolean;
  trustedDomain: boolean;
  https: boolean;
  qualityScore: number;
  normalizedUrl: string;
};

export type VerifiedQuestion = DraftQuestion & {
  verification: {
    verdict: "approved" | "revised";
    confidence: number;
    reason: string;
    factualFindings: string[];
    sourceUrls: string[];
    conflictingSourceUrls: string[];
    deterministicChecks: string[];
  };
};

export type FinalExam = {
  generatedAt: string;
  userRequest: string;
  model: string;
  research: ResearchPlan;
  sources: AuditedSource[];
  title: string;
  instructions: string[];
  questions: VerifiedQuestion[];
  verificationSummary: string;
};
