"use client";

import { type ComponentProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

type PaginationProps = ComponentProps<"nav"> & {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, pageCount, onPageChange, className, ...props }: PaginationProps) {
  const count = Number.isFinite(pageCount) ? Math.max(1, Math.floor(pageCount)) : 1;
  const current = Number.isFinite(page) ? Math.min(count, Math.max(1, Math.floor(page))) : 1;
  const start = Math.max(1, Math.min(current - 1, count - 2));
  const pages = Array.from({ length: Math.min(3, count) }, (_, i) => start + i);
  return <nav aria-label="페이지 선택" data-slot="pagination" className={cn("teum-pagination", className)} {...props}>
    <Button type="button" variant="ghost" shape="pill" size="icon" aria-label="이전 페이지" disabled={current === 1} onClick={() => onPageChange(current - 1)}><ChevronLeft /></Button>
    {pages.map(n => <Button type="button" key={n} variant={n === current ? "default" : "ghost"} size="icon" shape="pill" aria-current={n === current ? "page" : undefined} aria-label={`${n}페이지`} onClick={() => onPageChange(n)}>{n}</Button>)}
    <Button type="button" variant="ghost" shape="pill" size="icon" aria-label="다음 페이지" disabled={current === count} onClick={() => onPageChange(current + 1)}><ChevronRight /></Button>
  </nav>;
}
