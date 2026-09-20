"use client";

import { type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";

type BottomNavigationProps = ComponentProps<"nav"> & {
  items: { value: string; label: string; icon: ReactNode; disabled?: boolean }[];
  value: string;
  onValueChange: (value: string) => void;
};

export function BottomNavigation({ items, value, onValueChange, className, ...props }: BottomNavigationProps) {
  return <nav aria-label="하단 내비게이션" data-slot="bottom-navigation" className={cn("bottom-navigation", className)} {...props}>
    {items.map(item => <button key={item.value} type="button" disabled={item.disabled} aria-current={value === item.value ? "page" : undefined} onClick={() => onValueChange(item.value)}>
      <span className="bottom-navigation-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
    </button>)}
  </nav>;
}
