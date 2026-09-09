"use client";

import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  Clock,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, toErrorMessage } from "@/lib/api";
import { formatJalali, parseJalaliString } from "@/lib/jalali";
import { formatToman, toPersianDigits } from "@/lib/utils";
import type { ApiAppointmentStatus, ClinicStatsResponse } from "@/types";

const STATUS_LABELS: Record<ApiAppointmentStatus, string> = {
  PENDING: "در انتظار تایید",
  CONFIRMED: "تاییدشده",
  COMPLETED: "انجام‌شده",
  CANCELLED: "لغوشده",
};

const STATUS_VARIANTS: Record<
  ApiAppointmentStatus,
  "warning" | "verified" | "azure" | "danger"
> = {
  PENDING: "warning",
  CONFIRMED: "verified",
  COMPLETED: "azure",
  CANCELLED: "danger",
};

function clientLabel(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  const suffix = digits.slice(-4);
  return suffix ? `زیباجو ${toPersianDigits(suffix)}` : "زیباجو";
}

function clientInitial(mobile: string): string {
  return toPersianDigits(mobile.replace(/\D/g, "").slice(-1) || "ز");
}

function formatDayLabel(jalaliDate: string): string {
  const parsed = parseJalaliString(jalaliDate);
  if (!parsed) return toPersianDigits(jalaliDate);
  return formatJalali(parsed, { withYear: true, withWeekday: true });
}

export function ClinicOverview() {
  const router = useRouter();
  const [stats, setStats] = useState<ClinicStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get<ClinicStatsResponse>("/clinics/me/stats");
        if (!cancelled) setStats(data);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          toast.error("برای مشاهده پیش‌خوان وارد حساب کلینیک شوید");
          router.push("/auth/login?role=clinic");
          return;
        }
        toast.error("آمار مرکز دریافت نشد", {
          description: toErrorMessage(error),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const dayLabel = stats ? formatDayLabel(stats.jalali_date) : null;

  return (
    <>
      <PageHeader
        title="پیش‌خوان"
        description={
          dayLabel
            ? `برنامه امروز، ${dayLabel}`
            : "خلاصه نوبت‌ها و درآمد تقریبی مرکز در یک نگاه."
        }
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/clinic/appointments">
              <CalendarClock />
              مدیریت نوبت‌ها
            </Link>
          </Button>
        }
      />

      {loading ? (
        <OverviewSkeleton />
      ) : stats ? (
        <OverviewBody stats={stats} />
      ) : (
        <EmptyState
          icon={CalendarCheck}
          title="آمار در دسترس نیست"
          description="اتصال را بررسی کنید و دوباره تلاش کنید. اگر پروفایل مرکز هنوز ثبت نشده، ابتدا اطلاعات مرکز را تکمیل کنید."
        />
      )}
    </>
  );
}

function OverviewBody({ stats }: { stats: ClinicStatsResponse }) {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="نوبت‌های امروز"
          value={toPersianDigits(stats.today_appointments)}
          hint="نوبت فعال برای امروز"
          icon={CalendarCheck}
          tone="azure"
        />
        <StatCard
          label="در انتظار بررسی"
          value={toPersianDigits(stats.pending_count)}
          hint="نیازمند تایید شما"
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="درآمد تقریبی امروز"
          value={`${formatToman(stats.estimated_revenue)} تومان`}
          hint="مجموع تعرفه نوبت‌های تایید / انجام‌شده"
          icon={Wallet}
          tone="mint"
        />
      </section>

      <section className="mt-10 overflow-hidden rounded-3xl border border-azure/15 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-azure/10 bg-gradient-to-l from-azure-tint/70 to-white px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Sparkles className="size-4 text-azure" />
              نوبت‌های پیش‌رو
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              نزدیک‌ترین نوبت‌های امروز مرکز شما
            </p>
          </div>
          <Link
            href="/dashboard/clinic/appointments"
            className="flex items-center gap-1.5 text-xs font-semibold text-azure transition-colors hover:text-azure-dark"
          >
            مشاهده همه
            <ArrowLeft className="size-3.5" />
          </Link>
        </div>

        {stats.upcoming.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyState
              icon={CalendarCheck}
              title="نوبت پیش‌رویی برای امروز نیست"
              description="نوبت‌های جدید زیباجویان پس از رزرو، همین‌جا نمایش داده می‌شوند."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {stats.upcoming.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface/60"
              >
                <span className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-azure-tint py-2 text-azure">
                  <span className="text-sm font-bold num-fa">
                    {toPersianDigits(row.time_slot)}
                  </span>
                  <span className="mt-0.5 text-[10px] num-fa">
                    {toPersianDigits(row.service.duration_minutes)}′
                  </span>
                </span>

                <Avatar className="size-10 shrink-0">
                  <AvatarFallback>
                    {clientInitial(row.client.mobile_number)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-40 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {clientLabel(row.client.mobile_number)}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {row.service.service_name}
                  </p>
                </div>

                <Badge variant={STATUS_VARIANTS[row.status]}>
                  {STATUS_LABELS[row.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </section>
      <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <Skeleton className="h-12 w-16 rounded-2xl" />
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </>
  );
}
