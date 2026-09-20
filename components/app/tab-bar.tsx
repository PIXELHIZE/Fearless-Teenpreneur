"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarDays, House, NotebookPen, UserRound } from "lucide-react";

/** 홈이 가운데에 오도록 배치한다. 탭마다 고유색이 있다. */
const TABS = [
  { href: "/lessons", label: "수업", icon: CalendarCheck, tone: "var(--ok-ink)", soft: "var(--ok-soft)" },
  { href: "/note", label: "AI 노트", icon: NotebookPen, tone: "var(--grape-ink)", soft: "var(--grape-soft)" },
  { href: "/home", label: "홈", icon: House, tone: "var(--brand)", soft: "var(--brand-soft)" },
  { href: "/calendar", label: "스케줄", icon: CalendarDays, tone: "var(--sun-ink)", soft: "var(--sun-soft)" },
  { href: "/me", label: "내 정보", icon: UserRound, tone: "var(--flame-ink)", soft: "var(--flame-soft)" },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="app-tabbar" aria-label="하단 내비게이션">
      <div className="app-tabbar-inner">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="app-tab"
              aria-current={active ? "page" : undefined}
              style={{ ["--tab" as string]: tab.tone, ["--tab-soft" as string]: tab.soft }}
            >
              <span className="app-tab-icon" aria-hidden>
                <Icon />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
