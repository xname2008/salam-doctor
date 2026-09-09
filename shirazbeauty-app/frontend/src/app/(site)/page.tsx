import { ArrowLeft, CalendarCheck, ShieldCheck, Sparkles } from "lucide-react";
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

function DirectorySkeleton() {
  return (
    <section className="container pb-24 sm:pb-28">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-strong" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
      <section className="relative overflow-hidden bg-gradient-surface pb-16 pt-14 sm:pb-20 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-full bg-dotted opacity-60"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-32 top-0 size-[28rem] rounded-full bg-azure-tint blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -end-20 bottom-0 size-72 rounded-full bg-azure/10 blur-3xl"
        />

        <div className="container relative">
          <div className="mx-auto max-w-4xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-azure/25 bg-white/90 px-4 py-1.5 text-xs font-semibold text-azure shadow-soft-sm backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              مرجع تخصصی زیبایی شهر شیراز
            </span>

            <h1 className="mt-7 text-3xl font-extrabold leading-[1.55] text-ink sm:text-5xl sm:leading-[1.45]">
              رزرو آنلاین نوبت
              <br />
              <span className="text-gradient-azure">بهترین کلینیک‌های زیبایی شیراز</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-sm leading-9 text-ink-muted sm:text-base">
              کلینیک‌های تاییدشده را جستجو کنید، خدمات و تعرفه‌ها را مقایسه کنید و
              نوبت خود را روی تقویم شمسی — در کمتر از یک دقیقه — ثبت کنید.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <ClinicSearchBar defaultValue={query} />
          </div>

          <dl className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {TRUST_STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/60 bg-white/80 p-4 text-center shadow-soft-sm backdrop-blur-sm sm:p-5"
              >
                <dt className="text-xl font-extrabold text-gradient-azure num-fa sm:text-2xl">
                  {stat.value}
                </dt>
                <dd className="mt-2 text-[11px] leading-6 text-ink-muted sm:text-xs">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Suspense
        key={query}
        fallback={<DirectorySkeleton />}
      >
        <ClinicDirectoryGrid search={query || undefined} />
      </Suspense>

      <section className="bg-gradient-surface py-20 sm:py-24">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-azure">
              ساده و مطمئن
            </span>
            <h2 className="mt-3 text-2xl font-extrabold text-ink sm:text-3xl">
              در سه گام نوبت بگیرید
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="relative overflow-hidden rounded-3xl border border-azure/10 bg-white p-8 shadow-soft-sm"
              >
                <span className="absolute -top-3 start-6 text-5xl font-extrabold text-surface-strong num-fa">
                  {item.step}
                </span>
                <div className="relative pt-8">
                  <h3 className="text-lg font-bold text-ink">{item.title}</h3>
                  <p className="mt-3 text-sm leading-8 text-ink-muted">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container pb-16 sm:pb-20">
        <div className="grid gap-8 overflow-hidden rounded-[2rem] border border-azure/10 bg-white p-8 shadow-soft sm:p-12 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.28em] text-azure">
              همکاری با ما
            </span>
            <h2 className="mt-4 text-2xl font-extrabold leading-[1.7] text-ink sm:text-3xl">
              کلینیک یا سالن زیبایی دارید؟
              <br />
              مراجعان بیشتری در شیراز پیدا کنید.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-8 text-ink-muted">
              پروفایل اختصاصی، مدیریت نوبت‌ها روی تقویم شمسی و گزارش عملکرد روزانه
              — همه در یک پنل ساده.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="primary" size="lg">
                <Link href="/auth/login?role=clinic">
                  ثبت کلینیک
                  <ArrowLeft />
                </Link>
              </Button>
              <Button asChild variant="soft" size="lg">
                <Link href="/dashboard/client/book">رزرو نوبت زیباجو</Link>
              </Button>
            </div>
          </div>

          <ul className="space-y-4">
            {[
              { icon: ShieldCheck, text: "نشان تاییدشده پس از احراز مجوز فعالیت" },
              {
                icon: CalendarCheck,
                text: "مدیریت نوبت‌ها با تقویم شمسی و تعطیلات رسمی",
              },
              { icon: Sparkles, text: "دیده‌شدن در جستجوهای محلی شیراز" },
            ].map((item) => (
              <li
                key={item.text}
                className="flex items-center gap-4 rounded-2xl bg-azure-tint/40 p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-azure shadow-soft-sm">
                  <item.icon className="size-5" />
                </span>
                <span className="text-sm leading-7 text-ink">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
