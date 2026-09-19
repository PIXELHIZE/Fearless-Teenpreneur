"use client";

import { useMemo, useState } from "react";
import { fromDateStr, monthGrid, toDateStr, todayStr } from "@/lib/date";

interface Props {
  focus: string; // YYYY-MM-DD
  onPick: (date: string) => void;
  eventDates: Set<string>;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function MiniCalendar({ focus, onPick, eventDates }: Props) {
  const focusDate = fromDateStr(focus);
  const [year, setYear] = useState(focusDate.getFullYear());
  const [month, setMonth] = useState(focusDate.getMonth());

  // 외부에서 포커스가 바뀌면 해당 월로 이동 (렌더 중 상태 조정 패턴)
  const [lastFocus, setLastFocus] = useState(focus);
  if (focus !== lastFocus) {
    setLastFocus(focus);
    setYear(focusDate.getFullYear());
    setMonth(focusDate.getMonth());
  }

  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const today = todayStr();

  const move = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <div className="select-none">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-bold">
          {year}년 {month + 1}월
        </span>
        <span className="flex gap-0.5">
          <button
            onClick={() => move(-1)}
            className="rounded px-1.5 text-xs text-gray-400 hover:bg-gray-100"
            aria-label="이전 달"
          >
            ‹
          </button>
          <button
            onClick={() => move(1)}
            className="rounded px-1.5 text-xs text-gray-400 hover:bg-gray-100"
            aria-label="다음 달"
          >
            ›
          </button>
        </span>
      </div>

      <div className="grid grid-cols-7 text-center text-[9px] text-gray-400">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={i === 0 ? "text-red-300" : i === 6 ? "text-blue-300" : ""}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {grid.map((d) => {
          const dstr = toDateStr(d);
          const inMonth = d.getMonth() === month;
          const isToday = dstr === today;
          const isFocus = dstr === focus;
          return (
            <button
              key={dstr}
              onClick={() => onPick(dstr)}
              className={`relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition-colors ${
                isFocus
                  ? "bg-primary font-bold text-white"
                  : isToday
                    ? "bg-primary-soft font-bold text-primary"
                    : inMonth
                      ? "text-gray-600 hover:bg-gray-100"
                      : "text-gray-300 hover:bg-gray-50"
              }`}
            >
              {d.getDate()}
              {eventDates.has(dstr) && !isFocus && (
                <span className="absolute bottom-0 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
