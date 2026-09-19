"use client";

/**
 * 단방향 동기화 엔진 (이 앱 → Google).
 *
 * 설계의 핵심: 일정이 바뀌는 지점마다 "Google에도 보내기"를 끼워 넣지 않는다.
 * 대신 일정 목록 전체를 마지막으로 보낸 상태(links)와 비교해 차이만 보낸다.
 * lib/types.ts의 normalizeCalendars와 같은 발상으로, 경로마다 고치는 대신
 * "Google의 상태 = 로컬의 상태"라는 불변식을 한 곳에서 강제한다.
 *
 * 덕분에 드래그·드롭·패널 입력·캘린더 연쇄 삭제 등 모든 경로가 저절로 처리되고,
 * 연결 이전에 만들어 둔 일정의 최초 업로드도 빈 대응표와의 비교로 자연히 따라온다.
 *
 * 이 비교는 멱등하다. 실패한 작업은 대응표를 갱신하지 않으므로 다음 비교에서
 * 똑같이 다시 잡힌다 — 그래서 미전송 작업을 따로 저장할 큐가 필요 없다.
 */

import { useEffect, useSyncExternalStore } from "react";
import { KEYS } from "@/lib/storage";
import { CalendarInfo, EventItem } from "@/lib/types";
import {
  EndpointError,
  hashEvent,
  OPS_PER_REQUEST,
  OpResult,
  sendOps,
  toUpsertOp,
  WireOp,
} from "./api";
import {
  getLinkConfig,
  getLinkServerState,
  getLinkState,
  LinkState,
  recheckLink,
  restoreLink,
  subscribeLink,
} from "./config";

/** 패널 입력은 키 입력마다 발생한다 — 값이 멎은 뒤에 한 번만 보낸다 */
const DEBOUNCE_MS = 1200;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 60_000;

// ── 대응표 ──
interface SyncLink {
  gcalId: string;
  hash: string;
}
type SyncLinks = Record<string, SyncLink>;

function readLinks(): SyncLinks {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEYS.gcalLinks);
    return raw ? (JSON.parse(raw) as SyncLinks) : {};
  } catch {
    return {};
  }
}

function writeLinks(links: SyncLinks) {
  try {
    localStorage.setItem(KEYS.gcalLinks, JSON.stringify(links));
  } catch {
    // 저장에 실패하면 다음 비교에서 같은 작업이 다시 잡힐 뿐이다
  }
}

// ── 상태 저장소 ──
export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export interface SyncState {
  status: SyncStatus;
  pending: number;
  error: string | null;
  lastSyncedAt: number | null;
}

export const INITIAL_SYNC: SyncState = {
  status: "idle",
  pending: 0,
  error: null,
  lastSyncedAt: null,
};

let syncState: SyncState = INITIAL_SYNC;
const syncListeners = new Set<() => void>();

function setSyncState(patch: Partial<SyncState>) {
  syncState = { ...syncState, ...patch };
  for (const l of syncListeners) l();
}

function subscribeSync(listener: () => void): () => void {
  syncListeners.add(listener);
  return () => {
    syncListeners.delete(listener);
  };
}

const getSyncState = () => syncState;
const getSyncServerState = () => INITIAL_SYNC;

// ── 비교 대상 ──
// 훅이 최신 일정을 여기에 넣어 두면, 재시도 타이머처럼 React 밖에서 시작된
// 작업도 항상 현재 값을 본다.
let source: {
  events: EventItem[];
  calendarMap: Map<string, CalendarInfo>;
} = { events: [], calendarMap: new Map() };

/** 보낼 작업 + 성공했을 때 대응표에 기록할 지문 */
interface Planned {
  wire: WireOp;
  hash?: string;
}

function planOps(
  events: EventItem[],
  calendarMap: Map<string, CalendarInfo>,
  links: SyncLinks,
): Planned[] {
  const planned: Planned[] = [];
  const liveIds = new Set<string>();

  for (const ev of events) {
    liveIds.add(ev.id);
    const cal = calendarMap.get(ev.calendarId);
    const hash = hashEvent(ev, cal);
    const link = links[ev.id];
    if (!link || link.hash !== hash) {
      planned.push({ wire: toUpsertOp(ev, cal, link?.gcalId), hash });
    }
  }

  // 대응표에는 있는데 일정이 사라졌다 = 로컬에서 지워졌다
  for (const [localId, link] of Object.entries(links)) {
    if (!liveIds.has(localId)) {
      planned.push({
        wire: { kind: "delete", localId, gcalId: link.gcalId },
      });
    }
  }

  return planned;
}

/** 한 묶음의 결과를 대응표에 반영하고, 실패한 작업 수와 첫 오류를 돌려준다 */
function applyResults(
  chunk: Planned[],
  results: OpResult[],
  links: SyncLinks,
): { failed: number; error: string | null } {
  const byId = new Map(results.map((r) => [r.localId, r]));
  let failed = 0;
  let error: string | null = null;

  for (const p of chunk) {
    const r = byId.get(p.wire.localId);
    if (!r?.ok) {
      failed += 1;
      error ??= r?.error ?? "일부 일정을 보내지 못했습니다.";
      continue;
    }
    if (p.wire.kind === "delete") {
      delete links[p.wire.localId];
    } else if (r.gcalId) {
      links[p.wire.localId] = { gcalId: r.gcalId, hash: p.hash ?? "" };
    } else {
      // id를 못 받았으면 기록할 수 없다 — 다음 비교에서 다시 잡힌다
      failed += 1;
      error ??= "생성된 일정의 id를 받지 못했습니다.";
    }
  }

  return { failed, error };
}

// ── 실행 ──
let running = false;
let rerunRequested = false;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function clearRetry() {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry() {
  clearRetry();
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** failures);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void reconcile();
  }, delay);
}

async function runOnce(): Promise<void> {
  const { events, calendarMap } = source;
  // 드레인 직전에 다시 읽는다 — 다른 탭이 그 사이에 올린 것을 존중한다
  const links = readLinks();
  const planned = planOps(events, calendarMap, links);

  if (planned.length === 0) {
    failures = 0;
    setSyncState({ status: "idle", pending: 0, error: null });
    return;
  }

  setSyncState({ status: "syncing", pending: planned.length, error: null });

  const { url, secret } = getLinkConfig();
  let remaining = planned.length;
  let firstError: string | null = null;

  for (let i = 0; i < planned.length; i += OPS_PER_REQUEST) {
    const chunk = planned.slice(i, i + OPS_PER_REQUEST);
    let results: OpResult[];
    try {
      ({ results } = await sendOps(
        url,
        secret,
        chunk.map((p) => p.wire),
      ));
    } catch (e) {
      // 설정이 틀린 경우는 재시도해도 소용없다 — 사용자가 고쳐야 한다
      const message =
        e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
      if (e instanceof EndpointError && !e.isTransient) {
        setSyncState({ status: "error", pending: remaining, error: message });
        // 연결 상태 자체를 다시 판정해 UI가 설정 양식을 띄우게 한다
        void recheckLink();
        return;
      }
      failures += 1;
      setSyncState({ status: "error", pending: remaining, error: message });
      scheduleRetry();
      return;
    }

    const { failed, error } = applyResults(chunk, results, links);
    writeLinks(links);
    remaining -= chunk.length - failed;
    firstError ??= error;
    setSyncState({ pending: remaining });
  }

  if (firstError) {
    failures += 1;
    setSyncState({ status: "error", pending: remaining, error: firstError });
    scheduleRetry();
    return;
  }

  failures = 0;
  setSyncState({
    status: "idle",
    pending: 0,
    error: null,
    lastSyncedAt: Date.now(),
  });
}

/** 로컬과 Google의 차이를 맞춘다. 동시에 두 번 돌지 않는다. */
export async function reconcile(): Promise<void> {
  if (getLinkState().status !== "connected") return;

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setSyncState({ status: "offline" });
    return;
  }

  if (running) {
    // 진행 중에 들어온 변경은 끝난 뒤 한 번 더 돌려서 반영한다
    rerunRequested = true;
    return;
  }

  running = true;
  clearRetry();
  try {
    await runOnce();
  } finally {
    running = false;
    if (rerunRequested) {
      rerunRequested = false;
      void reconcile();
    }
  }
}

/** 연결 해제 등으로 진행 중인 재시도를 멈춰야 할 때 */
export function resetSync() {
  clearRetry();
  failures = 0;
  syncState = INITIAL_SYNC;
  for (const l of syncListeners) l();
}

// ── React 연결 ──
export interface GoogleSyncView {
  link: LinkState;
  sync: SyncState;
}

/**
 * 일정이 바뀔 때마다 Google과 맞춘다.
 * page.tsx에서 한 번만 호출하면 모든 변경 경로가 덮인다.
 *
 * ready는 localStorage 복원이 끝났는지를 뜻하며 반드시 넘겨야 한다.
 * 복원 전의 events는 빈 배열이라, 그 상태로 비교하면 대응표에 있는 일정이
 * 전부 "로컬에서 삭제됨"으로 보여 Google 쪽 일정을 몰살시킨다.
 */
export function useGoogleSync(
  events: EventItem[],
  calendarMap: Map<string, CalendarInfo>,
  ready: boolean,
): GoogleSyncView {
  const link = useSyncExternalStore(
    subscribeLink,
    getLinkState,
    getLinkServerState,
  );
  const sync = useSyncExternalStore(
    subscribeSync,
    getSyncState,
    getSyncServerState,
  );

  // 저장된 배포 URL을 복원하고 살아 있는지 확인한다 (마운트 시 1회)
  useEffect(() => {
    void restoreLink();
  }, []);

  useEffect(() => {
    // 복원 전에는 source를 건드리지 않는다 — 빈 목록이 재시도 타이머에 잡히면
    // 그것만으로 Google 쪽 일정이 전부 삭제된다
    if (!ready) return;
    // 재시도 타이머가 최신 값을 보도록 타이머 예약보다 먼저 넣는다
    source = { events, calendarMap };
    if (link.status !== "connected") return;
    const t = setTimeout(() => void reconcile(), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [events, calendarMap, link.status, ready]);

  useEffect(() => {
    const onOnline = () => void reconcile();
    const onOffline = () => setSyncState({ status: "offline" });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { link, sync };
}
