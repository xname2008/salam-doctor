import { toGregorian, toJalaali } from "jalaali-js";

import { toPersianDigits } from "@/lib/utils";

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

/** Persian week starts on Saturday. */
export const WEEKDAYS_FA = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
] as const;

export const WEEKDAYS_SHORT_FA = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export interface CalendarCell {
  /** ISO yyyy-mm-dd in the Gregorian calendar — the key the API will use. */
  iso: string;
  jalali: JalaliDate;
  /** Persian label, e.g. "۹". */
  label: string;
  /** False for the leading/trailing days that pad the grid. */
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  /** 0 = Saturday ... 6 = Friday. */
  weekday: number;
  /** Fridays are the Iranian weekend. */
  isWeekend: boolean;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Persian weekday index for a JS date: Saturday = 0 ... Friday = 6. */
export function persianWeekday(date: Date): number {
  return (date.getDay() + 1) % 7;
}

export function todayJalali(): JalaliDate {
  const now = new Date();
  return toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function jalaliToDate({ jy, jm, jd }: JalaliDate): Date {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

/** Zero-padded Shamsi key used by the booking calendar, e.g. `"1405-06-10"`. */
export function formatJalaliKey({ jy, jm, jd }: JalaliDate): string {
  return `${jy}-${pad(jm)}-${pad(jd)}`;
}

export function todayJalaliString(): string {
  return formatJalaliKey(todayJalali());
}

/** Gregorian ISO (`2026-09-05`) → Shamsi key (`1405-06-14`). */
export function gregorianIsoToJalaliKey(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const jalali = toJalaali(Number(match[1]), Number(match[2]), Number(match[3]));
  return formatJalaliKey(jalali);
}

/** Parses a zero-padded Shamsi string such as `"1405-06-10"`. */
export function parseJalaliString(value: string): JalaliDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return { jy, jm, jd };
}

export function formatJalali(
  date: JalaliDate,
  options: { withYear?: boolean; withWeekday?: boolean } = {},
): string {
  const { withYear = true, withWeekday = false } = options;
  const parts: string[] = [];

  if (withWeekday) {
    parts.push(WEEKDAYS_FA[persianWeekday(jalaliToDate(date))]);
  }

  parts.push(toPersianDigits(date.jd), JALALI_MONTHS[date.jm - 1]);

  if (withYear) {
    parts.push(toPersianDigits(date.jy));
  }

  return parts.join(" ");
}

/** Days in a Jalali month: 31 for months 1-6, 30 for 7-11, 29/30 for Esfand. */
function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand: probe whether the 30th exists by round-tripping through Gregorian.
  const { gy, gm, gd } = toGregorian(jy, 12, 30);
  const probe = toJalaali(gy, gm, gd);
  return probe.jm === 12 && probe.jd === 30 ? 30 : 29;
}

export function addJalaliMonths({ jy, jm, jd }: JalaliDate, delta: number): JalaliDate {
  const total = jy * 12 + (jm - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const maxDay = jalaliMonthLength(nextYear, nextMonth);
  return { jy: nextYear, jm: nextMonth, jd: Math.min(jd, maxDay) };
}

/**
 * Builds a Saturday-first 6x7 grid for the given Jalali month, padded with the
 * neighbouring months so every row is complete.
 */
export function buildMonthGrid(jy: number, jm: number): CalendarCell[] {
  const firstDay = jalaliToDate({ jy, jm, jd: 1 });
  const leading = persianWeekday(firstDay);

  const start = new Date(firstDay);
  start.setDate(start.getDate() - leading);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    const jalali = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const weekday = persianWeekday(date);

    return {
      iso: toIso(date),
      jalali,
      label: toPersianDigits(jalali.jd),
      inMonth: jalali.jm === jm && jalali.jy === jy,
      isToday: date.getTime() === today.getTime(),
      isPast: date.getTime() < today.getTime(),
      weekday,
      isWeekend: weekday === 6,
    };
  });
}
