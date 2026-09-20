import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const file = process.env.TEUM_DB ?? join(process.cwd(), "data", "teum.db");
mkdirSync(dirname(file), { recursive: true });

/**
 * 개발 중 HMR 로 모듈이 다시 평가돼도 연결이 늘어나지 않도록 전역에 붙인다.
 */
const globalForDb = globalThis as unknown as { __teumDb?: Database.Database };

export const db = globalForDb.__teumDb ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalForDb.__teumDb = db;

function createDatabase() {
  const instance = new Database(file);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  migrate(instance);
  return instance;
}

function migrate(instance: Database.Database) {
  instance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      name          TEXT NOT NULL DEFAULT '',
      gender        TEXT NOT NULL DEFAULT '',
      birth_year    INTEGER,
      created_at    INTEGER NOT NULL,
      onboarded_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    -- 목표. 여러 개를 동시에 가질 수 있다.
    CREATE TABLE IF NOT EXISTS goals (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      subject     TEXT NOT NULL DEFAULT '',
      detail      TEXT NOT NULL DEFAULT '',
      level       TEXT NOT NULL DEFAULT '',
      target_date TEXT,
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  INTEGER NOT NULL
    );

    -- 공부 가능 시간. weekly 는 요일 반복, date 는 특정 날짜.
    CREATE TABLE IF NOT EXISTS availability (
      id        TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind      TEXT NOT NULL,
      weekday   INTEGER,
      date      TEXT,
      start_min INTEGER NOT NULL,
      end_min   INTEGER NOT NULL
    );

    -- 개인 일정. 이 시간에는 수업을 넣지 않는다.
    CREATE TABLE IF NOT EXISTS busy_events (
      id        TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title     TEXT NOT NULL,
      kind      TEXT NOT NULL DEFAULT 'date',
      weekday   INTEGER,
      date      TEXT,
      start_min INTEGER NOT NULL,
      end_min   INTEGER NOT NULL
    );

    -- 커리큘럼 단원. mastery 0~100 으로 숙련도를 추적한다.
    CREATE TABLE IF NOT EXISTS units (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal_id     TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      summary     TEXT NOT NULL DEFAULT '',
      difficulty  INTEGER NOT NULL DEFAULT 3,
      weight      INTEGER NOT NULL DEFAULT 3,
      mastery     INTEGER NOT NULL DEFAULT 0,
      order_index INTEGER NOT NULL DEFAULT 0,
      status      TEXT NOT NULL DEFAULT 'todo',
      created_at  INTEGER NOT NULL
    );

    -- 커리큘럼이 언제, 왜 바뀌었는지 남긴다. effective_from 이후 수업부터 반영된다.
    CREATE TABLE IF NOT EXISTS curriculum_revisions (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal_id        TEXT,
      reason         TEXT NOT NULL DEFAULT '',
      changes_json   TEXT NOT NULL DEFAULT '[]',
      effective_from TEXT NOT NULL,
      created_at     INTEGER NOT NULL
    );

    -- 반복 수업 묶음
    CREATE TABLE IF NOT EXISTS lesson_series (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      goal_id    TEXT,
      weekdays   TEXT NOT NULL DEFAULT '[]',
      start_min  INTEGER NOT NULL,
      end_min    INTEGER NOT NULL,
      from_date  TEXT NOT NULL,
      until_date TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal_id    TEXT,
      unit_id    TEXT,
      series_id  TEXT,
      title      TEXT NOT NULL,
      date       TEXT NOT NULL,
      start_min  INTEGER NOT NULL,
      end_min    INTEGER NOT NULL,
      status     TEXT NOT NULL DEFAULT 'scheduled',
      origin     TEXT NOT NULL DEFAULT 'agent',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lessons_user_date ON lessons(user_id, date);

    -- 수업 전에 미리 만들어 두는 자료
    CREATE TABLE IF NOT EXISTS materials (
      id           TEXT PRIMARY KEY,
      lesson_id    TEXT NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'pending',
      slides_json  TEXT NOT NULL DEFAULT '[]',
      quiz_json    TEXT NOT NULL DEFAULT '[]',
      exam_json    TEXT NOT NULL DEFAULT '[]',
      note         TEXT NOT NULL DEFAULT '',
      error        TEXT NOT NULL DEFAULT '',
      generated_at INTEGER
    );

    -- 수업 참여 상태. 중간에 나가도 이어서 들어올 수 있게 진행 위치를 남긴다.
    CREATE TABLE IF NOT EXISTS lesson_progress (
      lesson_id      TEXT PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
      user_id        TEXT NOT NULL,
      stage          TEXT NOT NULL DEFAULT 'slides',
      slide_index    INTEGER NOT NULL DEFAULT 0,
      quiz_index     INTEGER NOT NULL DEFAULT 0,
      active_seconds INTEGER NOT NULL DEFAULT 0,
      entered_at     INTEGER,
      last_seen_at   INTEGER,
      completed_at   INTEGER
    );

    CREATE TABLE IF NOT EXISTS answers (
      id          TEXT PRIMARY KEY,
      lesson_id   TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL,
      kind        TEXT NOT NULL,
      question_id TEXT NOT NULL,
      given       TEXT NOT NULL DEFAULT '',
      correct     TEXT NOT NULL DEFAULT '',
      is_correct  INTEGER NOT NULL DEFAULT 0,
      score       INTEGER NOT NULL DEFAULT 0,
      comment     TEXT NOT NULL DEFAULT '',
      created_at  INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_unique ON answers(lesson_id, kind, question_id);

    -- 수업이 끝난 뒤 만들어지는 분석. 커리큘럼 조정의 근거가 된다.
    CREATE TABLE IF NOT EXISTS analyses (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id     TEXT NOT NULL UNIQUE,
      summary       TEXT NOT NULL DEFAULT '',
      strengths     TEXT NOT NULL DEFAULT '[]',
      weaknesses    TEXT NOT NULL DEFAULT '[]',
      feedback      TEXT NOT NULL DEFAULT '',
      accuracy      INTEGER NOT NULL DEFAULT 0,
      focus_seconds INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scope      TEXT NOT NULL DEFAULT 'agent',
      lesson_id  TEXT,
      role       TEXT NOT NULL,
      content    TEXT NOT NULL,
      actions    TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id  TEXT,
      title      TEXT NOT NULL,
      kind       TEXT NOT NULL DEFAULT 'blank',
      paper      TEXT NOT NULL DEFAULT 'plain',
      exam_json  TEXT NOT NULL DEFAULT '[]',
      pins_json  TEXT NOT NULL DEFAULT '[]',
      submitted_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 홈에서 자유롭게 푸는 기초 학습 기록
    CREATE TABLE IF NOT EXISTS drill_results (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal_id    TEXT,
      kind       TEXT NOT NULL,
      score      INTEGER NOT NULL DEFAULT 0,
      total      INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- 홈 기초 학습에 쓰는, 목표에 맞춰 생성된 문항 묶음
    CREATE TABLE IF NOT EXISTS drill_sets (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal_id    TEXT,
      kind       TEXT NOT NULL,
      items_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );

    -- 같은 작업이 두 번 돌지 않게 막는 잠금
    CREATE TABLE IF NOT EXISTS job_locks (
      key        TEXT PRIMARY KEY,
      status     TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- 경험치. 퀴즈·수업·시험지·기초학습에서 쌓인다.
    CREATE TABLE IF NOT EXISTS xp_events (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount     INTEGER NOT NULL,
      reason     TEXT NOT NULL,
      day        TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_xp_user_day ON xp_events(user_id, day);

    -- 모든 피드백을 한 곳에. 수업 분석·시험지 채점·즉시 과외가 여기 쌓인다.
    CREATE TABLE IF NOT EXISTS feedback_log (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,
      ref_id     TEXT,
      title      TEXT NOT NULL,
      summary    TEXT NOT NULL DEFAULT '',
      strengths  TEXT NOT NULL DEFAULT '[]',
      weaknesses TEXT NOT NULL DEFAULT '[]',
      feedback   TEXT NOT NULL DEFAULT '',
      accuracy   INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_log(user_id, created_at);

    -- 맞춤 시험지 채점 결과 (수업에 묶이지 않은 시험지)
    CREATE TABLE IF NOT EXISTS exam_results (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note_id    TEXT NOT NULL,
      score      INTEGER NOT NULL DEFAULT 0,
      total      INTEGER NOT NULL DEFAULT 0,
      overall    TEXT NOT NULL DEFAULT '',
      items_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );
  `);

  // 기존 DB 에 컬럼을 덧붙인다. 이미 있으면 조용히 넘어간다.
  for (const sql of [
    `ALTER TABLE notes ADD COLUMN topic TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE notes ADD COLUMN result_json TEXT NOT NULL DEFAULT ''`,
  ]) {
    try {
      instance.exec(sql);
    } catch {
      /* 이미 있는 컬럼 */
    }
  }
}

export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function now(): number {
  return Date.now();
}
