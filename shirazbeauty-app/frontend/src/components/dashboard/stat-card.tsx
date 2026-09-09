import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "azure" | "mint" | "amber" | "neutral";
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  azure: "bg-azure-tint text-azure",
  mint: "bg-mint/12 text-mint",
  amber: "bg-amber/15 text-amber",
  neutral: "bg-surface text-ink-muted",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "azure",
}: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-soft-sm transition-shadow hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs text-ink-muted">{label}</span>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            TONES[tone],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-extrabold text-ink num-fa">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}
