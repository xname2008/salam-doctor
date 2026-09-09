"use client";

import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppointmentCard } from "@/components/dashboard/appointment-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { ApiError, api, toErrorMessage } from "@/lib/api";
import { formatToman, toPersianDigits } from "@/lib/utils";
import type { ClientAppointmentRow } from "@/types";

export function ClientOverview() {
  const router = useRouter();
  const { user } = useSession();
  const [rows, setRows] = useState<ClientAppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      const data = await api.get<ClientAppointmentRow[]>("/appointments/me");
      setRows(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("برای مشاهده پیش‌خوان وارد حساب خود شوید");
        router.push("/auth/login?role=client");
        return;
      }
      toast.error("نوبت‌ها دریافت نشد", { description: toErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const upcoming = useMemo(
    () => rows.filter((row) => row.status === "PENDING" || row.status === "CONFIRMED"),
    [rows],
  );
  const completed = useMemo(
    () => rows.filter((row) => row.status === "COMPLETED"),
    [rows],
  );
  const totalSpent = useMemo(
    () => completed.reduce((sum, row) => sum + Number(row.service.price), 0),
    [completed],
  );

  const greeting = user
    ? `سلام زیباجو ${toPersianDigits(user.mobile_number.slice(-4))} 👋`
    : "سلام زیباجو 👋";

  async function handleCancel(appointmentId: number) {
    if (cancellingId !== null) return;
    setCancellingId(appointmentId);
    try {
      const updated = await api.patch<ClientAppointmentRow>(
        `/appointments/client/${appointmentId}/cancel`,
      );
      setRows((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      toast.success("نوبت شما لغو شد");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("نشست شما منقضی شده است. دوباره وارد شوید");
        router.push("/auth/login?role=client");
        return;
      }
      toast.error("لغو نوبت انجام نشد", { description: toErrorMessage(error) });
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title={greeting}
        description="خلاصه نوبت‌های زیبایی و لیزر شما در یک نگاه."
        action={
          <Button asChild>
            <Link href="/dashboard/client/book">
              <Search />
              رزرو نوبت جدید
            </Link>
          </Button>
        }
      />

      {loading ? (
        <OverviewSkeleton />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="نوبت‌های پیش‌رو"
              value={toPersianDigits(upcoming.length)}
              hint="در انتظار مراجعه"
              icon={CalendarCheck}
            />
            <StatCard
              label="جلسات انجام‌شده"
              value={toPersianDigits(completed.length)}
              hint="از ابتدای عضویت"
              icon={Sparkles}
              tone="mint"
            />
            <StatCard
              label="مجموع هزینه"
              value={`${formatToman(totalSpent)} تومان`}
              hint="نوبت‌های انجام‌شده"
              icon={Wallet}
              tone="amber"
            />
          </section>

          <section className="mt-10 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-ink">نوبت‌های پیش‌رو</h2>
                <Link
                  href="/dashboard/client/appointments"
                  className="flex items-center gap-1.5 text-xs text-azure transition-colors hover:text-azure-dark"
                >
                  مشاهده همه
                  <ArrowLeft className="size-3.5" />
                </Link>
              </div>

              {upcoming.length ? (
                <div className="space-y-4">
                  {upcoming.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      cancelling={cancellingId === appointment.id}
                      onCancel={handleCancel}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CalendarCheck}
                  title="نوبت پیش‌رویی ندارید"
                  description="از میان کلینیک‌های تاییدشده شیراز انتخاب کنید و نوبت خود را رزرو کنید."
                  action={
                    <Button asChild>
                      <Link href="/dashboard/client/book">رزرو نوبت</Link>
                    </Button>
                  }
                />
              )}
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-azure/15 bg-white p-5 shadow-soft-sm">
                <h2 className="text-base font-bold text-ink">آخرین مراجعات</h2>
                {completed.length ? (
                  <ul className="mt-4 space-y-4">
                    {completed.slice(0, 4).map((item) => (
                      <li key={item.id} className="flex items-start gap-3">
                        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-azure-tint text-azure">
                          <CalendarDays className="size-3.5" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-ink">
                            {item.service.service_name}
                          </p>
                          <p className="mt-1 text-[11px] text-ink-muted">
                            {item.clinic.clinic_name}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-xs leading-7 text-ink-muted">
                    هنوز جلسه‌ای انجام نشده است.
                  </p>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl bg-gradient-azure p-6 text-white shadow-azure">
                <Sparkles className="size-6" />
                <h3 className="mt-4 text-base font-bold">پیشنهاد ویژه این ماه</h3>
                <p className="mt-2 text-xs leading-7 text-white/80">
                  با رزرو پکیج ۶ جلسه‌ای لیزر از طریق شیراز بیوتی، تا ۲۰٪ تخفیف بگیرید.
                </p>
                <Button
                  asChild
                  variant="soft"
                  size="sm"
                  className="mt-5 bg-white text-azure hover:bg-white/90"
                >
                  <Link href="/dashboard/client/book">
                    رزرو نوبت
                    <ArrowLeft />
                  </Link>
                </Button>
              </div>
            </aside>
          </section>
        </>
      )}
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
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </>
  );
}
