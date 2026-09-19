"use client";

import { useEffect, useState } from "react";

export const KEYS = {
  schedules: "ft.schedules", // v1 레거시 — 마이그레이션 전용
  events: "ft.events",
  calendars: "ft.calendars",
  // Google 연동 (Apps Script 웹앱 — lib/google/config.ts 참고)
  gcalEndpoint: "ft.gcal.endpoint", // 배포 URL + 비밀 값
  gcalLinks: "ft.gcal.links", // 로컬 일정 id → Google 일정 id 대응표
} as const;

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * localStorage에 동기화되는 상태 훅.
 * SSR 하이드레이션 안전을 위해 마운트 후에 값을 읽는다.
 * 반환: [value, setValue, loaded]
 */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // SSR 하이드레이션 후 저장된 값 복원 — 마운트 시 1회만 실행되는 의도된 패턴
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw != null) setValue(JSON.parse(raw));
    } catch {
      // 손상된 데이터는 무시하고 초기값 유지
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 저장 공간 부족 등은 조용히 무시
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded] as const;
}

/** 훅 밖(이벤트 핸들러 등)에서 읽기 전용으로 사용 */
export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw != null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
