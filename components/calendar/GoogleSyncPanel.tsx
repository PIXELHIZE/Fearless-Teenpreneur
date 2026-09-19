"use client";

import { useState } from "react";
import {
  disconnectLink,
  LinkState,
  recheckLink,
  saveLink,
} from "@/lib/google/config";
import { reconcile, resetSync, SyncState } from "@/lib/google/sync";

interface Props {
  link: LinkState;
  sync: SyncState;
}

/** 사이드바 하단의 Google 캘린더 연동 상태 */
export default function GoogleSyncPanel({ link, sync }: Props) {
  // 양식은 "지금 편집 중인가"로만 열고 닫는다 — null이면 닫힘
  const [draft, setDraft] = useState<{ url: string; secret: string } | null>(
    null,
  );

  const openForm = () => setDraft({ url: link.url, secret: link.secret });

  const submit = async () => {
    if (!draft) return;
    // 실패하면 사용자가 고칠 수 있도록 양식을 열어 둔다
    if (await saveLink(draft.url, draft.secret)) setDraft(null);
  };

  if (draft !== null) {
    return (
      <SetupForm
        draft={draft}
        setDraft={setDraft}
        onSubmit={submit}
        onCancel={() => setDraft(null)}
        checking={link.status === "checking"}
        error={link.status === "invalid" ? link.error : null}
        canCancel={link.status === "connected"}
      />
    );
  }

  if (link.status === "unconfigured") {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          onClick={openForm}
          className="w-full rounded-lg border border-border py-2 text-xs font-semibold hover:bg-gray-50"
        >
          📆 Google 캘린더 연결
        </button>
        <p className="text-center text-[10px] leading-snug text-gray-400">
          Google 계정으로 스크립트를 한 번 배포하면 됩니다
          <br />
          <span className="text-gray-300">README의 설정 절차를 참고하세요</span>
        </p>
      </div>
    );
  }

  if (link.status === "checking") {
    return (
      <p className="text-center text-[11px] text-gray-400">연결 확인 중...</p>
    );
  }

  if (link.status === "invalid") {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-center text-[11px] leading-snug text-amber-600">
          Google 연결에 문제가 있습니다
        </p>
        {link.error && (
          <p className="text-[10px] leading-snug text-gray-500">{link.error}</p>
        )}
        <div className="flex gap-1.5">
          <button
            onClick={openForm}
            className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            설정 고치기
          </button>
          <button
            onClick={() => void recheckLink()}
            className="rounded-lg border border-border px-2 text-[10px] text-gray-500 hover:bg-gray-50"
          >
            다시 확인
          </button>
        </div>
      </div>
    );
  }

  // 연결됨 — 동기화 상태를 보여준다
  const statusLine = (() => {
    if (sync.status === "offline")
      return { text: "오프라인 · 연결되면 자동 전송", tone: "text-gray-400" };
    if (sync.status === "syncing")
      return { text: `동기화 중... ${sync.pending}개 남음`, tone: "text-gray-500" };
    if (sync.status === "error")
      return {
        text: sync.pending > 0 ? `${sync.pending}개 대기 · 재시도 중` : "재시도 중",
        tone: "text-rose-600",
      };
    return { text: "모두 동기화됨", tone: "text-emerald-600" };
  })();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-xs">📆</span>
        <span
          className="min-w-0 flex-1 truncate text-[11px] text-gray-600"
          title={link.calendarName ?? undefined}
        >
          {link.calendarName ?? "Google 캘린더 연결됨"}
        </span>
        <button
          onClick={openForm}
          className="shrink-0 text-[10px] text-gray-400 hover:text-gray-600"
        >
          설정
        </button>
        <button
          onClick={() => {
            disconnectLink();
            resetSync();
          }}
          className="shrink-0 text-[10px] text-gray-400 hover:text-red-400"
        >
          해제
        </button>
      </div>

      <p className={`text-[10px] ${statusLine.tone}`}>{statusLine.text}</p>

      {sync.status === "error" && sync.error && (
        <p className="text-[10px] leading-snug text-gray-400">{sync.error}</p>
      )}

      {sync.status === "error" && (
        <button
          onClick={() => void reconcile()}
          className="self-start text-[10px] text-primary hover:underline"
        >
          지금 다시 시도
        </button>
      )}
    </div>
  );
}

interface FormProps {
  draft: { url: string; secret: string };
  setDraft: (d: { url: string; secret: string }) => void;
  onSubmit: () => void;
  onCancel: () => void;
  checking: boolean;
  error: string | null;
  canCancel: boolean;
}

function SetupForm({
  draft,
  setDraft,
  onSubmit,
  onCancel,
  checking,
  error,
  canCancel,
}: FormProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] leading-snug text-gray-500">
        <a
          href="/google-apps-script.gs"
          download
          className="text-primary hover:underline"
        >
          스크립트 코드 받기
        </a>{" "}
        → script.google.com에 붙여넣고 웹 앱으로 배포 → 나온 주소를 아래에
        붙여넣으세요. 자세한 절차는 README를 보세요.
      </p>

      <input
        value={draft.url}
        onChange={(e) => setDraft({ ...draft, url: e.target.value })}
        placeholder="https://script.google.com/.../exec"
        spellCheck={false}
        autoFocus
        className="rounded-md border border-border bg-white px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-primary"
      />
      <input
        value={draft.secret}
        onChange={(e) => setDraft({ ...draft, secret: e.target.value })}
        placeholder="비밀 값 (스크립트에 넣었을 때만)"
        spellCheck={false}
        className="rounded-md border border-border bg-white px-2 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-primary"
      />

      {error && (
        <p className="text-[10px] leading-snug text-rose-600">{error}</p>
      )}

      <div className="flex gap-1.5">
        <button
          onClick={onSubmit}
          disabled={checking || draft.url.trim().length === 0}
          className="flex-1 rounded-md bg-primary py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {checking ? "확인 중..." : "연결"}
        </button>
        {canCancel && (
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-2 text-[10px] text-gray-500 hover:bg-gray-50"
          >
            취소
          </button>
        )}
      </div>

      <p className="text-[10px] leading-snug text-gray-400">
        이 주소는 비밀번호와 같습니다. 아는 사람은 누구나 회원님 캘린더에 일정을
        쓸 수 있으니 공유하지 마세요.
      </p>
    </div>
  );
}
