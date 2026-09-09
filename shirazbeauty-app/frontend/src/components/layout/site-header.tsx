"use client";

import { Menu, Phone, User, X } from "lucide-react";
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
          ? "glass-panel border-b border-border shadow-soft-sm"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="container flex h-20 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3" aria-label={SITE.name}>
          <BrandMark />
          <span className="flex flex-col leading-none">
            <span className="text-lg font-extrabold tracking-tight text-ink">
              {SITE.name}
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.32em] text-azure">
              Shiraz Beauty
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {item.label}
              <span className="absolute inset-x-4 bottom-1 h-px origin-center scale-x-0 bg-gradient-azure transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={`tel:${SITE.phoneHref}`}
            className="flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <Phone className="size-4 text-azure" />
            <span className="num-fa">{SITE.phone}</span>
          </a>
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
          className="flex size-11 items-center justify-center rounded-xl border border-border bg-white text-ink lg:hidden"
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
            <Button asChild variant="primary" className="mt-4 w-full">
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
