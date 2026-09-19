// ── 캘린더 (Notion Calendar 스타일: 사용자 정의 캘린더 + 색상) ──
export type ColorKey =
  | "indigo"
  | "rose"
  | "orange"
  | "amber"
  | "emerald"
  | "sky"
  | "violet"
  | "slate";

export interface ColorStyle {
  name: string;
  dot: string; // 색상 점
  block: string; // 주간 뷰 이벤트 블록
  chip: string; // 월간 뷰 이벤트 칩
  swatch: string; // 색상 선택 스와치
}

export const COLORS: Record<ColorKey, ColorStyle> = {
  indigo: {
    name: "인디고",
    dot: "bg-indigo-500",
    block: "bg-indigo-500 hover:bg-indigo-600",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-500",
    swatch: "bg-indigo-500",
  },
  rose: {
    name: "로즈",
    dot: "bg-rose-500",
    block: "bg-rose-500 hover:bg-rose-600",
    chip: "bg-rose-50 text-rose-700 border-rose-500",
    swatch: "bg-rose-500",
  },
  orange: {
    name: "오렌지",
    dot: "bg-orange-500",
    block: "bg-orange-500 hover:bg-orange-600",
    chip: "bg-orange-50 text-orange-700 border-orange-500",
    swatch: "bg-orange-500",
  },
  amber: {
    name: "앰버",
    dot: "bg-amber-500",
    block: "bg-amber-500 hover:bg-amber-600",
    chip: "bg-amber-50 text-amber-700 border-amber-500",
    swatch: "bg-amber-500",
  },
  emerald: {
    name: "에메랄드",
    dot: "bg-emerald-500",
    block: "bg-emerald-500 hover:bg-emerald-600",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-500",
    swatch: "bg-emerald-500",
  },
  sky: {
    name: "스카이",
    dot: "bg-sky-500",
    block: "bg-sky-500 hover:bg-sky-600",
    chip: "bg-sky-50 text-sky-700 border-sky-500",
    swatch: "bg-sky-500",
  },
  violet: {
    name: "바이올렛",
    dot: "bg-violet-500",
    block: "bg-violet-500 hover:bg-violet-600",
    chip: "bg-violet-50 text-violet-700 border-violet-500",
    swatch: "bg-violet-500",
  },
  slate: {
    name: "슬레이트",
    dot: "bg-slate-500",
    block: "bg-slate-500 hover:bg-slate-600",
    chip: "bg-slate-100 text-slate-700 border-slate-500",
    swatch: "bg-slate-500",
  },
};

export interface CalendarInfo {
  id: string;
  name: string;
  color: ColorKey;
  visible: boolean;
}

export const DEFAULT_CALENDARS: CalendarInfo[] = [
  { id: "cal-study", name: "공부", color: "indigo", visible: true },
  { id: "cal-personal", name: "개인", color: "orange", visible: true },
  { id: "cal-avail", name: "공부 가능 시간", color: "emerald", visible: true },
];

// ── 이벤트 (시간은 자정 기준 분 단위로 저장 — 그리드 계산 단순화) ──
export interface EventItem {
  id: string;
  calendarId: string;
  title: string;
  date: string; // YYYY-MM-DD
  startMin: number; // 0 ~ 1440
  endMin: number; // startMin < endMin <= 1440
  memo?: string;
  notify: boolean;
  notifyMinutesBefore: number;
}

// ── 구버전(v1) 스케줄 — 마이그레이션 전용 ──
export interface LegacyScheduleItem {
  id: string;
  title: string;
  date: string;
  startTime: string; // HH:MM
  endTime?: string;
  type: "study" | "personal" | "available";
  memo?: string;
  notify: boolean;
  notifyMinutesBefore: number;
}
