"use client";

/**
 * Apps Script 웹앱과 주고받는 전송 계층 + 로컬 일정 → 작업(op) 변환.
 *
 * 이 파일은 설정을 읽지 않는다 — url·secret을 인자로 받는다. 그래야
 * config.ts가 이 파일을 쓰면서도 순환 참조가 생기지 않는다.
 */

import { fromDateStr } from "@/lib/date";
import { colorDistance } from "@/lib/color";
import { CalendarInfo, EventItem } from "@/lib/types";

/** Apps Script의 6분 실행 제한에 걸리지 않도록 한 요청에 담는 작업 수 */
export const OPS_PER_REQUEST = 40;

export type EndpointErrorKind = "config" | "network" | "server";

export class EndpointError extends Error {
  constructor(
    message: string,
    readonly kind: EndpointErrorKind,
  ) {
    super(message);
    this.name = "EndpointError";
  }

  /** 잠시 후 다시 해 보면 되는 오류 */
  get isTransient(): boolean {
    return this.kind !== "config";
  }
}

// ── 주고받는 모양 ──
export interface UpsertOp {
  kind: "insert" | "patch";
  localId: string;
  gcalId?: string;
  title: string;
  description: string;
  /** UTC ISO 문자열 — 브라우저 시간대로 계산한 절대 시각 */
  start: string;
  end: string;
  colorId?: string;
  reminderMinutes: number | null;
}

export interface DeleteOp {
  kind: "delete";
  localId: string;
  gcalId: string;
}

export type WireOp = UpsertOp | DeleteOp;

export interface OpResult {
  localId: string;
  ok: boolean;
  gcalId?: string;
  error?: string;
}

interface ScriptResponse {
  ok: boolean;
  error?: string;
  calendarName?: string;
  results?: OpResult[];
}

const ERROR_TEXT: Record<string, string> = {
  unauthorized: "비밀 값이 스크립트의 SECRET과 다릅니다.",
};

/**
 * 작업 묶음을 보낸다.
 *
 * Content-Type을 text/plain으로 보내는 것이 핵심이다. application/json이면
 * 브라우저가 사전 요청(preflight)을 보내는데 Apps Script 웹앱은 그것을
 * 처리하지 못해 요청 자체가 막힌다. 본문은 그대로 JSON 문자열이고,
 * 스크립트에서 JSON.parse로 읽는다.
 */
export async function sendOps(
  url: string,
  secret: string,
  ops: WireOp[],
): Promise<{ calendarName: string | null; results: OpResult[] }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret, ops }),
      redirect: "follow",
    });
  } catch {
    // fetch가 던지는 경우는 오프라인이거나 주소에 닿지 못한 경우다
    throw new EndpointError(
      "Google에 연결하지 못했습니다. 네트워크를 확인해 주세요.",
      "network",
    );
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new EndpointError(
        "스크립트에 접근할 수 없습니다. 배포할 때 액세스 권한을 \"모든 사용자\"로 설정했는지 확인해 주세요.",
        "config",
      );
    }
    if (res.status === 404) {
      throw new EndpointError(
        "배포 주소를 찾을 수 없습니다. URL을 다시 확인해 주세요.",
        "config",
      );
    }
    throw new EndpointError(`Google 응답 오류 (HTTP ${res.status})`, "server");
  }

  const text = await res.text();
  let body: ScriptResponse;
  try {
    body = JSON.parse(text) as ScriptResponse;
  } catch {
    // 로그인 페이지 HTML이 돌아오는 전형적인 경우 — 배포 설정이 잘못됐다
    throw new EndpointError(
      "스크립트가 아닌 응답이 돌아왔습니다. 배포 유형이 \"웹 앱\"이고 액세스 권한이 \"모든 사용자\"인지 확인해 주세요.",
      "config",
    );
  }

  if (!body.ok) {
    const raw = body.error ?? "알 수 없는 오류";
    const message = ERROR_TEXT[raw] ?? raw;
    throw new EndpointError(message, raw === "unauthorized" ? "config" : "server");
  }

  return { calendarName: body.calendarName ?? null, results: body.results ?? [] };
}

/** 작업 없이 한 번 찔러 연결이 살아 있는지 본다 */
export async function probeEndpoint(
  url: string,
  secret: string,
): Promise<{ calendarName: string | null }> {
  const { calendarName } = await sendOps(url, secret, []);
  return { calendarName };
}

// ── 색 ──
/**
 * Google 이벤트 색은 11가지로 고정돼 있고 임의의 hex를 받지 않는다.
 * Apps Script의 CalendarApp.EventColor도 같은 1~11 번호를 쓴다.
 */
const GOOGLE_EVENT_COLORS: { id: string; hex: string }[] = [
  { id: "1", hex: "#7986cb" }, // Lavender
  { id: "2", hex: "#33b679" }, // Sage
  { id: "3", hex: "#8e24aa" }, // Grape
  { id: "4", hex: "#e67c73" }, // Flamingo
  { id: "5", hex: "#f6bf26" }, // Banana
  { id: "6", hex: "#f4511e" }, // Tangerine
  { id: "7", hex: "#039be5" }, // Peacock
  { id: "8", hex: "#616161" }, // Graphite
  { id: "9", hex: "#3f51b5" }, // Blueberry
  { id: "10", hex: "#0b8043" }, // Basil
  { id: "11", hex: "#d50000" }, // Tomato
];

/** 로컬 캘린더의 임의 색을 Google 11색 중 체감상 가장 가까운 것으로 근사한다 */
export function nearestColorId(hex: string): string {
  let best = GOOGLE_EVENT_COLORS[0];
  let bestDist = Infinity;
  for (const c of GOOGLE_EVENT_COLORS) {
    const d = colorDistance(hex, c.hex);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.id;
}

// ── 변환 ──
/**
 * "자정 기준 분"을 절대 시각(UTC ISO)으로 바꾼다.
 *
 * 이 앱은 시간을 시간대 없이 저장하므로 "9시"는 사용자가 있는 곳의 9시다.
 * Date 생성자가 그 해석을 정확히 해 주고, 분이 1440(=24:00)을 넘어가면
 * 알아서 다음 날로 넘겨 준다 — endMin === 1440인 일정이 여기에 해당한다.
 */
export function toInstant(date: string, min: number): string {
  const d = fromDateStr(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, min).toISOString();
}

/** 로컬 일정 하나를 스크립트가 알아듣는 작업으로 바꾼다 */
export function toUpsertOp(
  ev: EventItem,
  cal: CalendarInfo | undefined,
  gcalId: string | undefined,
): UpsertOp {
  const title = ev.title.trim() || "(제목 없음)";
  return {
    kind: gcalId ? "patch" : "insert",
    localId: ev.id,
    gcalId,
    // 기본 캘린더 한 곳에 모이므로 어느 분류인지 제목에 남긴다
    title: cal ? `[${cal.name}] ${title}` : title,
    description: ev.memo ?? "",
    start: toInstant(ev.date, ev.startMin),
    end: toInstant(ev.date, ev.endMin),
    colorId: cal ? nearestColorId(cal.color) : undefined,
    reminderMinutes: ev.notify ? ev.notifyMinutesBefore : null,
  };
}

/**
 * 동기화 대상 필드만의 지문. 이 값이 그대로면 보낼 필요가 없다.
 * 캘린더 이름·색이 제목과 색에 들어가므로 함께 포함한다 — 캘린더 이름을
 * 바꾸면 소속 일정이 모두 갱신되어야 하기 때문이다.
 */
export function hashEvent(ev: EventItem, cal: CalendarInfo | undefined): string {
  return JSON.stringify([
    ev.title,
    ev.date,
    ev.startMin,
    ev.endMin,
    ev.memo ?? "",
    ev.notify,
    ev.notifyMinutesBefore,
    cal?.name ?? "",
    cal?.color ?? "",
  ]);
}
