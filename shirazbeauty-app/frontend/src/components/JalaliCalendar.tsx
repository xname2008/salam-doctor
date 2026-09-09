"use client";

import type { HTMLAttributes } from "react";
import { useMemo } from "react";
import { Calendar, DateObject, type MapDaysProps } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

import {
  formatJalali,
  parseJalaliString,
  persianWeekday,
  WEEKDAYS_SHORT_FA,
} from "@/lib/jalali";
import { cn, toEnglishDigits } from "@/lib/utils";

export type JalaliDayMeta = HTMLAttributes<HTMLSpanElement> & {
  disabled?: boolean;
  hidden?: boolean;
};

export type JalaliMapDays = (props: MapDaysProps) => JalaliDayMeta | void;

export interface JalaliCalendarProps {
  /** Shamsi `YYYY-MM-DD`, or `null` when nothing is selected. */
  value: string | null;
  onChange?: (jalaliDate: string) => void;
  /** Extra per-day styling (holidays, closures). Merged on top of defaults. */
  mapDays?: JalaliMapDays;
  readOnly?: boolean;
  /** Block dates before today. On by default for client booking. */
  disablePast?: boolean;
  /** Block Fridays (Iranian weekend). On by default for client booking. */
  disableFridays?: boolean;
  showCaption?: boolean;
  size?: "default" | "large";
  className?: string;
}

export function jalaliKeyFromDateObject(date: DateObject): string {
  return toEnglishDigits(date.format("YYYY-MM-DD"));
}

function toPersianDateObject(jalaliDate: string): DateObject {
  return new DateObject({
    date: jalaliDate,
    format: "YYYY-MM-DD",
    calendar: persian,
    locale: persian_fa,
  });
}

export function JalaliCalendar({
  value,
  onChange,
  mapDays,
  readOnly = false,
  disablePast = true,
  disableFridays = true,
  showCaption = true,
  size = "default",
  className,
}: JalaliCalendarProps) {
  const selected = useMemo(
    () => (value ? toPersianDateObject(value) : undefined),
    [value],
  );
  const parsed = value ? parseJalaliString(value) : null;
  const selectedLabel = parsed
    ? formatJalali(parsed, { withYear: true, withWeekday: true })
    : "روز مورد نظر را از تقویم انتخاب کنید";

  return (
    <div
      className={cn(
        "sb-jalali-calendar",
        size === "large" && "sb-jalali-calendar--large",
        readOnly && "sb-jalali-calendar--readonly",
        className,
      )}
      dir="rtl"
    >
      <Calendar
        calendar={persian}
        locale={persian_fa}
        format="YYYY-MM-DD"
        value={selected}
        weekDays={[...WEEKDAYS_SHORT_FA]}
        shadow={false}
        readOnly={readOnly}
        minDate={
          disablePast
            ? new DateObject({ calendar: persian, locale: persian_fa })
            : undefined
        }
        className="sb-jalali-picker"
        mapDays={(props) => {
          const { date } = props;
          const jsDate = date.toDate();
          jsDate.setHours(0, 0, 0, 0);
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const base: JalaliDayMeta = {};

          if (disablePast && jsDate.getTime() < today.getTime()) {
            base.disabled = true;
            base.className = "sb-day-past";
          } else if (disableFridays && persianWeekday(jsDate) === 6) {
            base.disabled = true;
            base.className = "sb-day-friday";
          } else if (persianWeekday(jsDate) === 6) {
            base.className = "sb-day-friday";
          }

          const extra = mapDays?.(props);
          if (!extra) return base;

          return {
            ...base,
            ...extra,
            disabled: extra.disabled ?? base.disabled,
            className: cn(base.className, extra.className),
          };
        }}
        onChange={(date) => {
          if (readOnly || !date || Array.isArray(date)) return;
          onChange?.(jalaliKeyFromDateObject(date));
        }}
      />
      {showCaption ? (
        <p className="mt-4 text-center text-sm font-semibold text-azure-dark">
          {selectedLabel}
        </p>
      ) : null}
    </div>
  );
}
