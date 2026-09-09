"use client";

import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Phone,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api, toErrorMessage } from "@/lib/api";
import { formatJalali, parseJalaliString } from "@/lib/jalali";
import { cn, formatToman, toPersianDigits } from "@/lib/utils";
import type { ApiAppointmentStatus, ClinicAppointmentRow } from "@/types";

type TabFilter = "all" | ApiAppointmentStatus;

const STATUS_LABELS: Record<ApiAppointmentStatus, string> = {
  PENDING: "در انتظار تایید",
  CONFIRMED: "تاییدشده",
  COMPLETED: "انجام‌شده",
  CANCELLED: "لغوشده",
};

const STATUS_VARIANTS: Record<
  ApiAppointmentStatus,
  "warning" | "verified" | "danger" | "azure"
> = {
  PENDING: "warning",
  CONFIRMED: "verified",
  COMPLETED: "azure",
  CANCELLED: "danger",
};

const STATUS_TOAST: Record<ApiAppointmentStatus, string> = {
  PENDING: "وضعیت نوبت به‌روز شد",
  CONFIRMED: "نوبت با موفقیت تایید شد",
  COMPLETED: "نوبت به‌عنوان انجام‌شده ثبت شد",
  CANCELLED: "نوبت لغو شد",
};

function formatAppointmentDate(jalaliDate: string): string {
  const parsed = parseJalaliString(jalaliDate);
  if (!parsed) return toPersianDigits(jalaliDate);
  return formatJalali(parsed, { withYear: true, withWeekday: true });
}

function clientLabel(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  const suffix = digits.slice(-4);
  return suffix ? `زیباجو ${toPersianDigits(suffix)}` : "زیباجو";
}

function clientInitial(mobile: string): string {
  return toPersianDigits(mobile.replace(/\D/g, "").slice(-1) || "ز");
}

export function ClinicAppointmentsBoard() {
  const router = useRouter();
  const [rows, setRows] = useState<ClinicAppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>("PENDING");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      const data = await api.get<ClinicAppointmentRow[]>("/appointments/clinic");
      setRows(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("برای مدیریت نوبت‌ها وارد حساب کلینیک شوید");
        router.push("/auth/login?role=clinic");
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

  const services = useMemo(() => {
    const seen = new Map<number, string>();
    for (const row of rows) {
      seen.set(row.service.id, row.service.service_name);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      PENDING: rows.filter((row) => row.status === "PENDING").length,
      CONFIRMED: rows.filter((row) => row.status === "CONFIRMED").length,
      COMPLETED: rows.filter((row) => row.status === "COMPLETED").length,
      CANCELLED: rows.filter((row) => row.status === "CANCELLED").length,
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (tab !== "all" && row.status !== tab) return false;
      if (serviceFilter !== "all" && String(row.service.id) !== serviceFilter) {
        return false;
      }
      return true;
    });
  }, [rows, tab, serviceFilter]);

  async function handleStatusChange(
    appointmentId: number,
    nextStatus: ApiAppointmentStatus,
  ) {
    if (updatingId !== null) return;
    setUpdatingId(appointmentId);
    try {
      const updated = await api.patch<ClinicAppointmentRow>(
        `/appointments/clinic/${appointmentId}/status`,
        { status: nextStatus },
      );
      setRows((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      toast.success(STATUS_TOAST[nextStatus]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("نشست شما منقضی شده است. دوباره وارد شوید");
        router.push("/auth/login?role=clinic");
        return;
      }
      toast.error("به‌روزرسانی وضعیت انجام نشد", {
        description: toErrorMessage(error),
      });
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return <AppointmentsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatPill
          label="در انتظار تایید"
          value={counts.PENDING}
          tone="amber"
        />
        <StatPill label="تاییدشده" value={counts.CONFIRMED} tone="mint" />
        <StatPill label="کل نوبت‌ها" value={counts.all} tone="azure" />
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-azure/15 bg-white p-4 shadow-soft-sm">
        <span className="text-xs font-semibold text-ink">فیلتر خدمت</span>
        <Select
          aria-label="فیلتر خدمت"
          className="h-10 w-full sm:w-64"
          value={serviceFilter}
          onChange={(event) => setServiceFilter(event.target.value)}
        >
          <option value="all">همه خدمات</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabFilter)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="PENDING">
            در انتظار
            <CountChip value={counts.PENDING} />
          </TabsTrigger>
          <TabsTrigger value="CONFIRMED">
            تاییدشده
            <CountChip value={counts.CONFIRMED} />
          </TabsTrigger>
          <TabsTrigger value="COMPLETED">
            انجام‌شده
            <CountChip value={counts.COMPLETED} />
          </TabsTrigger>
          <TabsTrigger value="CANCELLED">
            لغوشده
            <CountChip value={counts.CANCELLED} />
          </TabsTrigger>
          <TabsTrigger value="all">
            همه
            <CountChip value={counts.all} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-5">
          {visibleRows.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="نوبتی در این فهرست نیست"
              description="با تغییر فیلتر، نوبت‌های دیگر مرکز را ببینید. نوبت‌های جدید زیباجویان همین‌جا ظاهر می‌شوند."
            />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-3xl border border-azure/15 bg-white shadow-soft md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>نام / موبایل زیباجو</TableHead>
                      <TableHead>خدمت</TableHead>
                      <TableHead>تاریخ</TableHead>
                      <TableHead>ساعت</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead className="text-end">عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <ClientCell row={row} />
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-ink">
                            {row.service.service_name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-muted num-fa">
                            {toPersianDigits(row.service.duration_minutes)} دقیقه ·{" "}
                            {formatToman(Number(row.service.price))} تومان
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatAppointmentDate(row.jalali_date)}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex rounded-full bg-azure-tint px-3 py-1 text-sm font-bold text-azure num-fa">
                            {toPersianDigits(row.time_slot)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[row.status]}>
                            {STATUS_LABELS[row.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <RowActions
                            row={row}
                            busy={updatingId === row.id}
                            onStatusChange={handleStatusChange}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="grid gap-3 md:hidden">
                {visibleRows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-3xl border border-azure/15 bg-white p-4 shadow-soft-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <ClientCell row={row} />
                      <Badge variant={STATUS_VARIANTS[row.status]}>
                        {STATUS_LABELS[row.status]}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-ink">
                      {row.service.service_name}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                      <span>{formatAppointmentDate(row.jalali_date)}</span>
                      <span className="font-bold text-azure num-fa">
                        ساعت {toPersianDigits(row.time_slot)}
                      </span>
                    </div>
                    <div className="mt-4">
                      <RowActions
                        row={row}
                        busy={updatingId === row.id}
                        onStatusChange={handleStatusChange}
                        stacked
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClientCell({ row }: { row: ClinicAppointmentRow }) {
  const mobile = row.client.mobile_number;
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-10">
        <AvatarFallback>{clientInitial(mobile)}</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-semibold text-ink">{clientLabel(mobile)}</p>
        <a
          href={`tel:${mobile}`}
          dir="ltr"
          className="mt-0.5 inline-flex items-center gap-1 text-start text-[11px] text-ink-muted transition-colors hover:text-azure num-fa"
        >
          <Phone className="size-3" />
          {toPersianDigits(mobile)}
        </a>
      </div>
    </div>
  );
}

function RowActions({
  row,
  busy,
  onStatusChange,
  stacked = false,
}: {
  row: ClinicAppointmentRow;
  busy: boolean;
  onStatusChange: (id: number, status: ApiAppointmentStatus) => void;
  stacked?: boolean;
}) {
  const showConfirm = row.status === "PENDING";
  const showCancel = row.status === "PENDING" || row.status === "CONFIRMED";

  if (!showConfirm && !showCancel) {
    return (
      <p className="text-end text-[11px] text-ink-muted">
        این نوبت قابل تغییر نیست
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        stacked ? "flex-col" : "justify-end",
      )}
    >
      {showConfirm ? (
        <Button
          size="sm"
          variant="soft"
          disabled={busy}
          onClick={() => onStatusChange(row.id, "CONFIRMED")}
        >
          {busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          تایید نوبت
        </Button>
      ) : null}
      {row.status === "CONFIRMED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onStatusChange(row.id, "COMPLETED")}
        >
          {busy ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
          انجام شد
        </Button>
      ) : null}
      {showCancel ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          className="text-destructive hover:text-destructive"
          onClick={() => onStatusChange(row.id, "CANCELLED")}
        >
          {busy ? <Loader2 className="animate-spin" /> : <XCircle />}
          لغو نوبت
        </Button>
      ) : null}
    </div>
  );
}

function CountChip({ value }: { value: number }) {
  return (
    <span className="rounded-full bg-surface px-2 text-[11px] font-bold text-ink num-fa">
      {toPersianDigits(value)}
    </span>
  );
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "mint" | "azure";
}) {
  const tones = {
    amber: "from-amber/15 to-white text-amber",
    mint: "from-mint/12 to-white text-mint",
    azure: "from-azure-tint to-white text-azure",
  };
  return (
    <div
      className={cn(
        "rounded-2xl border border-azure/10 bg-gradient-to-l p-4 shadow-soft-sm",
        tones[tone],
      )}
    >
      <p className="text-[11px] font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold num-fa">
        <Sparkles className="size-4" />
        {toPersianDigits(value)}
      </p>
    </div>
  );
}

function AppointmentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-16 rounded-2xl" />
      <div className="overflow-hidden rounded-3xl border border-border bg-white">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="hidden h-8 w-24 rounded-full sm:block" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
