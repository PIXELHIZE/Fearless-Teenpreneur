"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 상세 화면의 얇은 상단 바. 뒤로가기 또는 닫기 하나만 둔다. */
export function DetailBar({
  title,
  subtitle,
  close = false,
  href,
  side,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  close?: boolean;
  href?: string;
  side?: ReactNode;
}) {
  const router = useRouter();
  const Icon = close ? X : ChevronLeft;
  return (
    <header className="detail-bar">
      <Button
        variant="ghost"
        size="icon"
        aria-label={close ? "닫기" : "뒤로"}
        onClick={() => (href ? router.push(href) : router.back())}
      >
        <Icon aria-hidden />
      </Button>
      <div className="detail-bar-title">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      {side}
    </header>
  );
}
