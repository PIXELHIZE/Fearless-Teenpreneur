import { type ComponentProps, type ReactNode } from "react";
import { cn } from "cn";

type EmptyStateProps = Omit<ComponentProps<"div">, "title"> & {
  icon?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return <div data-slot="empty-state" className={cn("empty-state", className)} {...props}>
    {icon && <span className="empty-state-icon" aria-hidden="true">{icon}</span>}
    <div><p className="empty-state-title">{title}</p><p className="empty-state-description">{description}</p></div>
    {action && <div className="empty-state-action">{action}</div>}
  </div>;
}
