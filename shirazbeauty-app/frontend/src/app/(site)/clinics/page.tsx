import type { Metadata } from "next";
import { Suspense } from "react";

import { ClinicCardSkeleton } from "@/components/shared/clinic-card";
import { ClinicDirectoryGrid } from "@/components/shared/clinic-directory-grid";
import { ClinicSearchBar } from "@/components/shared/clinic-search-bar";
import { SectionHeading } from "@/components/shared/section-heading";
import { SITE } from "@/lib/constants";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "کلینیک‌های زیبایی شیراز",
  description:
    "فهرست کلینیک‌های تاییدشده زیبایی، پوست و مو در شیراز. جستجو، مقایسه خدمات و رزرو آنلاین نوبت.",
  alternates: { canonical: "/clinics" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: SITE.name,
    title: `کلینیک‌های زیبایی شیراز | ${SITE.name}`,
    description: SITE.description,
    url: "/clinics",
  },
};

interface ClinicsPageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function ClinicsDirectoryPage({
  searchParams,
}: ClinicsPageProps) {
  const { search } = await searchParams;
  const query = search?.trim() ?? "";

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-surface pb-12 pt-14 sm:pb-16 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dotted opacity-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-24 top-0 size-96 rounded-full bg-azure-tint blur-3xl"
        />

        <div className="container relative">
          <SectionHeading
            align="start"
            eyebrow="فهرست مراکز"
            title="جستجوی کلینیک‌های زیبایی شیراز"
            description="نام مرکز یا منطقه را جستجو کنید و مستقیما به صفحه رزرو نوبت بروید."
          />
          <div className="mt-8 max-w-3xl">
            <ClinicSearchBar defaultValue={query} action="/clinics" />
          </div>
        </div>
      </section>

      <Suspense
        key={query}
        fallback={
          <section className="container pb-24">
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <ClinicCardSkeleton key={index} />
              ))}
            </div>
          </section>
        }
      >
        <ClinicDirectoryGrid search={query || undefined} />
      </Suspense>
    </>
  );
}
