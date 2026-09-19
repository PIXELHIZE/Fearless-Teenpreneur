import { type ComponentProps, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "cn";

export function List({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="list" className={cn("teum-list", className)} {...props} />;
}

type ListItemProps = Omit<ComponentProps<"button">, "title" | "children"> & {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
};

/** Leading/trailing slots are presentational; do not nest interactive controls. */
export function ListItem({ title, description, leading, trailing = <ChevronRight aria-hidden="true" size={18} />, className, ...props }: ListItemProps) {
  return <li><button type="button" data-slot="list-item" className={cn("teum-list-item", className)} {...props}>
    {leading && <span className="list-item-leading" aria-hidden="true">{leading}</span>}
    <span className="list-item-copy"><span className="list-item-title">{title}</span>{description && <span className="list-item-description">{description}</span>}</span>
    {trailing && <span className="list-item-trailing">{trailing}</span>}
  </button></li>;
}
