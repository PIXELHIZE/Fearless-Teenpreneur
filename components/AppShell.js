'use client';

import { useRouter } from 'next/navigation';

function StatusBar() {
  return (
    <div className="statusbar" aria-hidden="true">
      <span>9:41</span>
      <span className="statusbar-dots">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

export default function AppShell({ title, back = false, right = null, footer = null, children }) {
  const router = useRouter();

  return (
    <div className="screen">
      <StatusBar />
      <header className="appbar">
        {back ? (
          <button
            type="button"
            className="appbar-btn"
            onClick={() => router.push('/')}
            aria-label="홈으로 이동"
          >
            ‹
          </button>
        ) : (
          <span />
        )}
        <h1 className="appbar-title">{title}</h1>
        <span>{right}</span>
      </header>
      <main className="content">{children}</main>
      {footer ? <div className="footer">{footer}</div> : null}
    </div>
  );
}
