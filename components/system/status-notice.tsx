import { Check, Info, X, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function StatusNotice({ tone = "info", title, children }: { tone?: "info" | "success" | "error" | "warning"; title: string; children?: ReactNode }) {
  const Icon = { info: Info, success: Check, error: X, warning: AlertCircle }[tone];
  return <div className={`status-notice status-${tone}`} role={tone === "error" ? "alert" : "status"}>
    <Icon size={20} aria-hidden="true" /><div><strong>{title}</strong>{children && <p>{children}</p>}</div>
  </div>;
}
