import "server-only";
import { db, now, uid } from "./db";
import { absoluteMinutes, nowMinutes, todayStr } from "@/lib/time";
import type {
  Analysis,
  AnswerRow,
  AvailabilitySlot,
  BusyEvent,
  ChatEntry,
  Goal,
  Lesson,
  LessonProgress,
  Material,
  Unit,
} from "@/lib/types";

// ── 목표 ────────────────────────────────────────────────────────────────

export function listGoals(userId: string): Goal[] {
  return db
    .prepare(`SELECT * FROM goals WHERE user_id = ? AND status = 'active' ORDER BY created_at`)
    .all(userId) as Goal[];
}

export function createGoal(userId: string, goal: Omit<Goal, "id" | "status" | "created_at">): Goal {
  const id = uid("g_");
  db.prepare(
    `INSERT INTO goals (id, user_id, title, subject, detail, level, target_date, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
  ).run(id, userId, goal.title, goal.subject, goal.detail, goal.level, goal.target_date, now());
  return db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id) as Goal;
}

export function archiveGoal(userId: string, goalId: string) {
  db.prepare(`UPDATE goals SET status = 'archived' WHERE id = ? AND user_id = ?`).run(goalId, userId);
}

// ── 커리큘럼 ────────────────────────────────────────────────────────────

export function listUnits(userId: string, goalId?: string): Unit[] {
  const sql = goalId
    ? `SELECT * FROM units WHERE user_id = ? AND goal_id = ? ORDER BY order_index`
    : `SELECT * FROM units WHERE user_id = ? ORDER BY order_index`;
  return (goalId ? db.prepare(sql).all(userId, goalId) : db.prepare(sql).all(userId)) as Unit[];
}

export function replaceUnits(
  userId: string,
  goalId: string,
  units: { title: string; summary: string; difficulty: number; weight: number }[],
) {
  const remove = db.prepare(`DELETE FROM units WHERE user_id = ? AND goal_id = ?`);
  const insert = db.prepare(
    `INSERT INTO units (id, user_id, goal_id, title, summary, difficulty, weight, mastery, order_index, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'todo', ?)`,
  );
  db.transaction(() => {
    remove.run(userId, goalId);
    units.forEach((unit, index) => {
      insert.run(uid("un_"), userId, goalId, unit.title, unit.summary, unit.difficulty, unit.weight, index, now());
    });
  })();
}

export function updateUnit(userId: string, unitId: string, patch: Partial<Unit>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ["title", "summary", "difficulty", "weight", "mastery", "order_index", "status"] as const) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(patch[key]);
    }
  }
  if (!fields.length) return;
  values.push(unitId, userId);
  db.prepare(`UPDATE units SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`).run(...values);
}

export function addUnit(
  userId: string,
  goalId: string,
  unit: { title: string; summary: string; difficulty: number; weight: number },
) {
  const max = db
    .prepare(`SELECT COALESCE(MAX(order_index), -1) AS m FROM units WHERE user_id = ? AND goal_id = ?`)
    .get(userId, goalId) as { m: number };
  db.prepare(
    `INSERT INTO units (id, user_id, goal_id, title, summary, difficulty, weight, mastery, order_index, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'todo', ?)`,
  ).run(uid("un_"), userId, goalId, unit.title, unit.summary, unit.difficulty, unit.weight, max.m + 1, now());
}

export function recordRevision(
  userId: string,
  input: { goalId: string | null; reason: string; changes: string[]; effectiveFrom: string },
) {
  db.prepare(
    `INSERT INTO curriculum_revisions (id, user_id, goal_id, reason, changes_json, effective_from, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(uid("rev_"), userId, input.goalId, input.reason, JSON.stringify(input.changes), input.effectiveFrom, now());
}

export function listRevisions(userId: string, limit = 12) {
  return db
    .prepare(`SELECT * FROM curriculum_revisions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(userId, limit) as {
    id: string;
    goal_id: string | null;
    reason: string;
    changes_json: string;
    effective_from: string;
    created_at: number;
  }[];
}

// ── 공부 가능 시간 · 개인 일정 ──────────────────────────────────────────

export function listAvailability(userId: string): AvailabilitySlot[] {
  return db.prepare(`SELECT * FROM availability WHERE user_id = ?`).all(userId) as AvailabilitySlot[];
}

export function addAvailability(userId: string, slot: Omit<AvailabilitySlot, "id">) {
  const id = uid("av_");
  db.prepare(
    `INSERT INTO availability (id, user_id, kind, weekday, date, start_min, end_min) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, slot.kind, slot.weekday, slot.date, slot.start_min, slot.end_min);
  return id;
}

export function removeAvailability(userId: string, id: string) {
  db.prepare(`DELETE FROM availability WHERE id = ? AND user_id = ?`).run(id, userId);
}

export function listBusy(userId: string): BusyEvent[] {
  return db.prepare(`SELECT * FROM busy_events WHERE user_id = ?`).all(userId) as BusyEvent[];
}

export function addBusy(userId: string, event: Omit<BusyEvent, "id">) {
  const id = uid("bz_");
  db.prepare(
    `INSERT INTO busy_events (id, user_id, title, kind, weekday, date, start_min, end_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, event.title, event.kind, event.weekday, event.date, event.start_min, event.end_min);
  return id;
}

export function removeBusy(userId: string, id: string) {
  db.prepare(`DELETE FROM busy_events WHERE id = ? AND user_id = ?`).run(id, userId);
}

// ── 수업 ────────────────────────────────────────────────────────────────

export function listLessons(userId: string, from?: string, to?: string): Lesson[] {
  if (from && to) {
    return db
      .prepare(`SELECT * FROM lessons WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, start_min`)
      .all(userId, from, to) as Lesson[];
  }
  return db.prepare(`SELECT * FROM lessons WHERE user_id = ? ORDER BY date, start_min`).all(userId) as Lesson[];
}

export function getLesson(userId: string, lessonId: string): Lesson | undefined {
  return db.prepare(`SELECT * FROM lessons WHERE id = ? AND user_id = ?`).get(lessonId, userId) as Lesson | undefined;
}

export function createLesson(userId: string, lesson: Omit<Lesson, "id">): Lesson {
  const id = uid("l_");
  db.prepare(
    `INSERT INTO lessons (id, user_id, goal_id, unit_id, series_id, title, date, start_min, end_min, status, origin, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    userId,
    lesson.goal_id,
    lesson.unit_id,
    lesson.series_id,
    lesson.title,
    lesson.date,
    lesson.start_min,
    lesson.end_min,
    lesson.status,
    lesson.origin,
    now(),
  );
  db.prepare(`INSERT OR IGNORE INTO materials (id, lesson_id, status) VALUES (?, ?, 'pending')`).run(uid("m_"), id);
  return getLesson(userId, id)!;
}

export function deleteLesson(userId: string, lessonId: string) {
  db.prepare(`DELETE FROM lessons WHERE id = ? AND user_id = ?`).run(lessonId, userId);
}

export function deleteSeries(userId: string, seriesId: string, fromDate: string) {
  db.prepare(`DELETE FROM lessons WHERE user_id = ? AND series_id = ? AND date >= ?`).run(userId, seriesId, fromDate);
}

export function setLessonStatus(lessonId: string, status: Lesson["status"]) {
  db.prepare(`UPDATE lessons SET status = ? WHERE id = ?`).run(status, lessonId);
}

/** 현재 시각 기준 이후 수업(진행 중 포함)을 이른 순서로 */
export function upcomingLessons(userId: string, limit = 10): Lesson[] {
  const today = todayStr();
  const minutes = nowMinutes();
  return (
    db
      .prepare(`SELECT * FROM lessons WHERE user_id = ? AND date >= ? ORDER BY date, start_min`)
      .all(userId, today) as Lesson[]
  )
    .filter((lesson) => lesson.date > today || lesson.end_min > minutes)
    .slice(0, limit);
}

/** 이미 끝났지만 아직 분석하지 않은 수업 */
export function lessonsNeedingAnalysis(userId: string): Lesson[] {
  const today = todayStr();
  const minutes = nowMinutes();
  const rows = db
    .prepare(
      `SELECT l.* FROM lessons l
       LEFT JOIN analyses a ON a.lesson_id = l.id
       WHERE l.user_id = ? AND a.id IS NULL AND l.date <= ?`,
    )
    .all(userId, today) as Lesson[];
  return rows.filter((lesson) => lesson.date < today || lesson.end_min <= minutes);
}

// ── 자료 ────────────────────────────────────────────────────────────────

export function getMaterial(lessonId: string): Material {
  const row = db.prepare(`SELECT * FROM materials WHERE lesson_id = ?`).get(lessonId) as
    | {
        status: Material["status"];
        slides_json: string;
        quiz_json: string;
        exam_json: string;
        note: string;
        error: string;
        generated_at: number | null;
      }
    | undefined;
  if (!row) return { status: "pending", slides: [], quiz: [], exam: [], note: "", error: "", generated_at: null };
  return {
    status: row.status,
    slides: safeParse(row.slides_json),
    quiz: safeParse(row.quiz_json),
    exam: safeParse(row.exam_json),
    note: row.note,
    error: row.error,
    generated_at: row.generated_at,
  };
}

export function saveMaterial(lessonId: string, material: Partial<Material>) {
  db.prepare(`INSERT OR IGNORE INTO materials (id, lesson_id, status) VALUES (?, ?, 'pending')`).run(
    uid("m_"),
    lessonId,
  );
  db.prepare(
    `UPDATE materials SET status = ?, slides_json = ?, quiz_json = ?, exam_json = ?, note = ?, error = ?, generated_at = ?
     WHERE lesson_id = ?`,
  ).run(
    material.status ?? "ready",
    JSON.stringify(material.slides ?? []),
    JSON.stringify(material.quiz ?? []),
    JSON.stringify(material.exam ?? []),
    material.note ?? "",
    material.error ?? "",
    material.generated_at ?? now(),
    lessonId,
  );
}

export function markMaterialFailed(lessonId: string, error: string) {
  db.prepare(`INSERT OR IGNORE INTO materials (id, lesson_id, status) VALUES (?, ?, 'pending')`).run(
    uid("m_"),
    lessonId,
  );
  db.prepare(`UPDATE materials SET status = 'failed', error = ? WHERE lesson_id = ?`).run(error, lessonId);
}

// ── 진행 상태 ───────────────────────────────────────────────────────────

export function getProgress(lessonId: string): LessonProgress {
  const row = db.prepare(`SELECT * FROM lesson_progress WHERE lesson_id = ?`).get(lessonId) as
    | LessonProgress
    | undefined;
  return (
    row ?? {
      stage: "slides",
      slide_index: 0,
      quiz_index: 0,
      active_seconds: 0,
      entered_at: null,
      last_seen_at: null,
      completed_at: null,
    }
  );
}

export function saveProgress(userId: string, lessonId: string, patch: Partial<LessonProgress>) {
  const current = getProgress(lessonId);
  const next = { ...current, ...patch };
  db.prepare(
    `INSERT INTO lesson_progress (lesson_id, user_id, stage, slide_index, quiz_index, active_seconds, entered_at, last_seen_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(lesson_id) DO UPDATE SET
       stage = excluded.stage, slide_index = excluded.slide_index, quiz_index = excluded.quiz_index,
       active_seconds = excluded.active_seconds, entered_at = excluded.entered_at,
       last_seen_at = excluded.last_seen_at, completed_at = excluded.completed_at`,
  ).run(
    lessonId,
    userId,
    next.stage,
    next.slide_index,
    next.quiz_index,
    next.active_seconds,
    next.entered_at,
    next.last_seen_at,
    next.completed_at,
  );
  return next;
}

// ── 답안 ────────────────────────────────────────────────────────────────

export function saveAnswer(
  userId: string,
  lessonId: string,
  answer: { kind: string; question_id: string; given: string; correct: string; is_correct: boolean; score?: number; comment?: string },
) {
  db.prepare(
    `INSERT INTO answers (id, lesson_id, user_id, kind, question_id, given, correct, is_correct, score, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(lesson_id, kind, question_id) DO UPDATE SET
       given = excluded.given, correct = excluded.correct, is_correct = excluded.is_correct,
       score = excluded.score, comment = excluded.comment`,
  ).run(
    uid("a_"),
    lessonId,
    userId,
    answer.kind,
    answer.question_id,
    answer.given,
    answer.correct,
    answer.is_correct ? 1 : 0,
    answer.score ?? 0,
    answer.comment ?? "",
    now(),
  );
}

export function listAnswers(lessonId: string, kind?: string): AnswerRow[] {
  return (
    kind
      ? db.prepare(`SELECT * FROM answers WHERE lesson_id = ? AND kind = ?`).all(lessonId, kind)
      : db.prepare(`SELECT * FROM answers WHERE lesson_id = ?`).all(lessonId)
  ) as AnswerRow[];
}

// ── 분석 ────────────────────────────────────────────────────────────────

export function getAnalysis(lessonId: string): Analysis | undefined {
  const row = db.prepare(`SELECT * FROM analyses WHERE lesson_id = ?`).get(lessonId) as
    | (Omit<Analysis, "strengths" | "weaknesses"> & { strengths: string; weaknesses: string })
    | undefined;
  if (!row) return undefined;
  return { ...row, strengths: safeParse(row.strengths), weaknesses: safeParse(row.weaknesses) };
}

export function saveAnalysis(userId: string, lessonId: string, analysis: Omit<Analysis, "created_at">) {
  db.prepare(
    `INSERT INTO analyses (id, user_id, lesson_id, summary, strengths, weaknesses, feedback, accuracy, focus_seconds, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(lesson_id) DO UPDATE SET
       summary = excluded.summary, strengths = excluded.strengths, weaknesses = excluded.weaknesses,
       feedback = excluded.feedback, accuracy = excluded.accuracy, focus_seconds = excluded.focus_seconds`,
  ).run(
    uid("an_"),
    userId,
    lessonId,
    analysis.summary,
    JSON.stringify(analysis.strengths),
    JSON.stringify(analysis.weaknesses),
    analysis.feedback,
    analysis.accuracy,
    analysis.focus_seconds,
    now(),
  );
}

export function recentAnalyses(userId: string, limit = 5) {
  return db
    .prepare(`SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(userId, limit) as (Omit<Analysis, "strengths" | "weaknesses"> & {
    lesson_id: string;
    strengths: string;
    weaknesses: string;
  })[];
}

// ── 대화 ────────────────────────────────────────────────────────────────

export function listChat(userId: string, scope = "agent", limit = 40): ChatEntry[] {
  const rows = db
    .prepare(`SELECT * FROM chat_messages WHERE user_id = ? AND scope = ? ORDER BY created_at DESC LIMIT ?`)
    .all(userId, scope, limit) as { id: string; role: ChatEntry["role"]; content: string; actions: string; created_at: number }[];
  return rows.reverse().map((row) => ({ ...row, actions: safeParse(row.actions) }));
}

export function addChat(userId: string, entry: { scope?: string; lessonId?: string | null; role: string; content: string; actions?: string[] }) {
  const id = uid("c_");
  db.prepare(
    `INSERT INTO chat_messages (id, user_id, scope, lesson_id, role, content, actions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, entry.scope ?? "agent", entry.lessonId ?? null, entry.role, entry.content, JSON.stringify(entry.actions ?? []), now());
  return id;
}

// ── 잠금 ────────────────────────────────────────────────────────────────

/** 같은 작업이 동시에 두 번 돌지 않게 막는다. 얻으면 true. */
export function acquireLock(key: string): boolean {
  try {
    db.prepare(`INSERT INTO job_locks (key, status, created_at) VALUES (?, 'running', ?)`).run(key, now());
    return true;
  } catch {
    // 30분 넘게 잡혀 있으면 죽은 잠금으로 보고 회수한다.
    const row = db.prepare(`SELECT created_at FROM job_locks WHERE key = ?`).get(key) as { created_at: number } | undefined;
    if (row && now() - row.created_at > 30 * 60_000) {
      db.prepare(`UPDATE job_locks SET created_at = ? WHERE key = ?`).run(now(), key);
      return true;
    }
    return false;
  }
}

export function releaseLock(key: string) {
  db.prepare(`DELETE FROM job_locks WHERE key = ?`).run(key);
}

function safeParse<T>(raw: string): T[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export { absoluteMinutes };
