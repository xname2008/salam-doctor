"use client";

import { CalendarDays, Clock, Loader2, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatJalali, parseJalaliString } from "@/lib/jalali";
import { formatToman, toPersianDigits } from "@/lib/utils";
import type { ApiAppointmentStatus, ClientAppointmentRow } from "@/types";

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

function formatAppointmentDate(jalaliDate: string): string {
  const parsed = parseJalaliString(jalaliDate);
  if (!parsed) return toPersianDigits(jalaliDate);
  return formatJalali(parsed, { withYear: true, withWeekday: true });
}

export function AppointmentCard({
  appointment,
  compact = false,
  cancelling = false,
  onCancel,
}: {
  appointment: ClientAppointmentRow;
  compact?: boolean;
  cancelling?: boolean;
  onCancel?: (id: number) => void;
}) {
  const canCancel =
    appointment.status === "PENDING" || appointment.status === "CONFIRMED";

  return (
    <div className="rounded-2xl border border-rose/12 bg-white p-5 shadow-soft-sm transition-shadow hover:shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">{appointment.service.service_name}</h3>
          <p className="mt-1.5 text-xs text-ink-muted">{appointment.clinic.clinic_name}</p>
        </div>
        <Badge variant={STATUS_VARIANTS[appointment.status]}>
          {STATUS_LABELS[appointment.status]}
        </Badge>
      </div>

      <dl className="mt-5 grid gap-3 text-xs text-ink-muted sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-3.5 shrink-0 text-rose" />
          <span>{formatAppointmentDate(appointment.jalali_date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 shrink-0 text-rose" />
          <span className="num-fa">ساعت {toPersianDigits(appointment.time_slot)}</span>
        </div>
        <div className="flex items-start gap-2 sm:col-span-2">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-rose" />
          <span>{appointment.clinic.address}</span>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-sm font-bold text-ink num-fa">
          {formatToman(Number(appointment.service.price))} تومان
        </span>

        {compact ? null : canCancel && onCancel ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={cancelling}
            onClick={() => onCancel(appointment.id)}
          >
            {cancelling ? <Loader2 className="animate-spin" /> : null}
            لغو نوبت
          </Button>
        ) : null}
      </div>
    </div>
  );
}
