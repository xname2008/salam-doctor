import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-tint text-rose">
        <Icon className="size-6" />
      </span>
      <h3 className="mt-5 text-base font-bold text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-8 text-ink-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
