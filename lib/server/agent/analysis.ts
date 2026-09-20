import "server-only";
import { askForJson } from "../ai";
import {
  addUnit,
  getAnalysis,
  getLesson,
  getMaterial,
  getProgress,
  listAnswers,
  listGoals,
  listUnits,
  recordRevision,
  saveAnalysis,
  setLessonStatus,
  updateUnit,
} from "../repo";
import { analysisEffectiveFrom } from "../policy";
import { awardXp, logFeedback, XP } from "../xp";
import type { Lesson } from "@/lib/types";

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "이번 수업을 한두 문장으로 요약" },
    strengths: { type: "array", items: { type: "string" }, description: "잘한 점 1~3개" },
    weaknesses: { type: "array", items: { type: "string" }, description: "부족한 점 1~3개. 구체적인 유형으로." },
    feedback: { type: "string", description: "학생에게 직접 건네는 피드백 2~4문장. 다음에 무엇을 하면 되는지 포함." },
    mastery: {
      type: "array",
      description: "이번 수업에서 다룬 단원의 숙련도 갱신",
      items: {
        type: "object",
        properties: {
          unit_title: { type: "string" },
          mastery: { type: "integer", description: "0~100" },
          done: { type: "boolean", description: "이 단원을 마쳐도 되는지" },
        },
        required: ["unit_title", "mastery"],
      },
    },
    curriculum_changes: {
      type: "array",
      description: "다음 날부터 반영할 커리큘럼 조정. 필요 없으면 빈 배열.",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add_unit", "reweight", "revisit"] },
          unit_title: { type: "string", description: "대상 단원 이름. add_unit 이면 새 단원 이름." },
          summary: { type: "string", description: "add_unit 일 때 단원 설명" },
          difficulty: { type: "integer" },
          weight: { type: "integer", description: "1~5" },
          reason: { type: "string", description: "왜 이렇게 바꾸는지 한 문장" },
        },
        required: ["action", "unit_title", "reason"],
      },
    },
  },
  required: ["summary", "feedback"],
};

const SYSTEM = `당신은 학생을 전담하는 과외 선생님입니다.
방금 끝난 수업의 기록을 보고 학생의 상태를 분석하고, 다음 커리큘럼을 어떻게 손볼지 정합니다.

규칙:
- 정답률만 보지 말고 "무엇을 왜 틀렸는지"를 봅니다. 같은 개념에서 반복해 틀렸다면 그 개념이 약점입니다.
- 수업에 실제로 머문 시간이 짧으면 분량이나 난이도가 맞지 않았을 수 있습니다. 그 점도 고려합니다.
- 아예 참여하지 않았다면 책망하지 말고, 다음에 이어서 할 수 있게 조정합니다.
- 잘한 부분이 있으면 분명히 짚어 줍니다.
- 피드백은 학생에게 직접 말하듯 한국어로 씁니다. 수식이 필요하면 '$...$' LaTeX 로 씁니다.`;

/** 수업이 끝난 뒤 자동으로 도는 분석. 이미 분석했으면 그대로 둔다. */
export async function analyzeLesson(userId: string, lessonId: string) {
  if (getAnalysis(lessonId)) return getAnalysis(lessonId)!;

  const lesson = getLesson(userId, lessonId);
  if (!lesson) throw new Error("수업을 찾을 수 없습니다.");

  const material = getMaterial(lessonId);
  const progress = getProgress(lessonId);
  const answers = listAnswers(lessonId);
  const graded = answers.filter((a) => a.kind !== "note");
  const accuracy = graded.length ? Math.round((graded.filter((a) => a.is_correct).length / graded.length) * 100) : 0;

  // 참여 자체가 없었으면 AI 를 부르지 않고 사실만 남긴다.
  if (!progress.entered_at) {
    const analysis = {
      summary: "이 수업에는 참여하지 않았어요.",
      strengths: [] as string[],
      weaknesses: ["예정한 학습을 하지 못했습니다."],
      feedback: "이번 수업은 넘어갔어요. 못 한 만큼은 다음 일정에 나눠 담을게요. 부담 갖지 말고 다음 시간에 만나요.",
      accuracy: 0,
      focus_seconds: 0,
    };
    saveAnalysis(userId, lessonId, analysis);
    setLessonStatus(lessonId, "missed");
    logFeedback(userId, { kind: lesson.origin === "instant" ? "instant" : "lesson", ref_id: lessonId, title: lesson.title, ...analysis });
    return { ...analysis, created_at: Date.now() };
  }

  const units = listUnits(userId);
  const unit = units.find((u) => u.id === lesson.unit_id);

  const result = await askForJson<{
    summary: string;
    strengths?: string[];
    weaknesses?: string[];
    feedback: string;
    mastery?: { unit_title: string; mastery: number; done?: boolean }[];
    curriculum_changes?: {
      action: "add_unit" | "reweight" | "revisit";
      unit_title: string;
      summary?: string;
      difficulty?: number;
      weight?: number;
      reason: string;
    }[];
  }>({
    system: SYSTEM,
    name: "analyze_lesson",
    description: "끝난 수업을 분석하고 커리큘럼 조정안을 낸다.",
    schema: SCHEMA,
    messages: [
      {
        role: "user",
        content: [
          `수업: ${lesson.title} (${lesson.date}, ${lesson.end_min - lesson.start_min}분 예정)`,
          unit ? `단원: ${unit.title} · 현재 숙련도 ${unit.mastery}%` : "",
          `실제 참여 시간: ${Math.round(progress.active_seconds / 60)}분`,
          `슬라이드 진행: ${progress.slide_index + 1}/${material.slides.length || 1}`,
          `정답률: ${accuracy}% (${graded.filter((a) => a.is_correct).length}/${graded.length})`,
          "",
          "[문항별 기록]",
          ...graded.map(
            (a) =>
              `- [${a.kind}] ${findQuestion(material, a.question_id)} → 학생: ${a.given || "미응답"} / 정답: ${a.correct} / ${a.is_correct ? "정답" : "오답"}${a.comment ? ` / 채점: ${a.comment}` : ""}`,
          ),
          "",
          "[현재 커리큘럼]",
          ...units.map((u) => `- ${u.title} (난이도 ${u.difficulty}, 중요도 ${u.weight}, 숙련도 ${u.mastery}%, ${u.status})`),
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });

  const entry = {
    summary: result.summary,
    strengths: result.strengths ?? [],
    weaknesses: result.weaknesses ?? [],
    feedback: result.feedback,
    accuracy,
  };
  saveAnalysis(userId, lessonId, { ...entry, focus_seconds: progress.active_seconds });
  setLessonStatus(lessonId, "completed");
  logFeedback(userId, { kind: lesson.origin === "instant" ? "instant" : "lesson", ref_id: lessonId, title: lesson.title, ...entry });
  if (lesson.origin === "instant") awardXp(userId, XP.instantComplete, "즉시 과외 완료");

  applyCurriculumChanges(userId, lesson, result.mastery ?? [], result.curriculum_changes ?? []);

  return getAnalysis(lessonId)!;
}

/**
 * 분석 결과를 커리큘럼에 반영한다.
 * 숙련도는 즉시 갱신하지만, 커리큘럼 구조 변경은 "다음 날 수업부터" 적용된다고 기록한다.
 */
function applyCurriculumChanges(
  userId: string,
  lesson: Lesson,
  mastery: { unit_title: string; mastery: number; done?: boolean }[],
  changes: { action: string; unit_title: string; summary?: string; difficulty?: number; weight?: number; reason: string }[],
) {
  const units = listUnits(userId);
  const log: string[] = [];

  for (const entry of mastery) {
    const unit = units.find((u) => u.title === entry.unit_title) ?? units.find((u) => u.id === lesson.unit_id);
    if (!unit) continue;
    const value = Math.min(100, Math.max(0, Math.round(entry.mastery)));
    updateUnit(userId, unit.id, {
      mastery: value,
      status: entry.done ? "done" : value > 0 ? "learning" : unit.status,
    });
    log.push(`${unit.title} 숙련도 ${unit.mastery}% → ${value}%`);
  }

  for (const change of changes) {
    if (change.action === "add_unit") {
      if (!lesson.goal_id) continue;
      addUnit(userId, lesson.goal_id, {
        title: change.unit_title,
        summary: change.summary ?? change.reason,
        difficulty: clamp(change.difficulty, 1, 5, 3),
        weight: clamp(change.weight, 1, 5, 4),
      });
      log.push(`단원 추가 · ${change.unit_title} (${change.reason})`);
      continue;
    }

    const unit = units.find((u) => u.title === change.unit_title);
    if (!unit) continue;

    if (change.action === "reweight") {
      updateUnit(userId, unit.id, { weight: clamp(change.weight, 1, 5, unit.weight) });
      log.push(`${unit.title} 비중 조정 (${change.reason})`);
    } else if (change.action === "revisit") {
      updateUnit(userId, unit.id, { status: "todo", weight: Math.min(5, unit.weight + 1) });
      log.push(`${unit.title} 다시 학습 (${change.reason})`);
    }
  }

  if (log.length) {
    recordRevision(userId, {
      goalId: lesson.goal_id,
      reason: `${lesson.title} 수업 분석 결과`,
      changes: log,
      effectiveFrom: analysisEffectiveFrom(),
    });
  }
}

function findQuestion(material: ReturnType<typeof getMaterial>, questionId: string) {
  return (
    material.quiz.find((q) => q.id === questionId)?.question ??
    material.exam.find((e) => e.id === questionId)?.question ??
    questionId
  );
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export { listGoals };
