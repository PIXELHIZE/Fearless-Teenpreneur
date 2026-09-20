/** 클라이언트와 서버가 함께 쓰는 도메인 타입 */

export type LessonStatus = "scheduled" | "in_progress" | "completed" | "missed";
export type MaterialStatus = "pending" | "ready" | "failed";
export type LessonStage = "slides" | "quiz" | "exam" | "report";

export interface Goal {
  id: string;
  title: string;
  subject: string;
  detail: string;
  level: string;
  target_date: string | null;
  status: string;
  created_at: number;
}

export interface Unit {
  id: string;
  goal_id: string;
  title: string;
  summary: string;
  difficulty: number;
  weight: number;
  mastery: number;
  order_index: number;
  status: string;
}

export interface Lesson {
  id: string;
  goal_id: string | null;
  unit_id: string | null;
  series_id: string | null;
  title: string;
  date: string;
  start_min: number;
  end_min: number;
  status: LessonStatus;
  origin: string;
}

/** 카드에 붙는 시각 자료. 모델이 고르고 클라이언트가 그린다. */
export type SlideVisual =
  | { type: "formula"; text: string; caption?: string }
  | { type: "steps"; items: string[] }
  | { type: "compare"; left: { title: string; items: string[] }; right: { title: string; items: string[] } }
  | { type: "bars"; items: { label: string; value: number }[]; unit?: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "example"; problem: string; solution: string };

export interface Slide {
  id: string;
  title: string;
  body: string;
  bullets: string[];
  example?: string;
  visual?: SlideVisual;
}

export interface QuizItem {
  id: string;
  kind: "ox" | "choice";
  question: string;
  choices?: string[];
  /** ox 는 "O" | "X", choice 는 보기 번호(1부터) 문자열 */
  answer: string;
  explain: string;
}

export interface ExamItem {
  id: string;
  number: number;
  kind: "short" | "essay" | "choice";
  question: string;
  /** 보기 지문·조건 등 문제 앞에 붙는 자료 */
  passage?: string;
  /** choice 는 5개 */
  choices?: string[];
  answer: string;
  rubric: string;
  points: number;
}

export interface FeedbackEntry {
  id: string;
  kind: "lesson" | "exam" | "instant";
  ref_id: string | null;
  title: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
  accuracy: number;
  created_at: number;
}

export interface Material {
  status: MaterialStatus;
  slides: Slide[];
  quiz: QuizItem[];
  exam: ExamItem[];
  note: string;
  error: string;
  generated_at: number | null;
}

export interface LessonProgress {
  stage: LessonStage;
  slide_index: number;
  quiz_index: number;
  active_seconds: number;
  entered_at: number | null;
  last_seen_at: number | null;
  completed_at: number | null;
}

export interface AnswerRow {
  question_id: string;
  kind: string;
  given: string;
  correct: string;
  is_correct: number;
  score: number;
  comment: string;
}

export interface Analysis {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  feedback: string;
  accuracy: number;
  focus_seconds: number;
  created_at: number;
}

export interface AvailabilitySlot {
  id: string;
  kind: "weekly" | "date";
  weekday: number | null;
  date: string | null;
  start_min: number;
  end_min: number;
}

export interface BusyEvent {
  id: string;
  title: string;
  kind: "weekly" | "date";
  weekday: number | null;
  date: string | null;
  start_min: number;
  end_min: number;
}

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: string[];
  created_at: number;
}

export interface DrillItem {
  id: string;
  kind: "ox" | "flip" | "trace";
  /** ox */
  question?: string;
  answer?: boolean;
  explain?: string;
  /** flip */
  front?: string;
  back?: string;
  hint?: string;
  /** trace */
  text?: string;
  guide?: string;
}
