"use client";

interface Props {
  count: number;
  totalInView: number;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
}

/**
 * 다중 선택 중일 때만 화면 하단에 떠오르는 일괄 작업 바.
 * 우클릭으로 선택한 일정들을 한 번에 삭제한다.
 */
export default function SelectionBar({
  count,
  totalInView,
  onSelectAll,
  onClear,
  onDelete,
}: Props) {
  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-xl">
        <span className="px-1 text-sm font-semibold">
          <span className="text-primary">{count}</span>개 선택됨
        </span>

        <span className="h-5 w-px bg-border" />

        <button
          onClick={onSelectAll}
          disabled={count >= totalInView}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
        >
          현재 보기 전체 선택
        </button>
        <button
          onClick={onClear}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
        >
          선택 해제
        </button>

        <button
          onClick={onDelete}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
        >
          {count}개 삭제
        </button>

        <span className="hidden px-1 text-[10px] text-gray-300 sm:block">
          Delete 삭제 · Esc 해제
        </span>
      </div>
    </div>
  );
}
