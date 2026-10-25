"use client";

import { CalendarCheck, Menu, Phone, User, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { useScrolled } from "@/hooks/use-scrolled";
import { useSession } from "@/hooks/use-session";
import { MAIN_NAV, SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled(16);
  const { isAuthenticated, dashboardHref } = useSession();
  const accountHref = isAuthenticated ? dashboardHref : "/auth/login";
  const accountLabel = isAuthenticated ? "پنل من" : "ورود / ثبت‌نام";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "glass-panel border-b border-border/80 shadow-soft-sm"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-5 sm:h-[4.25rem]">
        <Link href="/" className="flex items-center gap-3" aria-label={SITE.name}>
          <BrandMark />
          <span className="flex flex-col leading-none">
            <span className="text-base font-extrabold tracking-tight text-ink">
              {SITE.name}
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.32em] text-rose">
              Shiraz Beauty
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {item.label}
              <span className="absolute inset-x-4 bottom-1 h-px origin-center scale-x-0 bg-gradient-rose transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={`tel:${SITE.phoneHref}`}
            className="flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <Phone className="size-4 text-rose" />
            <span className="num-fa">{SITE.phone}</span>
          </a>
          <Button asChild variant="soft" size="sm">
            <Link href="/dashboard/client/book">
              <CalendarCheck />
              رزرو نوبت
            </Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href={accountHref}>
              <User />
              {accountLabel}
            </Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "بستن منو" : "باز کردن منو"}
          aria-expanded={open}
          className="flex size-11 items-center justify-center rounded-xl border border-border bg-white text-ink transition-colors hover:border-rose/30 hover:text-rose lg:hidden"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open ? (
        <div className="glass-panel border-t border-border lg:hidden">
          <nav className="container flex flex-col py-4">
            {MAIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-border py-3 text-sm font-medium text-ink last:border-none"
              >
                {item.label}
              </Link>
            ))}
            <Button asChild variant="soft" className="mt-4 w-full">
              <Link href="/dashboard/client/book" onClick={() => setOpen(false)}>
                <CalendarCheck />
                رزرو نوبت
              </Link>
            </Button>
            <Button asChild variant="primary" className="mt-2 w-full">
              <Link href={accountHref} onClick={() => setOpen(false)}>
                <User />
                {accountLabel}
              </Link>
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
