"use client";

import { useId, useRef, type ComponentProps } from "react";
import { Search, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

type SearchFieldProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "size"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  clearLabel?: string;
};

export function SearchField({ label, value, onValueChange, clearLabel = "검색어 지우기", className, id, disabled, ...props }: SearchFieldProps) {
  const generatedId = useId();
  const input = useRef<HTMLInputElement>(null);
  const inputId = id ?? generatedId;
  return <div data-slot="search-field" className={cn("search-field", className)} data-disabled={disabled || undefined}>
    <label className="sr-only" htmlFor={inputId}>{label}</label>
    <Search aria-hidden="true" size={20} />
    <input {...props} ref={input} id={inputId} type="search" value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)} />
    {value && <Button type="button" variant="ghost" shape="pill" size="icon" disabled={disabled} aria-label={clearLabel} onClick={() => { onValueChange(""); input.current?.focus(); }}><X /></Button>}
  </div>;
}
