"use client";

import { CalendarCheck, Check, Loader2, MapPin, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { JalaliCalendar } from "@/components/JalaliCalendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, toErrorMessage } from "@/lib/api";
import { formatJalali, parseJalaliString } from "@/lib/jalali";
import { cn, formatToman, toPersianDigits } from "@/lib/utils";
import type {
  AppointmentBookResponse,
  AvailableSlotsResponse,
  CatalogClinic,
  CatalogService,
} from "@/types";

function servicePrice(service: CatalogService): number {
  return Number(service.price);
}

export function BookingFlow({
  initialClinicId = null,
  initialServiceId = null,
}: {
  initialClinicId?: number | null;
  initialServiceId?: number | null;
}) {
  const router = useRouter();
  const slotsRequestId = useRef(0);

  const [catalog, setCatalog] = useState<CatalogClinic[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [clinicId, setClinicId] = useState<number | null>(initialClinicId);
  const [serviceId, setServiceId] = useState<number | null>(initialServiceId);
  const [jalaliDate, setJalaliDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedClinic = useMemo(
    () => catalog.find((clinic) => clinic.id === clinicId) ?? null,
    [catalog, clinicId],
  );
  const selectedService = useMemo(
    () => selectedClinic?.services.find((service) => service.id === serviceId) ?? null,
    [selectedClinic, serviceId],
  );
  const parsedDate = jalaliDate ? parseJalaliString(jalaliDate) : null;
  const dateLabel = parsedDate
    ? formatJalali(parsedDate, { withYear: true, withWeekday: true })
    : null;

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const rows = await api.get<CatalogClinic[]>("/appointments/catalog");
        if (cancelled) return;
        setCatalog(rows);

        const clinic = initialClinicId
          ? rows.find((row) => row.id === initialClinicId)
          : undefined;
        if (!clinic) {
          setClinicId(null);
          setServiceId(null);
          return;
        }
        setClinicId(clinic.id);
        const serviceExists = clinic.services.some(
          (service) => service.id === initialServiceId,
        );
        setServiceId(serviceExists ? initialServiceId : null);
      } catch (error) {
        if (cancelled) return;
        toast.error("فهرست مراکز دریافت نشد", {
          description: toErrorMessage(error),
        });
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [initialClinicId, initialServiceId]);

  useEffect(() => {
    if (!clinicId || !jalaliDate) {
      setSlots([]);
      setSlotsLoading(false);
      return;
    }

    const selectedClinicId = clinicId;
    const selectedJalaliDate = jalaliDate;
    const requestId = ++slotsRequestId.current;
    setSlotsLoading(true);
    setSelectedSlot(null);

    async function loadSlots() {
      try {
        const params = new URLSearchParams({
          clinic_id: String(selectedClinicId),
          jalali_date: selectedJalaliDate,
        });
        const response = await api.get<AvailableSlotsResponse>(
          `/appointments/slots?${params.toString()}`,
        );
        if (requestId !== slotsRequestId.current) return;
        setSlots(response.slots);
        if (!response.slots.length) {
          toast.message("ظرفیت این روز تکمیل است", {
            description: "تاریخ دیگری از تقویم انتخاب کنید.",
          });
        }
      } catch (error) {
        if (requestId !== slotsRequestId.current) return;
        setSlots([]);
        toast.error("ساعات آزاد دریافت نشد", {
          description: toErrorMessage(error),
        });
      } finally {
        if (requestId === slotsRequestId.current) setSlotsLoading(false);
      }
    }

    void loadSlots();
  }, [clinicId, jalaliDate]);

  function handleClinicChange(nextId: number) {
    setClinicId(nextId);
    setServiceId(null);
    setJalaliDate(null);
    setSlots([]);
    setSelectedSlot(null);
  }

  function handleDateChange(nextDate: string) {
    if (!clinicId) {
      toast.error("ابتدا کلینیک و خدمت را انتخاب کنید");
      return;
    }
    setJalaliDate(nextDate);
    setSelectedSlot(null);
  }

  async function handleConfirm() {
    if (!clinicId || !serviceId || !jalaliDate || !selectedSlot || submitting) return;

    setSubmitting(true);
    try {
      await api.post<AppointmentBookResponse>("/appointments/book", {
        clinic_id: clinicId,
        service_id: serviceId,
        jalali_date: jalaliDate,
        time_slot: selectedSlot,
      });
      toast.success("نوبت شما با موفقیت ثبت شد");
      router.push("/dashboard/client");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("برای رزرو باید وارد حساب خود شوید");
        const next = `/dashboard/client/book?clinic_id=${clinicId}&service_id=${serviceId}`;
        router.push(`/auth/login?role=client&next=${encodeURIComponent(next)}`);
        return;
      }
      toast.error("رزرو انجام نشد", { description: toErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  const canPickDate = Boolean(clinicId && serviceId);
  const canConfirm = Boolean(
    clinicId && serviceId && jalaliDate && selectedSlot && !submitting,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <div className="space-y-6">
        <Card className="overflow-hidden border-azure/15 shadow-soft">
          <CardHeader className="bg-gradient-to-l from-azure-tint/80 to-white">
            <p className="text-[11px] font-bold tracking-wide text-azure">مرحله ۱</p>
            <CardTitle>انتخاب مرکز و خدمت</CardTitle>
            <CardDescription>
              کلینیک و خدمت را مشخص کنید تا ساعات آزاد همان مرکز نمایش داده شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {catalogLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="clinic">کلینیک</Label>
                  <Select
                    id="clinic"
                    value={clinicId ? String(clinicId) : ""}
                    onChange={(event) => handleClinicChange(Number(event.target.value))}
                  >
                    <option value="" disabled>
                      انتخاب کلینیک
                    </option>
                    {catalog.map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.clinic_name}
                      </option>
                    ))}
                  </Select>
                  {selectedClinic ? (
                    <p className="flex items-start gap-1.5 text-xs leading-6 text-ink-muted">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-azure" />
                      {selectedClinic.address}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service">خدمت</Label>
                  <Select
                    id="service"
                    disabled={!selectedClinic}
                    value={serviceId ? String(serviceId) : ""}
                    onChange={(event) => setServiceId(Number(event.target.value))}
                  >
                    <option value="" disabled>
                      {selectedClinic ? "انتخاب خدمت" : "ابتدا کلینیک را انتخاب کنید"}
                    </option>
                    {selectedClinic?.services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.service_name}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-azure/15 shadow-soft">
          <CardHeader>
            <p className="text-[11px] font-bold tracking-wide text-azure">مرحله ۲</p>
            <CardTitle>تقویم شمسی</CardTitle>
            <CardDescription>
              روز مراجعه را انتخاب کنید. روزهای گذشته و جمعه‌ها قابل رزرو نیستند.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={canPickDate ? "" : "pointer-events-none select-none opacity-45"}>
              <JalaliCalendar value={jalaliDate} onChange={handleDateChange} />
            </div>
            {!canPickDate ? (
              <p className="mt-2 text-center text-xs text-ink-muted">
                برای فعال شدن تقویم، ابتدا کلینیک و خدمت را انتخاب کنید.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
        <Card className="border-azure/15 shadow-soft">
          <CardHeader>
            <p className="text-[11px] font-bold tracking-wide text-azure">مرحله ۳</p>
            <CardTitle>نوبت‌های آزاد</CardTitle>
            <CardDescription>
              {dateLabel
                ? `ساعات قابل رزرو برای ${dateLabel}`
                : "پس از انتخاب روز، ساعات آزاد از سرور دریافت می‌شود."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!jalaliDate ? (
              <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-ink-muted">
                ابتدا یک روز را از تقویم انتخاب کنید.
              </p>
            ) : slotsLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 rounded-full" />
                ))}
              </div>
            ) : slots.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => {
                  const active = selectedSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "h-11 rounded-full text-sm font-semibold transition-all duration-200",
                        active
                          ? "bg-azure text-white shadow-azure"
                          : "border border-border bg-white text-ink hover:border-azure/50 hover:bg-azure-tint hover:text-azure-dark",
                      )}
                    >
                      <span className="num-fa">{toPersianDigits(slot)}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl bg-surface px-4 py-10 text-center text-sm text-ink-muted">
                در این تاریخ نوبت خالی نمانده است.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-3xl border border-azure/20 bg-white shadow-soft">
          <div className="bg-gradient-azure px-6 py-5 text-white">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="size-4" />
              خلاصه رزرو
            </div>
            <p className="mt-2 text-xs leading-6 text-white/80">
              نوبت پس از ثبت، در انتظار تایید مرکز قرار می‌گیرد.
            </p>
          </div>
          <div className="space-y-4 px-6 py-5 text-sm">
            <SummaryRow label="مرکز" value={selectedClinic?.clinic_name ?? "—"} />
            <SummaryRow label="خدمت" value={selectedService?.service_name ?? "—"} />
            <SummaryRow label="تاریخ" value={dateLabel ?? "—"} />
            <SummaryRow
              label="ساعت"
              value={selectedSlot ? toPersianDigits(selectedSlot) : "—"}
              icon={CalendarCheck}
            />
            {selectedService ? (
              <SummaryRow
                label="تعرفه"
                value={`${formatToman(servicePrice(selectedService))} تومان`}
              />
            ) : null}
          </div>
          <div className="px-6 pb-6">
            <Button
              type="button"
              variant="gradient"
              size="lg"
              className="w-full"
              disabled={!canConfirm}
              onClick={() => void handleConfirm()}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Check />}
              {submitting ? "در حال ثبت نوبت…" : "ثبت نوبت"}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof CalendarCheck;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="flex items-center gap-1.5 text-end font-semibold text-ink">
        {Icon ? <Icon className="size-3.5 text-azure" /> : null}
        {value}
      </span>
    </div>
  );
}
