"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { BrandMark } from "@/components/shared/brand-mark";
import { SITE } from "@/lib/constants";
import type { DashboardNavItem } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

interface DashboardSidebarProps {
  items: DashboardNavItem[];
  panelLabel: string;
  onNavigate?: () => void;
}

export function DashboardSidebar({
  items,
  panelLabel,
  onNavigate,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col border-e border-border bg-white">
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-border px-6">
        <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
          <BrandMark className="size-9" />
          <span className="flex flex-col leading-none">
            <span className="text-base font-extrabold text-ink">{SITE.name}</span>
            <span className="mt-1 text-[10px] font-medium text-azure">{panelLabel}</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {items.map((item) => {
          // The panel root must match exactly, or it stays active on every child page.
          const isRoot = item.href.split("/").length === 3;
          const active = isRoot
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-start gap-3 rounded-2xl px-4 py-3 transition-all duration-200",
                active
                  ? "bg-azure-tint text-azure shadow-soft-sm"
                  : "text-ink-muted hover:bg-surface hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                  active
                    ? "bg-azure text-white"
                    : "bg-surface text-ink-muted group-hover:text-azure",
                )}
              >
                <item.icon className="size-4" />
              </span>
              <span className="flex flex-col">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    active ? "text-azure" : "text-ink",
                  )}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 text-[11px] leading-5 text-ink-muted">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border p-4">
        <SignOutButton
          onSignOut={onNavigate}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-ink-muted transition-colors hover:bg-destructive/5 hover:text-destructive"
        >
          <LogOut className="size-4" />
          خروج از حساب
        </SignOutButton>
      </div>
    </div>
  );
}
