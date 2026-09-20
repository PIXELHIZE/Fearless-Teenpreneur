"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import { db, now, uid } from "@/lib/server/db";
import {
  getAnalysis,
  getLesson,
  getMaterial,
  getProgress,
  listAnswers,
  listGoals,
  saveAnswer,
  saveProgress,
  setLessonStatus,
} from "@/lib/server/repo";
import { ensureMaterial } from "@/lib/server/pipeline";
import { askForText } from "@/lib/server/ai";
import { addChat, listChat } from "@/lib/server/repo";
import { aiEnabled } from "@/lib/server/ai";
import { isPast } from "@/lib/server/policy";
import { awardXp, XP } from "@/lib/server/xp";
import { startInstantLesson } from "@/lib/server/agent/instant";
import type { LessonProgress, LessonStage, Material } from "@/lib/types";

export interface LessonView {
  id: string;
  title: string;
  date: string;
  startMin: number;
  endMin: number;
  minutes: number;
  goalTitle: string;
  status: string;
  /** 수업 시간 안이라 지금 참여할 수 있는지 */
  open: boolean;
  material: Material;
  progress: LessonProgress;
  answers: { question_id: string; given: string; is_correct: number; score: number; comment: string; kind: string }[];
  analysis: ReturnType<typeof getAnalysis>;
  noteId: string | null;
}

export async function openLesson(lessonId: string): Promise<LessonView | null> {
  const user = await requireUser();
  const lesson = getLesson(user.id, lessonId);
  if (!lesson) return null;

  const material = await ensureMaterial(user.id, lessonId);
  const finished = isPast(lesson.date, lesson.end_min);

  // 시간 안이면 참여를 기록한다. (중간에 나갔다 들어와도 이어진다)
  let progress = getProgress(lessonId);
  if (!finished) {
    progress = saveProgress(user.id, lessonId, {
      entered_at: progress.entered_at ?? now(),
      last_seen_at: now(),
    });
    if (lesson.status === "scheduled") setLessonStatus(lessonId, "in_progress");
  }

  return {
    id: lesson.id,
    title: lesson.title,
    date: lesson.date,
    startMin: lesson.start_min,
    endMin: lesson.end_min,
    minutes: lesson.end_min - lesson.start_min,
    goalTitle: listGoals(user.id).find((goal) => goal.id === lesson.goal_id)?.title ?? "",
    status: lesson.status,
    open: !finished,
    material,
    progress,
    answers: listAnswers(lessonId),
    analysis: getAnalysis(lessonId),
    noteId: findNoteId(user.id, lessonId),
  };
}

/** 수업 중 심장박동. 실제로 화면에 머문 시간만 쌓는다. */
export async function heartbeat(lessonId: string, seconds: number, patch: Partial<LessonProgress>) {
  const user = await requireUser();
  const current = getProgress(lessonId);
  saveProgress(user.id, lessonId, {
    ...patch,
    active_seconds: current.active_seconds + Math.max(0, Math.min(90, Math.round(seconds))),
    last_seen_at: now(),
  });
}

export async function setStage(lessonId: string, stage: LessonStage) {
  const user = await requireUser();
  saveProgress(user.id, lessonId, { stage, last_seen_at: now() });
}

export async function answerQuiz(
  lessonId: string,
  questionId: string,
  given: string,
): Promise<{ correct: boolean; answer: string; explain: string }> {
  const user = await requireUser();
  const material = getMaterial(lessonId);
  const question = material.quiz.find((item) => item.id === questionId);
  if (!question) return { correct: false, answer: "", explain: "" };

  const correct = normalize(given) === normalize(question.answer);
  const already = listAnswers(lessonId, "quiz").some((a) => a.question_id === questionId);
  if (correct && !already) awardXp(user.id, XP.quizCorrect, "퀴즈 정답");
  saveAnswer(user.id, lessonId, {
    kind: "quiz",
    question_id: questionId,
    given,
    correct: question.answer,
    is_correct: correct,
    score: correct ? 1 : 0,
  });

  return { correct, answer: question.answer, explain: question.explain };
}

export interface LessonReport {
  accuracy: number;
  correct: number;
  total: number;
  minutes: number;
  slidesRead: number;
  slidesTotal: number;
  examScore: number;
  examTotal: number;
  streakBonus: number;
  grade: string;
  headline: string;
}

export async function finishLesson(lessonId: string): Promise<LessonReport> {
  const user = await requireUser();
  const material = getMaterial(lessonId);
  const before = getProgress(lessonId);
  if (!before.completed_at) awardXp(user.id, XP.lessonComplete, "수업 완료");
  const progress = saveProgress(user.id, lessonId, { stage: "report", completed_at: before.completed_at ?? now() });
  setLessonStatus(lessonId, "completed");
  const answers = listAnswers(lessonId);

  const quiz = answers.filter((a) => a.kind === "quiz");
  const exam = answers.filter((a) => a.kind === "exam");
  const correct = quiz.filter((a) => a.is_correct).length;
  const total = quiz.length || material.quiz.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  const examScore = exam.reduce((sum, a) => sum + a.score, 0);
  const examTotal = material.exam.reduce((sum, item) => sum + item.points, 0);
  const minutes = Math.round(progress.active_seconds / 60);

  revalidatePath("/home");
  revalidatePath("/lessons");

  return {
    accuracy,
    correct,
    total,
    minutes,
    slidesRead: Math.min(progress.slide_index + 1, material.slides.length),
    slidesTotal: material.slides.length,
    examScore,
    examTotal,
    streakBonus: minutes >= 20 ? 1 : 0,
    grade: grade(accuracy),
    headline: headline(accuracy, minutes),
  };
}

/** 즉시 과외 — 지금부터 n분. 자료를 만들어 두고 수업 id 를 돌려준다. */
export async function startInstantAction(input: { minutes: number; topic?: string }): Promise<{ ok: boolean; lessonId?: string; error?: string }> {
  const user = await requireUser();
  try {
    const lesson = await startInstantLesson(user.id, input);
    revalidatePath("/home");
    revalidatePath("/lessons");
    return { ok: true, lessonId: lesson.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "지금은 과외를 시작할 수 없어요." };
  }
}

/** 수업 중 슬라이드를 보다가 바로 묻는 질문 */
export async function askDuringLesson(lessonId: string, question: string): Promise<string> {
  const user = await requireUser();
  const lesson = getLesson(user.id, lessonId);
  if (!lesson) return "수업을 찾을 수 없어요.";

  addChat(user.id, { scope: "lesson", lessonId, role: "user", content: question });

  if (!aiEnabled()) {
    const reply = "지금은 AI 연결이 꺼져 있어요.";
    addChat(user.id, { scope: "lesson", lessonId, role: "assistant", content: reply });
    return reply;
  }

  const material = getMaterial(lessonId);
  const progress = getProgress(lessonId);
  const slide = material.slides[Math.min(progress.slide_index, material.slides.length - 1)];

  try {
    const answer = await askForText({
      system: `당신은 지금 수업을 진행 중인 과외 선생님입니다.
학생이 보고 있는 슬라이드에 대해 묻습니다. 그 맥락 안에서 짧고 분명하게 답하세요.
- 한국어로 3문장 이내.
- 아직 배우지 않은 내용으로 건너뛰지 않습니다.
- 모르면 모른다고 하고, 무엇을 더 알려 주면 되는지 되묻습니다.`,
      messages: [
        {
          role: "user",
          content: [
            `수업: ${lesson.title}`,
            slide ? `지금 슬라이드: ${slide.title}\n${slide.body}` : "",
            "",
            `학생 질문: ${question}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      maxTokens: 800,
    });
    addChat(user.id, { scope: "lesson", lessonId, role: "assistant", content: answer });
    return answer;
  } catch {
    const reply = "답을 만들지 못했어요. 다시 물어봐 주세요.";
    addChat(user.id, { scope: "lesson", lessonId, role: "assistant", content: reply });
    return reply;
  }
}

export async function loadLessonChat(lessonId: string) {
  const user = await requireUser();
  return listChat(user.id, "lesson", 30).filter(() => true);
}

/** 시험지를 풀 노트를 만들거나 이미 만든 노트를 찾는다. */
export async function openExamNote(lessonId: string): Promise<string> {
  const user = await requireUser();
  const existing = findNoteId(user.id, lessonId);
  if (existing) return existing;

  const lesson = getLesson(user.id, lessonId);
  const material = getMaterial(lessonId);
  const id = uid("n_");
  db.prepare(
    `INSERT INTO notes (id, user_id, lesson_id, title, kind, paper, exam_json, pins_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'exam', 'plain', ?, '[]', ?, ?)`,
  ).run(id, user.id, lessonId, `${lesson?.title ?? "수업"} 시험지`, JSON.stringify(material.exam), now(), now());
  return id;
}

function findNoteId(userId: string, lessonId: string): string | null {
  const row = db.prepare(`SELECT id FROM notes WHERE user_id = ? AND lesson_id = ?`).get(userId, lessonId) as
    | { id: string }
    | undefined;
  return row?.id ?? null;
}

function normalize(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

function grade(accuracy: number) {
  if (accuracy >= 95) return "S";
  if (accuracy >= 85) return "A";
  if (accuracy >= 70) return "B";
  if (accuracy >= 50) return "C";
  return "D";
}

function headline(accuracy: number, minutes: number) {
  if (accuracy >= 90) return "거의 다 맞았어요";
  if (accuracy >= 70) return "잘 따라왔어요";
  if (minutes >= 20) return "끝까지 앉아 있었어요";
  return "오늘도 한 걸음";
}
