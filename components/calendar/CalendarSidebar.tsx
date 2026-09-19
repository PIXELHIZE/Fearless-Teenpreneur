"use client";

import { useState } from "react";
import {
  CalendarInfo,
  DEFAULT_NEW_COLOR,
  EventItem,
  PROTECTED_CALENDAR_ID,
  RESERVED_COLOR,
  SELECTABLE_PRESETS,
} from "@/lib/types";
import { dotStyle, isTooSimilar } from "@/lib/color";
import { uid } from "@/lib/storage";
import MiniCalendar from "./MiniCalendar";
import ColorPicker from "./ColorPicker";

interface Props {
  focus: string;
  onPick: (date: string) => void;
  calendars: CalendarInfo[];
  setCalendars: (fn: (prev: CalendarInfo[]) => CalendarInfo[]) => void;
  events: EventItem[];
  onDeleteCalendar: (id: string) => void;
}

export default function CalendarSidebar({
  focus,
  onPick,
  calendars,
  setCalendars,
  events,
  onDeleteCalendar,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);
  const [notifPermission, setNotifPermission] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );

  const eventDates = new Set(events.map((e) => e.date));

  // 예약 색은 "공부 가능 시간" 전용 — 눈으로 구분되지 않는 근처 색까지 막는다
  const colorBlocked = isTooSimilar(newColor, RESERVED_COLOR);
  const canAdd = newName.trim().length > 0 && !colorBlocked;

  const addCalendar = () => {
    if (!canAdd) return;
    setCalendars((prev) => [
      ...prev,
      { id: uid(), name: newName.trim(), color: newColor, visible: true },
    ]);
    setNewName("");
    setNewColor(DEFAULT_NEW_COLOR);
    setAdding(false);
  };

  const toggleVisible = (id: string) => {
    setCalendars((prev) =>
      prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    );
  };

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setNotifPermission(p);
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="text-xl">📅</span>
        <span className="font-bold">캘린더</span>
      </div>

      <div className="px-3">
        <MiniCalendar focus={focus} onPick={onPick} eventDates={eventDates} />
      </div>

      <div className="mt-5 flex-1 overflow-y-auto px-3">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[11px] font-semibold text-gray-400">내 캘린더</span>
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded px-1.5 text-sm text-gray-400 hover:bg-gray-100"
            aria-label="캘린더 추가"
          >
            {adding ? "×" : "+"}
          </button>
        </div>

        {adding && (
          <div className="mb-2 flex flex-col gap-2 rounded-lg bg-gray-50 p-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCalendar()}
              placeholder="캘린더 이름"
              autoFocus
              className="rounded-md border border-border bg-white px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary"
            />
            <ColorPicker
              value={newColor}
              onChange={setNewColor}
              presets={SELECTABLE_PRESETS}
            />
            {colorBlocked ? (
              <p className="flex items-start gap-1 text-[10px] leading-snug text-rose-600">
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={dotStyle(RESERVED_COLOR)}
                />
                <span>
                  이 색은 &ldquo;공부 가능 시간&rdquo; 전용입니다. 다른 색을
                  골라 주세요.
                </span>
              </p>
            ) : (
              <p className="text-[10px] leading-snug text-gray-400">
                휠을 끌어 색을, 옆 바로 밝기를 조절하거나 RGB · hex 값을 직접
                입력할 수 있습니다.
              </p>
            )}
            <button
              onClick={addCalendar}
              disabled={!canAdd}
              className="rounded-md bg-primary py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              추가
            </button>
          </div>
        )}

        <ul className="flex flex-col">
          {calendars.map((c) => {
            const count = events.filter((e) => e.calendarId === c.id).length;
            const locked = c.id === PROTECTED_CALENDAR_ID;
            return (
              <li
                key={c.id}
                className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-gray-50"
              >
                <button
                  onClick={() => toggleVisible(c.id)}
                  className={`h-3.5 w-3.5 shrink-0 rounded ${
                    c.visible ? "" : "border-2 border-gray-300 bg-transparent"
                  }`}
                  style={c.visible ? dotStyle(c.color) : undefined}
                  aria-label={c.visible ? "숨기기" : "표시하기"}
                />
                <span
                  className={`min-w-0 flex-1 truncate text-[13px] ${
                    c.visible ? "" : "text-gray-400"
                  }`}
                >
                  {c.name}
                </span>
                <span className="text-[10px] text-gray-300">{count}</span>
                {locked ? (
                  <span
                    className="hidden text-[10px] text-gray-300 group-hover:block"
                    title="고정된 캘린더 · 삭제할 수 없습니다"
                    aria-label="고정된 캘린더 · 삭제할 수 없습니다"
                  >
                    🔒
                  </span>
                ) : (
                  <button
                    onClick={() => onDeleteCalendar(c.id)}
                    className="hidden text-xs text-gray-300 hover:text-red-400 group-hover:block"
                    aria-label="캘린더 삭제"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-border p-3">
        {notifPermission === "default" && (
          <button
            onClick={requestPermission}
            className="w-full rounded-lg bg-primary py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            🔔 일정 알림 켜기
          </button>
        )}
        {notifPermission === "granted" && (
          <p className="text-center text-[11px] text-emerald-600">🔔 알림 사용 중</p>
        )}
        {notifPermission === "denied" && (
          <p className="text-center text-[11px] text-gray-400">
            브라우저 알림 차단됨 · 인앱 알림만 표시
          </p>
        )}
        {notifPermission === "unsupported" && (
          <p className="text-center text-[11px] text-gray-400">알림 미지원 브라우저</p>
        )}
      </div>
    </aside>
  );
}
