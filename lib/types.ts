// ── 캘린더 (Notion Calendar 스타일: 사용자 정의 캘린더 + 색상) ──
// 색은 임의의 hex 문자열("#rrggbb")로 저장한다. Tailwind가 런타임에 클래스를
// 만들 수 없으므로 실제 렌더링은 lib/color.ts의 인라인 스타일 헬퍼가 담당한다.

import { isTooSimilar, normalizeHex } from "./color";

export interface PresetColor {
  name: string;
  hex: string;
}

/** 색 선택기에서 한 번에 고를 수 있는 기본 색 */
export const PRESET_COLORS: PresetColor[] = [
  { name: "인디고", hex: "#6366f1" },
  { name: "로즈", hex: "#f43f5e" },
  { name: "오렌지", hex: "#f97316" },
  { name: "앰버", hex: "#f59e0b" },
  { name: "에메랄드", hex: "#10b981" },
  { name: "스카이", hex: "#0ea5e9" },
  { name: "바이올렛", hex: "#8b5cf6" },
  { name: "슬레이트", hex: "#64748b" },
];

/** 구버전 데이터의 색 이름(ColorKey) → hex */
const LEGACY_COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1",
  rose: "#f43f5e",
  orange: "#f97316",
  amber: "#f59e0b",
  emerald: "#10b981",
  sky: "#0ea5e9",
  violet: "#8b5cf6",
  slate: "#64748b",
};

export const FALLBACK_COLOR = "#64748b";

/** 색 선택기의 초기값 */
export const DEFAULT_NEW_COLOR = "#0ea5e9";

/** 보호 캘린더 전용 색 — 다른 캘린더는 이 색(및 구분되지 않는 근처 색)을 쓸 수 없다 */
export const RESERVED_COLOR = "#10b981";

/** 예약 색과 구분되는 프리셋만 남긴 목록 */
export const SELECTABLE_PRESETS = PRESET_COLORS.filter(
  (p) => !isTooSimilar(p.hex, RESERVED_COLOR),
);

/** 저장된 값이 hex든 구버전 색 이름이든 항상 hex로 만든다 */
export function toHexColor(raw: string): string {
  return normalizeHex(raw) ?? LEGACY_COLOR_HEX[raw] ?? FALLBACK_COLOR;
}

export interface CalendarInfo {
  id: string;
  name: string;
  color: string; // "#rrggbb"
  visible: boolean;
}

/** 목록 맨 위에 고정되고 삭제할 수 없는 캘린더 */
export const PROTECTED_CALENDAR_ID = "cal-avail";

const PROTECTED_DEFAULT: CalendarInfo = {
  id: PROTECTED_CALENDAR_ID,
  name: "공부 가능 시간",
  color: RESERVED_COLOR,
  visible: true,
};

export const DEFAULT_CALENDARS: CalendarInfo[] = [
  PROTECTED_DEFAULT,
  { id: "cal-study", name: "공부", color: "#6366f1", visible: true },
  { id: "cal-personal", name: "개인", color: "#f97316", visible: true },
];

/**
 * 캘린더 목록의 불변 규칙을 강제한다. 저장·표시 양쪽에서 통과시키므로
 * 어느 경로로 목록이 바뀌어도 아래 조건이 항상 성립한다.
 *  1. 색은 언제나 hex (구버전 색 이름 데이터도 여기서 변환된다)
 *  2. 보호 캘린더가 없으면 복원하고 항상 맨 위에 둔다 (= 삭제 불가)
 *  3. 보호 캘린더의 색은 예약 색으로 고정한다
 *  4. 예약 색과 구분되지 않는 색을 쓰는 다른 캘린더는 다른 색으로 옮긴다
 */
export function normalizeCalendars(list: CalendarInfo[]): CalendarInfo[] {
  const hexed = list.map((c) => {
    const color = toHexColor(c.color);
    return color === c.color ? c : { ...c, color };
  });

  const found = hexed.find((c) => c.id === PROTECTED_CALENDAR_ID);
  const pinned: CalendarInfo = found
    ? { ...found, color: RESERVED_COLOR }
    : PROTECTED_DEFAULT;

  const others = hexed.filter((c) => c.id !== PROTECTED_CALENDAR_ID);
  // 이미 쓰이는 색을 먼저 채워 두고, 남은 프리셋에서 대체 색을 고른다
  const used = new Set(
    others
      .filter((c) => !isTooSimilar(c.color, RESERVED_COLOR))
      .map((c) => c.color),
  );
  const rest = others.map((c) => {
    if (!isTooSimilar(c.color, RESERVED_COLOR)) return c;
    const next =
      SELECTABLE_PRESETS.find((p) => !used.has(p.hex))?.hex ?? FALLBACK_COLOR;
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
