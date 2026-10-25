"use client";

import {
  CalendarOff,
  CalendarX2,
  Clock,
  Copy,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toJalaali } from "jalaali-js";

import { JalaliCalendar } from "@/components/dashboard/jalali-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CLINIC_SERVICES, DAY_SLOTS, WORKING_HOURS } from "@/lib/dashboard-data";
import { WEEKDAYS_FA, formatJalali, persianWeekday } from "@/lib/jalali";
import { cn, toPersianDigits } from "@/lib/utils";

const SLOT_LENGTHS = [15, 20, 30, 45, 60, 90];

function isoToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}

export function SchedulingBoard({ holidays }: { holidays: Record<string, string> }) {
  const [selectedIso, setSelectedIso] = useState(isoToday);
  const [hours, setHours] = useState(WORKING_HOURS);

  const closedWeekdays = useMemo(
    () => hours.filter((row) => !row.isOpen).map((row) => row.weekday),
    [hours],
  );

  const selected = useMemo(() => {
    const [year, month, day] = selectedIso.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return {
      jalali: toJalaali(year, month, day),
      weekday: persianWeekday(date),
    };
  }, [selectedIso]);

  const holidayTitle = holidays[selectedIso];
  // `hours` always covers all seven weekdays, so the fallback is unreachable.
  const dayHours = hours.find((row) => row.weekday === selected.weekday) ?? hours[0];
  const isClosed = !dayHours.isOpen;
  const blocked = Boolean(holidayTitle) || isClosed;

  function updateHours(weekday: number, patch: Partial<(typeof WORKING_HOURS)[number]>) {
    setHours((current) =>
      current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
      {/* ------------------------------- Calendar ------------------------------- */}
      <div className="space-y-6">
        <JalaliCalendar
          holidays={holidays}
          closedWeekdays={closedWeekdays}
          selectedIso={selectedIso}
          onSelect={setSelectedIso}
        />

        <div className="rounded-2xl border border-border bg-white p-6 shadow-soft-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <CalendarOff className="size-4 text-rose" />
              تعطیلات رسمی
            </h2>
            <Button variant="ghost" size="sm">
              <RefreshCw />
              به‌روزرسانی
            </Button>
          </div>

          <p className="mt-2 text-[11px] leading-6 text-ink-muted">
            تعطیلات رسمی ایران به‌صورت خودکار از تقویم رسمی دریافت و در نوبت‌دهی مسدود
            می‌شود.
          </p>

          <ul className="mt-5 space-y-2">
            {Object.entries(holidays).map(([iso, title]) => {
              const [year, month, day] = iso.split("-").map(Number);
              return (
                <li
                  key={iso}
                  className="flex items-center justify-between gap-3 rounded-xl bg-destructive/5 px-4 py-3"
                >
                  <span className="text-xs text-ink">{title}</span>
                  <span className="shrink-0 text-[11px] text-destructive num-fa">
                    {formatJalali(toJalaali(year, month, day), { withYear: false })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* --------------------------- Day detail + hours -------------------------- */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-soft-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-ink num-fa">
                {formatJalali(selected.jalali, { withWeekday: true })}
              </h2>
              <p className="mt-1.5 text-xs text-ink-muted">
                {blocked
                  ? holidayTitle
                    ? `تعطیل رسمی — ${holidayTitle}`
                    : "تعطیلی هفتگی مرکز"
                  : `ساعت کاری ${toPersianDigits(dayHours.opensAt)} تا ${toPersianDigits(dayHours.closesAt)}`}
              </p>
            </div>

            {blocked ? (
              <Badge variant="danger">
                <CalendarX2 />
                نوبت‌دهی غیرفعال
              </Badge>
            ) : (
              <Button size="sm" variant="soft">
                <Plus />
                افزودن بازه
              </Button>
            )}
          </div>

          {blocked ? (
            <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
              <CalendarX2 className="size-6 text-destructive/70" />
              <p className="mt-3 text-xs font-semibold text-destructive">
                در این روز نوبتی پذیرفته نمی‌شود
              </p>
              <p className="mt-2 max-w-xs text-[11px] leading-6 text-ink-muted">
                برای پذیرش استثنایی مراجع در این روز، آن را به‌صورت دستی باز کنید.
              </p>
              <Button variant="outline" size="sm" className="mt-5">
                باز کردن استثنایی این روز
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DAY_SLOTS.map((slot) => {
                  const full = slot.booked >= slot.capacity;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-xl border p-3 text-start transition-all duration-200",
                        full
                          ? "border-rose/30 bg-rose-tint"
                          : "border-border bg-white hover:border-rose/40 hover:bg-surface",
                      )}
                    >
                      <span className="flex w-full items-center justify-between">
                        <span
                          className={cn(
                            "text-sm font-bold num-fa",
                            full ? "text-rose" : "text-ink",
                          )}
                        >
                          {slot.time}
                        </span>
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            full ? "bg-rose" : "bg-mint",
                          )}
                        />
                      </span>
                      <span className="text-[11px] text-ink-muted">{slot.service}</span>
                      <span className="text-[10px] text-ink-muted num-fa">
                        {full
                          ? "تکمیل"
                          : `${toPersianDigits(slot.capacity - slot.booked)} ظرفیت آزاد`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-4 text-[11px] text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-mint" />
                  ظرفیت آزاد
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-rose" />
                  رزروشده
                </span>
              </div>
            </>
          )}
        </div>

        {/* Per-service slot length */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-soft-sm">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <Clock className="size-4 text-rose" />
            مدت بازه هر خدمت
          </h2>
          <p className="mt-2 text-[11px] leading-6 text-ink-muted">
            طول هر بازه زمانی تعیین می‌کند سیستم چند نوبت در ساعات کاری ایجاد کند.
          </p>

          <ul className="mt-5 space-y-3">
            {CLINIC_SERVICES.filter((service) => service.isActive).map((service) => (
              <li
                key={service.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-3"
              >
                <span className="text-xs font-medium text-ink">{service.name}</span>
                <Select
                  aria-label={`مدت بازه ${service.name}`}
                  defaultValue={String(service.durationMinutes)}
                  className="h-9 w-36 bg-white text-xs"
                >
                  {SLOT_LENGTHS.map((length) => (
                    <option key={length} value={length}>
                      {toPersianDigits(length)} دقیقه
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        </div>

        {/* Weekly working hours */}
        <div className="rounded-2xl border border-border bg-white p-6 shadow-soft-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">ساعات کاری هفتگی</h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                <Copy />
                اعمال روی همه روزها
              </Button>
              <Button size="sm">
                <Save />
                ذخیره
              </Button>
            </div>
          </div>

          <ul className="mt-5 space-y-2">
            {hours.map((row) => (
              <li
                key={row.weekday}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors",
                  row.isOpen ? "border-border bg-white" : "border-transparent bg-surface",
                )}
              >
                <div className="flex w-28 shrink-0 items-center gap-3">
                  <Switch
                    checked={row.isOpen}
                    onCheckedChange={(checked) =>
                      updateHours(row.weekday, { isOpen: checked })
                    }
                    aria-label={`فعال بودن ${WEEKDAYS_FA[row.weekday]}`}
                  />
                  <Label className="text-xs">{WEEKDAYS_FA[row.weekday]}</Label>
                </div>

                {row.isOpen ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-ink-muted">از</span>
                      <Input
                        type="time"
                        dir="ltr"
                        value={row.opensAt}
                        onChange={(event) =>
                          updateHours(row.weekday, { opensAt: event.target.value })
                        }
                        aria-label={`ساعت شروع ${WEEKDAYS_FA[row.weekday]}`}
                        className="h-9 w-28 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-ink-muted">تا</span>
                      <Input
                        type="time"
                        dir="ltr"
                        value={row.closesAt}
                        onChange={(event) =>
                          updateHours(row.weekday, { closesAt: event.target.value })
                        }
                        aria-label={`ساعت پایان ${WEEKDAYS_FA[row.weekday]}`}
                        className="h-9 w-28 text-xs"
                      />
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`پاک کردن ساعات ${WEEKDAYS_FA[row.weekday]}`}
                      className="ms-auto text-ink-muted"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-ink-muted">تعطیل</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
