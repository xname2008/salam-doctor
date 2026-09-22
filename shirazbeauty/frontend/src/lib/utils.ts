import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** Converts Latin digits in a string to Persian digits for display. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Converts Persian and Arabic-Indic digits back to Latin for validation/API use. */
export function toEnglishDigits(value: string): string {
  return value
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Formats an amount with thousands separators and Persian digits. */
export function formatToman(amount: number): string {
  return toPersianDigits(amount.toLocaleString("en-US"));
}

/** Masks a mobile number for display: 09123456789 -> ۰۹۱۲***۶۷۸۹ */
export function maskMobile(mobile: string): string {
  const digits = toEnglishDigits(mobile);
  if (digits.length < 11) return toPersianDigits(digits);
  return toPersianDigits(`${digits.slice(0, 4)}***${digits.slice(7)}`);
}

/** Seconds -> ۰۱:۵۹ */
export function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return toPersianDigits(
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  );
}
