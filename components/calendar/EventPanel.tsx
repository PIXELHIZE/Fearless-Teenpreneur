"use client";

import { useEffect, useRef } from "react";
import { CalendarInfo, COLORS, EventItem } from "@/lib/types";
import { hhmmToMin, minToHHMM } from "@/lib/date";

interface Props {
  event: EventItem;
  calendars: CalendarInfo[];
  autoFocusTitle: boolean;
  onChange: (patch: Partial<EventItem>) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Notion처럼 필드를 바꾸는 즉시 저장되는 상세 패널 */
export default function EventPanel({
  event,
  calendars,
  autoFocusTitle,
  onChange,
  onDelete,
  onClose,
}: Props) {
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusTitle) titleRef.current?.select();
  }, [autoFocusTitle, event.id]);

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[11px] font-semibold text-gray-400">일정 상세</span>
        <button
          onClick={onClose}
          className="rounded px-1.5 text-gray-400 hover:bg-gray-100"
          aria-label="패널 닫기"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        <input
          ref={titleRef}
          key={event.id}
          value={event.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="제목 없음"
          className="border-b border-border pb-2 text-lg font-bold outline-none placeholder:text-gray-300 focus:border-primary"
        />

        {/* 캘린더 선택 */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-gray-400">
            캘린더
          </label>
          <div className="flex flex-wrap gap-1.5">
            {calendars.map((c) => (
              <button
                key={c.id}
                onClick={() => onChange({ calendarId: c.id })}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-colors ${
                  event.calendarId === c.id
                    ? "border-gray-800 font-semibold"
                    : "border-border text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${COLORS[c.color].dot}`} />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜/시간 */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-gray-400">
            날짜 · 시간
          </label>
          <input
            type="date"
            value={event.date}
            onChange={(e) => e.target.value && onChange({ date: e.target.value })}
            className="w-full rounded-lg border border-border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="time"
              step={300}
              value={minToHHMM(event.startMin)}
              onChange={(e) => {
                if (!e.target.value) return;
                const start = hhmmToMin(e.target.value);
                const dur = event.endMin - event.startMin;
                onChange({
                  startMin: start,
                  endMin: Math.min(24 * 60, start + dur),
                });
              }}
              className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-gray-400">→</span>
            <input
              type="time"
              step={300}
              value={minToHHMM(event.endMin)}
              onChange={(e) => {
                if (!e.target.value) return;
                const end = hhmmToMin(e.target.value);
                if (end > event.startMin) onChange({ endMin: end });
              }}
              className="flex-1 rounded-lg border border-border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* 알림 */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-gray-400">
            알림
          </label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={event.notify}
                onChange={(e) => onChange({ notify: e.target.checked })}
                className="accent-[--primary]"
              />
              사용
            </label>
            {event.notify && (
              <select
                value={event.notifyMinutesBefore}
                onChange={(e) =>
                  onChange({ notifyMinutesBefore: Number(e.target.value) })
                }
                className="rounded-lg border border-border px-2 py-1 text-xs outline-none"
              >
                <option value={5}>5분 전</option>
                <option value={10}>10분 전</option>
                <option value={30}>30분 전</option>
                <option value={60}>1시간 전</option>
              </select>
            )}
          </div>
        </div>

        {/* 메모 */}
        <div className="flex min-h-0 flex-1 flex-col">
          <label className="mb-1.5 block text-[11px] font-semibold text-gray-400">
            메모
          </label>
          <textarea
            value={event.memo ?? ""}
            onChange={(e) => onChange({ memo: e.target.value || undefined })}
            placeholder="메모를 입력하세요..."
            rows={4}
            className="w-full flex-1 resize-none rounded-lg border border-border px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="border-t border-border p-3">
        <button
          onClick={onDelete}
          className="w-full rounded-lg py-2 text-sm font-medium text-red-400 hover:bg-red-50"
        >
          일정 삭제
        </button>
      </div>
    </aside>
  );
}
