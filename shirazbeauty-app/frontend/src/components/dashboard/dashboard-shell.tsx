"use client";

import { Bell, ChevronDown, LogOut, Menu, Settings, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/hooks/use-session";
import { CLIENT_NAV, CLINIC_NAV } from "@/lib/dashboard-nav";
import { formatJalali, todayJalali } from "@/lib/jalali";
import { maskMobile } from "@/lib/utils";

interface DashboardShellProps {
  /** Selects the nav set. Icons are React components, so the shell resolves
   *  them on the client rather than receiving them as props from a layout. */
  panel: "client" | "clinic";
  panelLabel: string;
  profileHref: string;
  children: ReactNode;
}

const FALLBACK_NAME: Record<DashboardShellProps["panel"], string> = {
  client: "زیباجو",
  clinic: "مدیر کلینیک",
};

export function DashboardShell({
  panel,
  panelLabel,
  profileHref,
  children,
}: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useSession();
  const items = panel === "clinic" ? CLINIC_NAV : CLIENT_NAV;
  const today = formatJalali(todayJalali(), { withWeekday: true });
  const userName = FALLBACK_NAME[panel];
  const userMeta = user ? maskMobile(user.mobile_number) : "وارد نشده";
  const initials = userName.trim().charAt(0);

  return (
    <div className="min-h-dvh bg-surface">
      {/* Desktop sidebar — fixed to the start (right) edge in RTL. */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-72 lg:block">
        <DashboardSidebar items={items} panelLabel={panelLabel} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="بستن منو"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 start-0 w-72 animate-fade-up">
            <DashboardSidebar
              items={items}
              panelLabel={panelLabel}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
          <button
            type="button"
            aria-label="بستن منو"
            onClick={() => setDrawerOpen(false)}
            className="absolute end-4 top-5 flex size-10 items-center justify-center rounded-xl bg-white text-ink shadow-soft"
          >
            <X className="size-5" />
          </button>
        </div>
      ) : null}

      <div className="lg:ps-72">
        <header className="sticky top-0 z-30 border-b border-border bg-white/85 backdrop-blur-xl">
          <div className="flex h-20 items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="باز کردن منو"
                className="flex size-10 items-center justify-center rounded-xl border border-border bg-white text-ink lg:hidden"
              >
                <Menu className="size-5" />
              </button>
              <div className="hidden flex-col leading-none sm:flex">
                <span className="text-sm font-semibold text-ink">{panelLabel}</span>
                <span className="mt-1.5 text-xs text-ink-muted num-fa">{today}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="اعلان‌ها"
                className="relative flex size-10 items-center justify-center rounded-xl border border-border bg-white text-ink-muted transition-colors hover:text-azure"
              >
                <Bell className="size-4" />
                <span className="absolute end-2.5 top-2.5 size-2 rounded-full bg-destructive ring-2 ring-white" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 rounded-xl border border-border bg-white px-2 py-1.5 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure/40">
                  <Avatar className="size-9">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden flex-col items-start leading-none sm:flex">
                    <span className="text-xs font-semibold text-ink">{userName}</span>
                    <span className="mt-1 text-[11px] text-ink-muted num-fa">
                      {userMeta}
                    </span>
                  </span>
                  <ChevronDown className="size-4 text-ink-muted" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{userName}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={profileHref}>
                      <UserRound />
                      پروفایل
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={profileHref}>
                      <Settings />
                      تنظیمات حساب
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <SignOutButton className="w-full text-destructive">
                      <LogOut />
                      خروج از حساب
                    </SignOutButton>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
