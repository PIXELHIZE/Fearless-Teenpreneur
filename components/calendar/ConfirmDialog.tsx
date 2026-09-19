"use client";

import { useEffect, useRef } from "react";

interface Props {
  title: string;
  /** 부가 설명 (되돌릴 수 없음 등) */
  message?: string;
  /** 삭제 대상 목록 — 실제로 무엇이 지워지는지 눈으로 확인하는 2차 검증 */
  items?: string[];
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const MAX_SHOWN = 8;

/**
 * 앱 내부 확인 모달. 브라우저 기본 confirm() 대신 사용한다.
 * - Esc / 배경 클릭 / 취소 = 중단
 * - 진행은 빨간 버튼을 직접 눌러야만 됨 (Enter로는 실행되지 않음)
 * - 열릴 때 포커스는 "취소"에 두어 실수로 Enter를 눌러도 안전하다
 */
export default function ConfirmDialog({
  title,
  message,
  items,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    // capture 단계에서 먼저 처리해 캘린더 전역 단축키로 새지 않게 한다
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  const shown = items?.slice(0, MAX_SHOWN) ?? [];
  const rest = (items?.length ?? 0) - shown.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-lg">
            ⚠️
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base font-bold">
              {title}
            </h2>
            {message && (
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {message}
              </p>
            )}
          </div>
        </div>

        {items && items.length > 0 && (
          <ul className="mt-3 max-h-44 overflow-y-auto rounded-xl border border-border bg-background px-3 py-2 text-xs">
            {shown.map((t, i) => (
              <li
                key={i}
                className="truncate py-0.5 text-gray-600 before:mr-1.5 before:text-gray-300 before:content-['•']"
              >
                {t}
              </li>
            ))}
            {rest > 0 && (
              <li className="py-0.5 text-gray-400">…그 외 {rest}개</li>
            )}
          </ul>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-lg border border-border px-3.5 py-2 text-xs font-medium hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
