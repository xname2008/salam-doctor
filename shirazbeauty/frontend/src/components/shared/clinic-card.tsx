import { ArrowLeft, BadgeCheck, MapPin, Search } from "lucide-react";
import Link from "next/link";

import { ClinicCover } from "@/components/shared/clinic-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { districtFromAddress } from "@/lib/public-clinic";
import { formatToman, toPersianDigits } from "@/lib/utils";
import type { PublicClinicListItem } from "@/types";

export function ClinicCard({ clinic }: { clinic: PublicClinicListItem }) {
  const district = districtFromAddress(clinic.address);

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-2xl hover:-translate-y-0.5 hover:border-rose/20 hover:shadow-soft">
      <ClinicCover name={clinic.clinic_name} seed={clinic.id}>
        <div className="flex items-start justify-between gap-2">
          {clinic.is_verified ? (
            <Badge variant="verified" className="bg-white/95 shadow-soft-sm">
              <BadgeCheck />
              تاییدشده
            </Badge>
          ) : (
            <span />
          )}
          {clinic.service_count > 0 ? (
            <Badge variant="azure" className="bg-white/95 shadow-soft-sm">
              <span className="num-fa">{toPersianDigits(clinic.service_count)} خدمت</span>
            </Badge>
          ) : null}
        </div>
      </ClinicCover>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4">
        <h3 className="text-[15px] font-bold leading-7 text-ink transition-colors duration-300 group-hover:text-rose sm:text-base">
          {clinic.clinic_name}
        </h3>

        <p className="mt-1 flex items-center gap-1 text-[11px] leading-6 text-ink-muted">
          <MapPin className="size-3 shrink-0 text-rose/70" />
          <span className="truncate">{district}</span>
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <p className="min-w-0 text-[11px] leading-5 text-ink-muted">
            {clinic.starting_price !== null ? (
              <>
                از{" "}
                <span className="num-fa">
                  {formatToman(clinic.starting_price)}
                </span>{" "}
                تومان
              </>
            ) : (
              "تعرفه با استعلام"
            )}
          </p>
          <Button asChild size="sm" className="shrink-0 px-4">
            <Link href={`/clinics/${clinic.id}`}>
              رزرو نوبت
              <ArrowLeft />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ClinicCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl">
      <div className="h-36 animate-pulse bg-surface-strong sm:h-40" />
      <div className="space-y-2.5 px-4 py-4 sm:px-5">
        <div className="h-4 w-3/4 animate-pulse rounded-md bg-surface-strong" />
        <div className="h-3 w-1/3 animate-pulse rounded-md bg-surface-strong" />
        <div className="mt-3 h-8 animate-pulse rounded-full bg-surface-strong" />
      </div>
    </Card>
  );
}

export function ClinicDirectoryEmpty({ search }: { search?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-rose/20 bg-white px-6 py-14 text-center shadow-soft-sm">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-tint text-rose">
        <Search className="size-5" />
      </span>
      <p className="mt-4 text-[15px] font-bold text-ink">
        {search ? "کلینیکی با این عبارت پیدا نشد" : "هنوز کلینیکی برای نمایش وجود ندارد"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">
        {search
          ? "نام مرکز یا منطقه دیگری را امتحان کنید، یا فهرست کامل کلینیک‌های تاییدشده را ببینید."
          : "به‌زودی مراکز زیبایی تاییدشده شیراز در این فهرست قرار می‌گیرند."}
      </p>
    </div>
  );
}
