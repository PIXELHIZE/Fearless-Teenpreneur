"use client";

import { useEffect, useRef, useState } from "react";
import { KEYS, readLocal } from "@/lib/storage";
import { EventItem } from "@/lib/types";
import { minToHHMM, todayStr } from "@/lib/date";

/**
 * 전역 스케줄 알림 매니저.
 * 30초마다 오늘 일정을 확인해 알림 시각(시작 N분 전)이 되면
 * 브라우저 알림 + 인앱 토스트를 띄운다.
 */
export default function NotificationManager() {
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 세션 내 중복 알림 방지 기록 복원
    try {
      const raw = sessionStorage.getItem("ft.notified");
      if (raw) notifiedRef.current = new Set(JSON.parse(raw));
    } catch {}

    const check = () => {
      const events = readLocal<EventItem[]>(KEYS.events, []);
      const today = todayStr();
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      for (const ev of events) {
        if (!ev.notify || ev.date !== today) continue;
        if (notifiedRef.current.has(ev.id)) continue;

        const notifyAt = ev.startMin - ev.notifyMinutesBefore;
        if (nowMin >= notifyAt && nowMin < ev.startMin) {
          notifiedRef.current.add(ev.id);
          try {
            sessionStorage.setItem(
              "ft.notified",
              JSON.stringify([...notifiedRef.current]),
            );
          } catch {}

          const text = `${minToHHMM(ev.startMin)} 「${ev.title || "제목 없음"}」 일정이 곧 시작돼요!`;
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification("📌 일정 알림", { body: text });
          }
          setToasts((t) => [...t, { id: ev.id, text }]);
          setTimeout(() => {
            setToasts((t) => t.filter((x) => x.id !== ev.id));
          }, 10_000);
        }
      }
    };

    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
        >
          <span className="text-xl">🔔</span>
          <span className="text-sm font-medium">{t.text}</span>
          <button
            onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
            className="ml-2 text-gray-400 hover:text-gray-600"
            aria-label="알림 닫기"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
