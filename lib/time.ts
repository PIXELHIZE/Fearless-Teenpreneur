/** 날짜·시간 헬퍼. 시간은 자정 기준 분 단위(0~1440)로 다룬다. */

export const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addDaysStr(s: string, n: number): string {
  return toDateStr(addDays(fromDateStr(s), n));
}

export function nowMinutes(base = new Date()): number {
  return base.getHours() * 60 + base.getMinutes();
}

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** "오후 2:30" 처럼 읽기 쉬운 표기 */
export function minToKorean(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min) % 60;
  const half = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${half} ${hour12}시` : `${half} ${hour12}시 ${m}분`;
}

export function formatKoreanDate(dateStr: string): string {
  const d = fromDateStr(dateStr);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS_KO[d.getDay()]})`;
}

/** 오늘/내일이면 그렇게, 아니면 날짜로 */
export function relativeDateLabel(dateStr: string, today = todayStr()): string {
  if (dateStr === today) return "오늘";
  if (dateStr === addDaysStr(today, 1)) return "내일";
  if (dateStr === addDaysStr(today, -1)) return "어제";
  return formatKoreanDate(dateStr);
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

/** 정렬·비교용 절대 분 */
export function absoluteMinutes(dateStr: string, min: number): number {
  return fromDateStr(dateStr).getTime() / 60000 + min;
}

/** 해당 월의 캘린더 그리드(일요일 시작, 6주) */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

export interface Range {
  start: number;
  end: number;
}

export function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

/** base 구간들에서 blocks 구간을 빼고 남은 구간 */
export function subtractRanges(base: Range[], blocks: Range[]): Range[] {
  let result = [...base];
  for (const block of blocks) {
    const next: Range[] = [];
    for (const range of result) {
      if (!overlaps(range, block)) {
        next.push(range);
        continue;
      }
      if (block.start > range.start) next.push({ start: range.start, end: block.start });
      if (block.end < range.end) next.push({ start: block.end, end: range.end });
    }
    result = next;
  }
  return result.filter((r) => r.end > r.start);
}

export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else out.push({ ...range });
  }
  return out;
}

/** 수업 스케줄의 최소 길이 */
export const MIN_LESSON_MINUTES = 30;
