import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ClinicDirectoryGrid } from "@/components/shared/clinic-directory-grid";
import { ClinicCardSkeleton } from "@/components/shared/clinic-card";
import { ClinicSearchBar } from "@/components/shared/clinic-search-bar";
import { Button } from "@/components/ui/button";
import { SITE, HOW_IT_WORKS, TRUST_STATS } from "@/lib/constants";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "رزرو آنلاین نوبت کلینیک‌های زیبایی شیراز",
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: SITE.name,
    title: `${SITE.name} | رزرو آنلاین نوبت زیبایی`,
    description: SITE.description,
    url: "/",
  },
};

interface HomePageProps {
  searchParams: Promise<{ search?: string }>;
}

const HOW_IT_WORKS_ICONS = [Search, Sparkles, CalendarCheck] as const;

function DirectorySkeleton() {
  return (
    <section className="container pb-16 sm:pb-20">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-surface-strong" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <ClinicCardSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { search } = await searchParams;
  const query = search?.trim() ?? "";

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-hero pb-14 pt-12 sm:pb-16 sm:pt-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dotted opacity-70"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-28 -top-16 size-[30rem] rounded-full bg-rose-tint blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -end-24 bottom-0 size-80 rounded-full bg-champagne blur-3xl"
        />
        <div
          aria-hidden
          className="bg-grain pointer-events-none absolute inset-0 opacity-[0.07]"
        />

        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose/20 bg-white/80 px-4 py-1.5 text-xs font-semibold text-rose shadow-soft-sm backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              مرجع تخصصی زیبایی شهر شیراز
            </span>

            <h1 className="mt-5 text-[1.65rem] font-extrabold leading-[1.45] text-ink sm:text-4xl sm:leading-[1.4]">
              زیبایی‌تان را
              <br />
              <span className="text-gradient-rose">با خیال راحت رزرو کنید</span>
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-ink-muted sm:text-[15px]">
              کلینیک‌های تاییدشده شیراز را جستجو کنید، خدمات و تعرفه‌ها را مقایسه کنید
              و نوبت خود را روی تقویم شمسی — در کمتر از یک دقیقه — ثبت کنید.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            <ClinicSearchBar defaultValue={query} />
          </div>

          <dl className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
            {TRUST_STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/80 bg-white/75 px-3 py-4 text-center shadow-soft-sm backdrop-blur-sm sm:px-4 sm:py-5"
              >
                <dt className="text-lg font-extrabold text-gradient-rose num-fa sm:text-xl">
                  {stat.value}
                </dt>
                <dd className="mt-1.5 text-[11px] leading-5 text-ink-muted sm:text-xs">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Suspense key={query} fallback={<DirectorySkeleton />}>
        <ClinicDirectoryGrid search={query || undefined} />
      </Suspense>

      <section className="relative overflow-hidden bg-gradient-surface py-14 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-rose/20 to-transparent"
        />
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full border border-rose/15 bg-rose-tint/70 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-rose">
              ساده و مطمئن
            </span>
            <h2 className="mt-3 text-xl font-extrabold text-ink sm:text-2xl">
              در سه گام نوبت بگیرید
            </h2>
            <p className="mt-2 text-sm leading-7 text-ink-muted">
              از جستجو تا رزرو قطعی، مسیر کوتاه و شفاف است.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {HOW_IT_WORKS.map((item, index) => {
              const Icon = HOW_IT_WORKS_ICONS[index] ?? Sparkles;
              return (
                <div
                  key={item.step}
                  className="relative overflow-hidden rounded-3xl border border-rose/10 bg-white p-5 shadow-soft-sm sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-rose-tint text-rose">
                      <Icon className="size-4" />
                    </span>
                    <span className="text-2xl font-extrabold text-rose/20 num-fa">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-ink-muted">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container pb-14 sm:pb-16">
        <div className="relative grid gap-6 overflow-hidden rounded-[1.75rem] border border-rose/10 bg-gradient-to-l from-rose-tint via-white to-champagne p-6 shadow-soft sm:p-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div
            aria-hidden
            className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-rose/10 blur-3xl"
          />
          <div className="relative">
            <span className="inline-flex items-center rounded-full border border-rose/15 bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-rose">
              همکاری با ما
            </span>
            <h2 className="mt-3 text-xl font-extrabold leading-snug text-ink sm:text-2xl">
              کلینیک یا سالن زیبایی دارید؟
              <br />
              مراجعان بیشتری در شیراز پیدا کنید.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-ink-muted">
              پروفایل اختصاصی، مدیریت نوبت‌ها روی تقویم شمسی و گزارش عملکرد روزانه
              — همه در یک پنل ساده.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button asChild variant="primary">
                <Link href="/auth/login?role=clinic">
                  ثبت کلینیک
                  <ArrowLeft />
                </Link>
              </Button>
              <Button asChild variant="soft">
                <Link href="/dashboard/client/book">رزرو نوبت زیباجو</Link>
              </Button>
            </div>
          </div>

          <ul className="relative space-y-2.5">
            {[
              { icon: ShieldCheck, text: "نشان تاییدشده پس از احراز مجوز فعالیت" },
              {
                icon: CalendarDays,
                text: "مدیریت نوبت‌ها با تقویم شمسی و تعطیلات رسمی",
              },
              { icon: Sparkles, text: "دیده‌شدن در جستجوهای محلی شیراز" },
            ].map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/70 p-3 shadow-soft-sm backdrop-blur-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-tint text-rose">
                  <item.icon className="size-4" />
                </span>
                <span className="text-sm leading-6 text-ink">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
