import { ArrowLeft, BadgeCheck, MapPin, Search, Sparkles } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { districtFromAddress } from "@/lib/public-clinic";
import { formatToman, toPersianDigits } from "@/lib/utils";
import type { PublicClinicListItem } from "@/types";

function addressSnippet(address: string, maxLength = 56): string {
  const trimmed = address.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

export function ClinicCard({ clinic }: { clinic: PublicClinicListItem }) {
  const district = districtFromAddress(clinic.address);

  return (
    <Card className="group flex h-full flex-col overflow-hidden hover:-translate-y-1 hover:border-azure/35 hover:shadow-soft">
      <div className="relative h-40 overflow-hidden bg-gradient-tint sm:h-44">
        <div className="absolute inset-0 flex items-center justify-center opacity-30 transition-opacity group-hover:opacity-45">
          <BrandMark className="size-14 sm:size-16" />
        </div>
        <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
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
              <Sparkles className="size-3" />
              <span className="num-fa">{toPersianDigits(clinic.service_count)} خدمت</span>
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-base font-bold leading-8 text-ink transition-colors group-hover:text-azure sm:text-lg">
          {clinic.clinic_name}
        </h3>

        <p className="mt-2 flex items-start gap-1.5 text-xs leading-7 text-ink-muted">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-azure" />
          <span>
            <span className="font-medium text-ink">{district}</span>
            <span className="mx-1.5 text-border">·</span>
            {addressSnippet(clinic.address)}
          </span>
        </p>

        {clinic.starting_price !== null ? (
          <p className="mt-4 text-xs text-ink-muted">
            شروع قیمت از{" "}
            <span className="font-bold text-ink num-fa">
              {formatToman(clinic.starting_price)} تومان
            </span>
          </p>
        ) : null}

        <div className="mt-auto pt-5">
          <Button asChild variant="primary" className="w-full">
            <Link href={`/clinics/${clinic.id}`}>
              مشاهده و رزرو نوبت
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
    <Card className="overflow-hidden">
      <div className="h-40 animate-pulse bg-surface-strong sm:h-44" />
      <div className="space-y-3 p-5 sm:p-6">
        <div className="h-5 w-3/4 animate-pulse rounded-lg bg-surface-strong" />
        <div className="h-4 w-full animate-pulse rounded-lg bg-surface-strong" />
        <div className="h-4 w-2/3 animate-pulse rounded-lg bg-surface-strong" />
        <div className="mt-4 h-10 animate-pulse rounded-xl bg-surface-strong" />
      </div>
    </Card>
  );
}

export function ClinicDirectoryEmpty({ search }: { search?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-azure/20 bg-white px-6 py-20 text-center shadow-soft-sm">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-azure-tint text-azure">
        <Search className="size-6" />
      </span>
      <p className="mt-5 text-base font-bold text-ink">
        {search ? "کلینیکی با این عبارت پیدا نشد" : "هنوز کلینیکی برای نمایش وجود ندارد"}
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-8 text-ink-muted">
        {search
          ? "نام مرکز یا منطقه دیگری را امتحان کنید، یا فهرست کامل کلینیک‌های تاییدشده را ببینید."
          : "به‌زودی مراکز زیبایی تاییدشده شیراز در این فهرست قرار می‌گیرند."}
      </p>
    </div>
  );
}
