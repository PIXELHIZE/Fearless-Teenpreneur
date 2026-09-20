import type { ReactNode } from "react";

/** 탭 화면의 큰 제목. 본문과 함께 스크롤된다. */
export function PageHead({ title, subtitle, side }: { title: ReactNode; subtitle?: ReactNode; side?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {side ? <div className="page-head-side">{side}</div> : null}
    </header>
  );
}
