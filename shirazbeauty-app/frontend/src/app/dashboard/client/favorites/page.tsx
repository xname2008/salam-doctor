import { ArrowLeft, Heart, MapPin, Search, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SAVED_CLINICS } from "@/lib/dashboard-data";
import { formatToman, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "مراکز علاقه‌مندی" };

export default function ClientFavoritesPage() {
  if (!SAVED_CLINICS.length) {
    return (
      <>
        <PageHeader title="مراکز علاقه‌مندی" />
        <EmptyState
          icon={Heart}
          title="هنوز مرکزی ذخیره نکرده‌اید"
          description="با زدن نشان قلب روی هر کلینیک، آن را برای مراجعه بعدی ذخیره کنید."
          action={
            <Button asChild>
              <Link href="/clinics">جستجوی کلینیک</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="مراکز علاقه‌مندی"
        description="کلینیک‌ها و سالن‌هایی که برای مراجعه بعدی ذخیره کرده‌اید."
        action={
          <Button asChild variant="outline">
            <Link href="/clinics">
              <Search />
              جستجوی مراکز بیشتر
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {SAVED_CLINICS.map((clinic) => (
          <article
            key={clinic.id}
            className="group flex flex-col rounded-2xl border border-border bg-white p-5 shadow-soft-sm transition-all duration-300 hover:-translate-y-1 hover:border-azure/35 hover:shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold text-ink transition-colors group-hover:text-azure">
                {clinic.name}
              </h2>
              <button
                type="button"
                aria-label={`حذف ${clinic.name} از علاقه‌مندی‌ها`}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-azure-tint text-azure transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Heart className="size-4 fill-current" />
              </button>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
              <MapPin className="size-3.5 text-azure" />
              {clinic.district}
            </p>

            <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
              <Star className="size-3.5 fill-amber text-amber" />
              <span className="font-semibold text-ink num-fa">
                {toPersianDigits(clinic.rating)}
              </span>
              <span className="num-fa">({toPersianDigits(clinic.reviewCount)} نظر)</span>
            </div>

            <div className="mt-4">
              <Badge variant="azure">{clinic.topService}</Badge>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-ink-muted">
                از{" "}
                <span className="font-bold text-ink num-fa">
                  {formatToman(clinic.startingPrice)}
                </span>{" "}
                تومان
              </span>
              <Button asChild variant="soft" size="sm">
                <Link href={`/clinics/${clinic.slug}`}>
                  رزرو نوبت
                  <ArrowLeft />
                </Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
