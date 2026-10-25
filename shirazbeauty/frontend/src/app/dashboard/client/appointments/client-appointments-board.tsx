"use client";

import { CalendarPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppointmentCard } from "@/components/dashboard/appointment-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api, toErrorMessage } from "@/lib/api";
import { toPersianDigits } from "@/lib/utils";
import type { ClientAppointmentRow } from "@/types";

export function ClientAppointmentsBoard() {
  const router = useRouter();
  const [rows, setRows] = useState<ClientAppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      const data = await api.get<ClientAppointmentRow[]>("/appointments/me");
      setRows(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("برای مشاهده نوبت‌ها وارد حساب خود شوید");
        router.push("/auth/login?role=client");
        return;
      }
      toast.error("فهرست نوبت‌ها دریافت نشد", {
        description: toErrorMessage(error),
      });
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
  const past = useMemo(
    () => rows.filter((row) => row.status === "COMPLETED"),
    [rows],
  );
  const cancelled = useMemo(
    () => rows.filter((row) => row.status === "CANCELLED"),
    [rows],
  );

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

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-48 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">
          پیش‌رو
          <span className="rounded-full bg-surface px-2 text-[11px] num-fa">
            {toPersianDigits(upcoming.length)}
          </span>
        </TabsTrigger>
        <TabsTrigger value="past">
          انجام‌شده
          <span className="rounded-full bg-surface px-2 text-[11px] num-fa">
            {toPersianDigits(past.length)}
          </span>
        </TabsTrigger>
        <TabsTrigger value="cancelled">
          لغوشده
          <span className="rounded-full bg-surface px-2 text-[11px] num-fa">
            {toPersianDigits(cancelled.length)}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upcoming">
        {upcoming.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
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
            icon={CalendarPlus}
            title="نوبت پیش‌رویی ندارید"
            description="از میان کلینیک‌های تاییدشده شیراز انتخاب کنید و نوبت خود را رزرو کنید."
            action={
              <Button asChild>
                <Link href="/dashboard/client/book">رزرو نوبت</Link>
              </Button>
            }
          />
        )}
      </TabsContent>

      <TabsContent value="past">
        {past.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {past.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarPlus}
            title="جلسه انجام‌شده‌ای ثبت نشده"
            description="پس از مراجعه و تایید مرکز، نوبت‌ها در این فهرست قرار می‌گیرند."
          />
        )}
      </TabsContent>

      <TabsContent value="cancelled">
        {cancelled.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {cancelled.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarPlus}
            title="نوبت لغوشده‌ای ندارید"
            description="اگر نوبتی را لغو کنید، اینجا نمایش داده می‌شود."
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
