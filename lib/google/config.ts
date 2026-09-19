"use client";

/**
 * Apps Script 웹앱 연결 설정.
 *
 * OAuth 대신 이 방식을 쓰는 이유: 사용자가 자기 Google 계정으로 스크립트를
 * 배포하면, 그 스크립트가 "사용자 본인으로" 실행된다. 앱은 그 URL로 요청만
 * 보내면 되므로 Cloud Console 등록도, 클라이언트 ID도, 만료되는 토큰도 없다.
 *
 * 그래서 이 앱이 보관하는 자격 증명은 배포 URL 하나다 — 추측할 수 없는 긴
 * 문자열이라 사실상 비밀번호다. 비밀 값은 선택적인 두 번째 겹이다.
 */

import { KEYS } from "@/lib/storage";
import { EndpointError, probeEndpoint } from "./api";

export type LinkStatus = "unconfigured" | "checking" | "connected" | "invalid";

export interface LinkConfig {
  url: string;
  secret: string;
}

export interface LinkState {
  status: LinkStatus;
  url: string;
  secret: string;
  /** Google 기본 캘린더 이름 — 연결이 실제로 살아 있다는 증거 */
  calendarName: string | null;
  error: string | null;
}

export const INITIAL_LINK: LinkState = {
  status: "unconfigured",
  url: "",
  secret: "",
  calendarName: null,
  error: null,
};

let linkState: LinkState = INITIAL_LINK;
const listeners = new Set<() => void>();

function setLinkState(patch: Partial<LinkState>) {
  linkState = { ...linkState, ...patch };
  for (const l of listeners) l();
}

export function subscribeLink(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getLinkState = () => linkState;
export const getLinkServerState = () => INITIAL_LINK;

export function getLinkConfig(): LinkConfig {
  return { url: linkState.url, secret: linkState.secret };
}

// ── 저장 ──
function readStored(): LinkConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEYS.gcalEndpoint);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LinkConfig>;
    if (typeof parsed?.url !== "string" || !parsed.url) return null;
    return { url: parsed.url, secret: parsed.secret ?? "" };
  } catch {
    return null;
  }
}

function writeStored(config: LinkConfig | null) {
  try {
    if (config) localStorage.setItem(KEYS.gcalEndpoint, JSON.stringify(config));
    else localStorage.removeItem(KEYS.gcalEndpoint);
  } catch {
    // 저장 실패는 이번 세션의 연결까지 막을 이유가 못 된다
  }
}

/** 배포 URL 형태인지 미리 걸러 낸다 — 오타를 네트워크 왕복 전에 잡는다 */
function urlProblem(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "주소 형식이 아닙니다. https://script.google.com/... 전체를 붙여넣어 주세요.";
  }
  if (parsed.protocol !== "https:") return "https:// 로 시작하는 주소여야 합니다.";
  if (!parsed.hostname.endsWith("script.google.com")) {
    return "Apps Script 배포 주소가 아닙니다. script.google.com 주소를 붙여넣어 주세요.";
  }
  if (!parsed.pathname.endsWith("/exec")) {
    return "/exec 로 끝나는 주소여야 합니다. /dev 주소는 본인만 열 수 있어 쓸 수 없습니다.";
  }
  return null;
}

/**
 * 연결을 확인한다. 실패 원인을 구분하는 것이 요점이다 —
 * 설정이 틀린 것(invalid)과 잠시 네트워크가 끊긴 것은 다르게 다뤄야 한다.
 */
async function verify(config: LinkConfig): Promise<void> {
  setLinkState({ status: "checking", error: null });
  try {
    const { calendarName } = await probeEndpoint(config.url, config.secret);
    setLinkState({ status: "connected", calendarName, error: null });
  } catch (e) {
    if (e instanceof EndpointError && e.kind === "network") {
      // 연결 자체는 유효할 수 있다. 동기화 계층이 오프라인으로 표시하고 재시도한다.
      setLinkState({ status: "connected", error: null });
      return;
    }
    setLinkState({
      status: "invalid",
      calendarName: null,
      error: e instanceof Error ? e.message : "연결을 확인하지 못했습니다.",
    });
  }
}

/** 마운트 시 1회 — 저장된 설정을 복원하고 살아 있는지 확인한다 */
export async function restoreLink(): Promise<void> {
  if (linkState.status !== "unconfigured" || linkState.url) return;
  const stored = readStored();
  if (!stored) return;
  setLinkState({ url: stored.url, secret: stored.secret });
  await verify(stored);
}

/** 사용자가 설정 양식을 저장했을 때. 연결에 성공했는지를 돌려준다. */
export async function saveLink(
  urlInput: string,
  secret: string,
): Promise<boolean> {
  const url = urlInput.trim();
  const problem = urlProblem(url);
  if (problem) {
    setLinkState({ url, secret, status: "invalid", error: problem });
    return false;
  }

  const config: LinkConfig = { url, secret: secret.trim() };
  setLinkState({ ...config, calendarName: null });
  await verify(config);

  // 확인에 성공한 설정만 남긴다 — 틀린 값이 다음 실행까지 따라오지 않게
  if (linkState.status !== "connected") return false;
  writeStored(config);
  return true;
}

/** 연결 확인만 다시 (설정은 그대로) */
export async function recheckLink(): Promise<void> {
  if (!linkState.url) return;
  await verify(getLinkConfig());
}

/**
 * 연결 해제.
 *
 * 대응표(links)는 일부러 남긴다 — 지우면 다시 연결할 때 Google에 전부 중복으로
 * 올라간다. 다른 계정으로 바꿨다면 대응표의 id가 그 계정에 없으므로 스크립트가
 * 새로 만들어 스스로 복구한다.
 */
export function disconnectLink() {
  writeStored(null);
  linkState = INITIAL_LINK;
  for (const l of listeners) l();
}
