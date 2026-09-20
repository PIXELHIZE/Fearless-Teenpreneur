"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/server/auth";
import { db, now, uid } from "@/lib/server/db";
import { aiEnabled, askForJson } from "@/lib/server/ai";
import { AI_PEN_SYSTEM, AI_PEN_TOOL_SCHEMA, type AiPenResult } from "@/lib/note/ai-pen";
import { getLesson, getMaterial, saveAnswer } from "@/lib/server/repo";
import { awardXp, logFeedback, XP } from "@/lib/server/xp";
import { createCustomExam, type ExamStyle } from "@/lib/server/agent/exam";
import type { ExamItem } from "@/lib/types";

export interface NoteRow {
  id: string;
  lesson_id: string | null;
  title: string;
  kind: string;
  paper: string;
  topic: string;
  exam: ExamItem[];
  pins: unknown[];
  result: SubmitResult | null;
  submitted_at: number | null;
  created_at: number;
  updated_at: number;
}

export async function listNotes(): Promise<NoteRow[]> {
  const user = await requireUser();
  const rows = db
    .prepare(`SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(user.id) as Record<string, string | number | null>[];
  return rows.map(toNote);
}

export async function getNote(noteId: string): Promise<NoteRow | null> {
  const user = await requireUser();
  const row = db.prepare(`SELECT * FROM notes WHERE id = ? AND user_id = ?`).get(noteId, user.id) as
    | Record<string, string | number | null>
    | undefined;
  return row ? toNote(row) : null;
}

export async function createBlankNote(title: string, paper: string): Promise<string> {
  const user = await requireUser();
  const id = uid("n_");
  db.prepare(
    `INSERT INTO notes (id, user_id, lesson_id, title, kind, paper, exam_json, pins_json, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'blank', ?, '[]', '[]', ?, ?)`,
  ).run(id, user.id, title.trim() || "제목 없는 노트", paper, now(), now());
  revalidatePath("/note");
  return id;
}

/** 맞춤 시험지 — 주제·문항 수·유형으로 모의고사형 시험지를 만들어 노트로 연다. */
export async function createCustomExamAction(input: {
  topic: string;
  count: number;
  style: ExamStyle;
}): Promise<{ ok: boolean; noteId?: string; error?: string }> {
  const user = await requireUser();
  if (!input.topic.trim()) return { ok: false, error: "주제를 적어 주세요." };
  if (!aiEnabled()) return { ok: false, error: "AI 연결이 꺼져 있어 시험지를 만들 수 없어요." };
  try {
    const { noteId } = await createCustomExam(user.id, { topic: input.topic.trim(), count: input.count, style: input.style });
    revalidatePath("/note");
    return { ok: true, noteId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "시험지를 만들지 못했어요." };
  }
}

export async function renameNote(noteId: string, title: string) {
  const user = await requireUser();
  db.prepare(`UPDATE notes SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?`).run(
    title.trim() || "제목 없는 노트",
    now(),
    noteId,
    user.id,
  );
  revalidatePath("/note");
}

export async function deleteNote(noteId: string) {
  const user = await requireUser();
  db.prepare(`DELETE FROM notes WHERE id = ? AND user_id = ?`).run(noteId, user.id);
  revalidatePath("/note");
}

export async function savePins(noteId: string, pins: unknown[]) {
  const user = await requireUser();
  db.prepare(`UPDATE notes SET pins_json = ?, updated_at = ? WHERE id = ? AND user_id = ?`).run(
    JSON.stringify(pins),
    now(),
    noteId,
    user.id,
  );
}

/** AI 펜 — 올가미로 표시한 이미지를 보고 학습 도움말을 만든다. */
export async function askAiPen(
  image: string,
  mediaType: string,
): Promise<{ result?: AiPenResult; error?: string }> {
  await requireUser();
  if (!aiEnabled()) return { error: "AI 연결이 꺼져 있어요. OPENROUTER_API_KEY 를 설정해 주세요." };

  try {
    const raw = await askForJson<Record<string, unknown>>({
      system: AI_PEN_SYSTEM,
      name: "ai_pen",
      description: "올가미로 표시된 부분에 대한 학습 도움말을 반환한다. 도움이 될 항목은 모두 채운다.",
      schema: AI_PEN_TOOL_SCHEMA,
      maxTokens: 6000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mediaType};base64,${image}` } },
            { type: "text", text: "파란색으로 표시된 영역에 대해 ai_pen 도구를 호출해 주세요." },
          ],
        },
      ],
    });
    return { result: normalize(raw) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "AI 호출에 실패했습니다." };
  }
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
  score?: number;
  total?: number;
  overall?: string;
  strengths?: string[];
  weaknesses?: string[];
  advice?: string;
  items?: { number: number; question: string; read: string; score: number; points: number; correct: boolean; comment: string }[];
}

/**
 * 손으로 푼 시험지를 제출한다.
 * 노트 전체를 한 장의 이미지로 보내고, AI 가 글씨를 읽어 채점 기준대로 채점한다.
 */
export async function submitExam(noteId: string, imageOrImages: string | string[]): Promise<SubmitResult> {
  const images = Array.isArray(imageOrImages) ? imageOrImages : [imageOrImages];
  const user = await requireUser();
  const note = await getNote(noteId);
  if (!note) return { ok: false, error: "노트를 찾을 수 없어요." };
  if (!aiEnabled()) return { ok: false, error: "AI 연결이 꺼져 있어 채점할 수 없어요." };

  const lesson = note.lesson_id ? getLesson(user.id, note.lesson_id) : undefined;
  const material = note.lesson_id ? getMaterial(note.lesson_id) : undefined;
  const exam = material?.exam.length ? material.exam : note.exam;
  if (!exam.length) return { ok: false, error: "채점할 문항이 없어요." };

  try {
    const graded = await askForJson<{
      results: { question_id: string; score: number; correct: boolean; read: string; comment: string }[];
      overall?: string;
      strengths?: string[];
      weaknesses?: string[];
      advice?: string;
    }>({
      system: `당신은 손으로 푼 시험지를 채점하는 선생님입니다.
이미지는 시험지 쪽 순서대로 여러 장이 올 수 있고, 인쇄된 문제 위에 학생이 **펜으로 쓴 답**이 겹쳐 있습니다.

규칙:
- 인쇄 글자와 손글씨를 구분하세요. 손글씨는 굵고 색이 다르며 인쇄 줄과 어긋나 있습니다. 조금이라도 필기가 있으면 "미작성"으로 처리하지 말고 최대한 읽어 냅니다.
- 먼저 학생의 손글씨를 읽어 read 에 그대로 옮겨 적고, 그 다음 채점합니다.
- 5지선다는 ①~⑤ 중 동그라미·체크·밑줄·빗금 등 **표시가 된 번호**를 답으로 읽습니다. 번호 옆 빈 자리에 숫자를 적었을 수도 있습니다. 표시가 여러 개면 마지막에 남긴(지우지 않은) 것을 택합니다.
- 표현이 달라도 뜻이 맞으면 맞은 것으로 봅니다. 글자 그대로 같은지 따지지 않습니다.
- 채점 기준(rubric)에 들어간 요소만큼 부분 점수를 적극적으로 줍니다.
- 빈칸이면 0점이고, 무엇을 썼어야 하는지 한 문장으로 알려 줍니다.
- 글씨를 못 읽겠으면 그렇게 적고 점수는 0으로 둡니다.
- 채점이 끝나면 전체를 보고 잘한 점(strengths), 부족한 점(weaknesses)을 각 1~3개, 다음에 무엇을 공부하면 좋을지(advice)를 학생에게 말하듯 씁니다.
- 설명은 한국어로 짧게 씁니다.`,
      name: "grade_handwritten_exam",
      description: "손으로 푼 시험지를 읽고 채점하고 피드백한다.",
      maxTokens: 9000,
      schema: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question_id: { type: "string" },
                read: { type: "string", description: "손글씨에서 읽어낸 학생의 답" },
                score: { type: "integer" },
                correct: { type: "boolean" },
                comment: { type: "string" },
              },
              required: ["question_id", "read", "score", "correct", "comment"],
            },
          },
          overall: { type: "string", description: "총평 2문장 이내" },
          strengths: { type: "array", items: { type: "string" } },
          weaknesses: { type: "array", items: { type: "string" }, description: "구체적인 개념·유형으로" },
          advice: { type: "string", description: "다음에 공부할 것 2~3문장" },
        },
        required: ["results", "overall"],
      },
      messages: [
        {
          role: "user",
          content: [
            ...images.flatMap((image, index) => [
              { type: "text" as const, text: `[시험지 ${index + 1}/${images.length}쪽]` },
              { type: "image_url" as const, image_url: { url: `data:image/png;base64,${image}` } },
            ]),
            {
              type: "text",
              text: exam
                .map((item) =>
                  [
                    `[${item.id}] ${item.number}번 (${item.points}점, ${item.kind})`,
                    item.passage ? `자료: ${item.passage}` : "",
                    `문제: ${item.question}`,
                    item.choices?.length ? `보기: ${item.choices.map((c, i) => `${i + 1}. ${c}`).join(" / ")}` : "",
                    `모범 답안: ${item.answer}`,
                    `채점 기준: ${item.rubric}`,
                  ]
                    .filter(Boolean)
                    .join("\n"),
                )
                .join("\n\n"),
            },
          ],
        },
      ],
    });

    const items = exam.map((item) => {
      const row = graded.results?.find((r) => r.question_id === item.id);
      const score = Math.min(item.points, Math.max(0, Math.round(Number(row?.score) || 0)));
      if (note.lesson_id) {
        saveAnswer(user.id, note.lesson_id, {
          kind: "exam",
          question_id: item.id,
          given: row?.read ?? "",
          correct: item.answer,
          is_correct: Boolean(row?.correct),
          score,
          comment: row?.comment ?? "",
        });
      }
      return {
        number: item.number,
        question: item.question,
        read: row?.read ?? "",
        score,
        points: item.points,
        correct: Boolean(row?.correct),
        comment: row?.comment ?? "",
      };
    });

    const score = items.reduce((sum, item) => sum + item.score, 0);
    const total = items.reduce((sum, item) => sum + item.points, 0);
    const accuracy = total ? Math.round((score / total) * 100) : 0;
    const result: SubmitResult = {
      ok: true,
      score,
      total,
      overall: graded.overall ?? "채점을 마쳤어요.",
      strengths: graded.strengths ?? [],
      weaknesses: graded.weaknesses ?? [],
      advice: graded.advice ?? "",
      items,
    };

    db.prepare(`UPDATE notes SET submitted_at = ?, updated_at = ?, result_json = ? WHERE id = ?`).run(now(), now(), JSON.stringify(result), noteId);

    if (!note.lesson_id) {
      db.prepare(`INSERT INTO exam_results (id, user_id, note_id, score, total, overall, items_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        uid("er_"), user.id, noteId, score, total, result.overall ?? "", JSON.stringify(items), now(),
      );
    }

    // 피드백은 한 곳에 모아 두고, 다음 자료·커리큘럼 조정이 참고한다.
    logFeedback(user.id, {
      kind: "exam",
      ref_id: noteId,
      title: note.title,
      summary: result.overall ?? "",
      strengths: result.strengths ?? [],
      weaknesses: result.weaknesses ?? [],
      feedback: result.advice ?? "",
      accuracy,
    });
    if (!note.submitted_at) awardXp(user.id, score * XP.examPoint, "시험지 채점");

    revalidatePath("/note");
    revalidatePath("/me");
    if (note.lesson_id) revalidatePath(`/lesson/${note.lesson_id}`);
    void lesson;

    return result;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "채점에 실패했습니다." };
  }
}

function toNote(row: Record<string, string | number | null>): NoteRow {
  return {
    id: String(row.id),
    lesson_id: row.lesson_id ? String(row.lesson_id) : null,
    title: String(row.title),
    kind: String(row.kind),
    paper: String(row.paper),
    topic: String(row.topic ?? ""),
    exam: parseList<ExamItem>(String(row.exam_json ?? "[]")),
    pins: parseList(String(row.pins_json ?? "[]")),
    result: parseResult(String(row.result_json ?? "")),
    submitted_at: row.submitted_at ? Number(row.submitted_at) : null,
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

function parseResult(raw: string): SubmitResult | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SubmitResult;
  } catch {
    return null;
  }
}

function parseList<T>(raw: string): T[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalize(input: Record<string, unknown>): AiPenResult {
  const result: AiPenResult = {
    detected: typeof input.detected === "string" ? input.detected : "",
    subject: typeof input.subject === "string" ? input.subject : undefined,
  };

  const meaning = input.meaning as AiPenResult["meaning"];
  if (meaning?.entries?.length) result.meaning = { entries: meaning.entries.filter((e) => e?.definition) };

  const summary = input.summary as AiPenResult["summary"];
  if (summary?.one_line) result.summary = summary;

  const concept = input.concept as AiPenResult["concept"];
  if (concept?.items?.length) result.concept = { ...concept, items: concept.items.filter((i) => i?.name) };

  const check = input.check as AiPenResult["check"];
  if (check?.verdict) result.check = check;

  const hint = input.hint as AiPenResult["hint"];
  if (hint?.steps?.length) result.hint = { steps: hint.steps.filter(Boolean) };

  const solution = input.solution as AiPenResult["solution"];
  if (solution?.steps?.length) result.solution = { ...solution, steps: solution.steps.filter((s) => s?.detail) };

  return result;
}
