"use client";

import { useMemo, useState } from "react";
import { CalendarInfo, COLORS, EventItem } from "@/lib/types";
import { minToHHMM, monthGrid, toDateStr, todayStr } from "@/lib/date";

interface Props {
  year: number;
  month: number; // 0-based
  events: EventItem[];
  calendarMap: Map<string, CalendarInfo>;
  selectedId: string | null;
  checkedIds: Set<string>;
  onCreate: (date: string) => void;
  onMove: (id: string, date: string) => void;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export default function MonthView({
  year,
  month,
  events,
  calendarMap,
  selectedId,
  checkedIds,
  onCreate,
  onMove,
  onSelect,
  onToggleCheck,
}: Props) {
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    for (const list of map.values())
      list.sort((a, b) => a.startMin - b.startMin);
    return map;
  }, [events]);

  const today = todayStr();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-border bg-card text-center text-[11px] font-medium text-gray-400">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-1.5 ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : ""}`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {grid.map((d) => {
          const dstr = toDateStr(d);
          const inMonth = d.getMonth() === month;
          const isToday = dstr === today;
          const items = byDate.get(dstr) ?? [];
          const MAX = 3;
          return (
            <div
              key={dstr}
              className={`flex min-h-0 flex-col gap-0.5 border-b border-r border-border/70 p-1 transition-colors ${
                inMonth ? "" : "bg-gray-50/60"
              } ${dragOver === dstr ? "bg-primary-soft" : ""}`}
              onClick={(e) => {
                if (e.target === e.currentTarget) onCreate(dstr);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(dstr);
              }}
              onDragLeave={() => setDragOver((v) => (v === dstr ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) onMove(id, dstr);
              }}
            >
              <span
                className={`pointer-events-none self-start rounded-full px-1.5 text-xs leading-5 ${
                  isToday
                    ? "bg-primary font-bold text-white"
                    : inMonth
                      ? "text-gray-600"
                      : "text-gray-300"
                }`}
              >
                {d.getDate()}
              </span>

              {items.slice(0, MAX).map((ev) => {
                const cal = calendarMap.get(ev.calendarId);
                const color = COLORS[cal?.color ?? "slate"];
                const isSel = ev.id === selectedId;
                const isChecked = checkedIds.has(ev.id);
                return (
                  <button
                    key={ev.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", ev.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(ev.id);
                    }}
                    onContextMenu={(e) => {
                      // 우클릭 = 다중 선택 토글 (브라우저 기본 메뉴 억제)
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleCheck(ev.id);
                    }}
                    className={`flex w-full cursor-grab items-center gap-1 truncate rounded border-l-2 px-1 text-left text-[10px] leading-4 ${color.chip} ${
                      isChecked
                        ? "ring-2 ring-rose-600"
                        : isSel
                          ? "ring-1 ring-gray-500"
                          : ""
                    }`}
                    title={`${minToHHMM(ev.startMin)} ${ev.title}`}
                  >
                    {isChecked && (
                      <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[8px] font-bold leading-none text-white">
                        ✓
                      </span>
                    )}
                    <span className="truncate">
                      <span className="font-medium">
                        {minToHHMM(ev.startMin)}
                      </span>{" "}
                      {ev.title || "(제목 없음)"}
                    </span>
                  </button>
                );
              })}
              {items.length > MAX && (
                <span className="pointer-events-none px-1 text-[10px] text-gray-400">
                  +{items.length - MAX}개
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
