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

/** 목록 맨 위에 고정되고 삭제할 수 없는 캘린더 */
export const PROTECTED_CALENDAR_ID = "cal-avail";

/** 보호 캘린더 전용 색 — 다른 캘린더는 쓸 수 없다 */
export const RESERVED_COLOR: ColorKey = "emerald";

/** 예약 색을 제외한, 사용자가 고를 수 있는 색 */
export const SELECTABLE_COLORS = (Object.keys(COLORS) as ColorKey[]).filter(
  (c) => c !== RESERVED_COLOR,
);

const PROTECTED_DEFAULT: CalendarInfo = {
  id: PROTECTED_CALENDAR_ID,
  name: "공부 가능 시간",
  color: RESERVED_COLOR,
  visible: true,
};

export const DEFAULT_CALENDARS: CalendarInfo[] = [
  PROTECTED_DEFAULT,
  { id: "cal-study", name: "공부", color: "indigo", visible: true },
  { id: "cal-personal", name: "개인", color: "orange", visible: true },
];

/**
 * 캘린더 목록의 불변 규칙을 강제한다. 저장·표시 양쪽에서 통과시키므로
 * 어느 경로로 목록이 바뀌어도 아래 세 조건이 항상 성립한다.
 *  1. 보호 캘린더가 없으면 복원하고 항상 맨 위에 둔다 (= 삭제 불가)
 *  2. 보호 캘린더의 색은 예약 색으로 고정한다
 *  3. 예약 색을 쓰고 있는 다른 캘린더는 비어 있는 색으로 옮긴다
 */
export function normalizeCalendars(list: CalendarInfo[]): CalendarInfo[] {
  const found = list.find((c) => c.id === PROTECTED_CALENDAR_ID);
  const pinned: CalendarInfo = found
    ? { ...found, color: RESERVED_COLOR }
    : PROTECTED_DEFAULT;

  const others = list.filter((c) => c.id !== PROTECTED_CALENDAR_ID);
  // 이미 쓰이는 색을 먼저 채워 두고, 남은 색에서 대체 색을 고른다
  const used = new Set<ColorKey>(
    others.filter((c) => c.color !== RESERVED_COLOR).map((c) => c.color),
  );
  const rest = others.map((c) => {
    if (c.color !== RESERVED_COLOR) return c;
    const next = SELECTABLE_COLORS.find((k) => !used.has(k)) ?? "slate";
    used.add(next);
    return { ...c, color: next };
  });

  return [pinned, ...rest];
}

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
