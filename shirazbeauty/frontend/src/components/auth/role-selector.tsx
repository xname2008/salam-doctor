"use client";

import { Building2, Check, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export type AuthRole = "client" | "clinic";

const ROLES = [
  {
    value: "client" as const,
    label: "ورود زیباجو",
    description: "می‌خواهم نوبت بگیرم",
    icon: Sparkles,
  },
  {
    value: "clinic" as const,
    label: "ورود کلینیک",
    description: "مرکز زیبایی دارم",
    icon: Building2,
  },
];

interface RoleSelectorProps {
  value: AuthRole;
  onChange: (role: AuthRole) => void;
  disabled?: boolean;
}

export function RoleSelector({ value, onChange, disabled = false }: RoleSelectorProps) {
  return (
    <div role="radiogroup" aria-label="نوع حساب کاربری" className="grid grid-cols-2 gap-3">
      {ROLES.map((role) => {
        const selected = value === role.value;

        return (
          <button
            key={role.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(role.value)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-start transition-all duration-200",
              selected
                ? "border-rose bg-rose-tint shadow-soft-sm"
                : "border-border bg-white hover:border-rose/40 hover:bg-surface",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {selected ? (
              <span className="absolute end-3 top-3 flex size-5 items-center justify-center rounded-full bg-rose text-white">
                <Check className="size-3" />
              </span>
            ) : null}

            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl transition-colors",
                selected ? "bg-rose text-white" : "bg-surface text-rose",
              )}
            >
              <role.icon className="size-5" />
            </span>

            <span className="text-sm font-bold text-ink">{role.label}</span>
            <span className="text-[11px] leading-5 text-ink-muted">
              {role.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
