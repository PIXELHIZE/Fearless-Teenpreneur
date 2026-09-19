"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarInfo, EventItem, FALLBACK_COLOR } from "@/lib/types";
import { blockStyle } from "@/lib/color";
import { minToHHMM, toDateStr, todayStr, WEEKDAYS_KO } from "@/lib/date";

const HOUR_PX = 48;
const SNAP = 15; // 분
const DAY_MIN = 24 * 60;

interface DragState {
  kind: "create" | "move" | "resize";
  id?: string;
  dayIdx: number;
  startMin: number;
  endMin: number;
  moved: boolean;
  // create용
  anchorMin?: number;
  // move용
  grabOffset?: number;
  duration?: number;
  origDay?: number;
  origStart?: number;
}

interface Props {
  days: Date[]; // 일요일 시작 7일
  events: EventItem[];
  calendarMap: Map<string, CalendarInfo>;
  selectedId: string | null;
  checkedIds: Set<string>;
  onCreate: (date: string, startMin: number, endMin: number) => void;
  onUpdate: (id: string, patch: Partial<EventItem>) => void;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
}

/** 하루 안에서 겹치는 이벤트에 레인 배정 */
function assignLanes(evts: EventItem[]): { ev: EventItem; lane: number; lanes: number }[] {
  const sorted = [...evts].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin,
  );
  const laneEnds: number[] = [];
  const placed = sorted.map((ev) => {
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] > ev.startMin) lane++;
    laneEnds[lane] = ev.endMin;
    return { ev, lane, lanes: 0 };
  });
  const total = laneEnds.length || 1;
  return placed.map((p) => ({ ...p, lanes: total }));
}

export default function WeekView({
  days,
  events,
  calendarMap,
  selectedId,
  checkedIds,
  onCreate,
  onUpdate,
  onSelect,
  onToggleCheck,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [nowMin, setNowMin] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  // 처음에 오전 8시 근처로 스크롤
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7.5 * HOUR_PX;
  }, []);

  // 현재 시각선 1분마다 갱신
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const setDragBoth = (d: DragState | null) => {
    dragRef.current = d;
    setDrag(d);
  };

  /** 포인터 좌표 → (요일 인덱스, 스냅된 분) */
  const pos = (e: { clientX: number; clientY: number }) => {
    const rect = gridRef.current!.getBoundingClientRect();
    const dayW = rect.width / 7;
    const dayIdx = Math.min(6, Math.max(0, Math.floor((e.clientX - rect.left) / dayW)));
    const rawMin = ((e.clientY - rect.top) / HOUR_PX) * 60;
    const min = Math.min(DAY_MIN, Math.max(0, Math.round(rawMin / SNAP) * SNAP));
    return { dayIdx, min };
  };

  const beginDrag = (init: DragState) => {
    setDragBoth(init);

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const { dayIdx, min } = pos(e);
      let nd: DragState = d;

      if (d.kind === "create") {
        const a = d.anchorMin!;
        nd = { ...d, startMin: Math.min(a, min), endMin: Math.max(a, min), moved: true };
      } else if (d.kind === "move") {
        const dur = d.duration!;
        let start = min - d.grabOffset!;
        start = Math.round(start / SNAP) * SNAP;
        start = Math.max(0, Math.min(DAY_MIN - dur, start));
        const moved =
          d.moved || start !== d.origStart! || dayIdx !== d.origDay!;
        nd = { ...d, dayIdx, startMin: start, endMin: start + dur, moved };
      } else {
        // resize
        nd = { ...d, endMin: Math.max(d.startMin + SNAP, min), moved: true };
      }
      setDragBoth(nd);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const d = dragRef.current;
      setDragBoth(null);
      if (!d) return;

      if (d.kind === "create") {
        const end =
          d.endMin > d.startMin ? d.endMin : Math.min(DAY_MIN, d.startMin + 60);
        onCreate(toDateStr(days[d.dayIdx]), d.startMin, end);
      } else if (d.kind === "move") {
        if (!d.moved) {
          onSelect(d.id!);
        } else {
          onUpdate(d.id!, {
            date: toDateStr(days[d.dayIdx]),
            startMin: d.startMin,
            endMin: d.endMin,
          });
        }
      } else {
        onUpdate(d.id!, { endMin: d.endMin });
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // 드래그 중이면 해당 이벤트에 미리보기 값 적용
  const effective = events.map((ev) => {
    const d = drag;
    if (d && d.id === ev.id && d.kind !== "create") {
      return {
        ...ev,
        date: toDateStr(days[d.dayIdx]),
        startMin: d.startMin,
        endMin: d.endMin,
      };
    }
    return ev;
  });

  const today = todayStr();
  const todayIdx = days.findIndex((d) => toDateStr(d) === today);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 요일 헤더 */}
      <div className="flex border-b border-border bg-card">
        <div className="w-14 shrink-0" />
        {days.map((d, i) => {
          const isToday = toDateStr(d) === today;
          return (
            <div key={i} className="flex-1 py-2 text-center">
              <div
                className={`text-[11px] font-medium ${
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
                }`}
              >
                {WEEKDAYS_KO[d.getDay()]}
              </div>
              <div
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday ? "bg-primary text-white" : ""
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* 시간 그리드 */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex">
          {/* 시간 라벨 */}
          <div className="w-14 shrink-0">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="relative text-right text-[10px] text-gray-400"
                style={{ height: HOUR_PX }}
              >
                <span className="absolute -top-1.5 right-2">
                  {h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}
                </span>
              </div>
            ))}
          </div>

          {/* 그리드 본체 */}
          <div
            ref={gridRef}
            className="relative flex-1 touch-none select-none"
            style={{ height: 24 * HOUR_PX }}
          >
            {/* 가로 시간선 */}
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-border/70"
                style={{ top: h * HOUR_PX }}
              />
            ))}

            {/* 요일 칸 (빈 곳 드래그 = 새 일정) */}
            {days.map((_, i) => (
              <div
                key={i}
                className="absolute inset-y-0 border-l border-border/70 first:border-l-0"
                style={{ left: `${(i / 7) * 100}%`, width: `${100 / 7}%` }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  if (e.target !== e.currentTarget) return; // 이벤트 블록 위는 제외
                  const { min } = pos(e);
                  beginDrag({
                    kind: "create",
                    dayIdx: i,
                    startMin: min,
                    endMin: min,
                    anchorMin: min,
                    moved: false,
                  });
                }}
              />
            ))}

            {/* 이벤트 블록 */}
            {days.map((d, di) => {
              const dstr = toDateStr(d);
              const dayEvents = effective.filter((ev) => ev.date === dstr);
              const laid = assignLanes(dayEvents);
              return laid.map(({ ev, lane, lanes }) => {
                const cal = calendarMap.get(ev.calendarId);
                const hex = cal?.color ?? FALLBACK_COLOR;
                const top = (ev.startMin / 60) * HOUR_PX;
                const height = Math.max(
                  18,
                  ((ev.endMin - ev.startMin) / 60) * HOUR_PX - 2,
                );
                const dayLeft = (di / 7) * 100;
                const laneW = 100 / 7 / lanes;
                const isSel = ev.id === selectedId;
                const isChecked = checkedIds.has(ev.id);
                const isDragging = drag?.id === ev.id;
                return (
                  <div
                    key={ev.id}
                    className={`absolute cursor-grab overflow-hidden rounded-md px-1.5 py-0.5 shadow-sm transition-shadow hover:brightness-95 ${
                      isChecked
                        ? "ring-2 ring-rose-600 ring-offset-1"
                        : isSel
                          ? "ring-2 ring-gray-900/40"
                          : ""
                    } ${isDragging ? "opacity-80 shadow-lg" : ""}`}
                    style={{
                      ...blockStyle(hex),
                      top,
                      height,
                      left: `calc(${dayLeft + lane * laneW}% + 2px)`,
                      width: `calc(${laneW}% - 4px)`,
                      zIndex: isDragging ? 30 : isChecked ? 25 : isSel ? 20 : 10,
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      const { min } = pos(e);
                      beginDrag({
                        kind: "move",
                        id: ev.id,
                        dayIdx: di,
                        startMin: ev.startMin,
                        endMin: ev.endMin,
                        duration: ev.endMin - ev.startMin,
                        grabOffset: min - ev.startMin,
                        origDay: di,
                        origStart: ev.startMin,
                        moved: false,
                      });
                    }}
                    onContextMenu={(e) => {
                      // 우클릭 = 다중 선택 토글 (브라우저 기본 메뉴 억제)
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleCheck(ev.id);
                    }}
                  >
                    {isChecked && (
                      <span className="pointer-events-none absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold leading-none text-white shadow">
                        ✓
                      </span>
                    )}
                    <div
                      className={`truncate text-[11px] font-semibold leading-tight ${
                        isChecked ? "pr-4" : ""
                      }`}
                    >
                      {ev.title || "(제목 없음)"}
                    </div>
                    {height > 30 && (
                      <div className="text-[10px] leading-tight opacity-80">
                        {minToHHMM(ev.startMin)} – {minToHHMM(ev.endMin)}
                      </div>
                    )}
                    {/* 리사이즈 핸들 */}
                    <div
                      className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        beginDrag({
                          kind: "resize",
                          id: ev.id,
                          dayIdx: di,
                          startMin: ev.startMin,
                          endMin: ev.endMin,
                          moved: false,
                        });
                      }}
                    />
                  </div>
                );
              });
            })}

            {/* 새 일정 드래그 미리보기 */}
            {drag?.kind === "create" && (
              <div
                className="pointer-events-none absolute z-40 rounded-md border-2 border-dashed border-primary bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                style={{
                  top: (drag.startMin / 60) * HOUR_PX,
                  height: Math.max(
                    12,
                    ((Math.max(drag.endMin, drag.startMin + SNAP) - drag.startMin) /
                      60) *
                      HOUR_PX,
                  ),
                  left: `calc(${(drag.dayIdx / 7) * 100}% + 2px)`,
                  width: `calc(${100 / 7}% - 4px)`,
                }}
              >
                {minToHHMM(drag.startMin)} –{" "}
                {minToHHMM(Math.max(drag.endMin, drag.startMin + SNAP))}
              </div>
            )}

            {/* 현재 시각선 */}
            {todayIdx >= 0 && (
              <div
                className="pointer-events-none absolute z-40 flex items-center"
                style={{
                  top: (nowMin / 60) * HOUR_PX,
                  left: `${(todayIdx / 7) * 100}%`,
                  width: `${100 / 7}%`,
                }}
              >
                <span className="-ml-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="h-0.5 flex-1 bg-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
