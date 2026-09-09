"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  JALALI_MONTHS,
  WEEKDAYS_SHORT_FA,
  addJalaliMonths,
  buildMonthGrid,
  todayJalali,
  type CalendarCell,
} from "@/lib/jalali";
import { cn, toPersianDigits } from "@/lib/utils";

interface JalaliCalendarProps {
  /** ISO date -> holiday title. Rendered as blocked days. */
  holidays: Record<string, string>;
  /** Weekday indexes (0 = Saturday) the clinic is closed. */
  closedWeekdays: number[];
  selectedIso: string;
  onSelect: (iso: string) => void;
}

export function JalaliCalendar({
  holidays,
  closedWeekdays,
  selectedIso,
  onSelect,
}: JalaliCalendarProps) {
  const [cursor, setCursor] = useState(() => todayJalali());
  const cells = useMemo(() => buildMonthGrid(cursor.jy, cursor.jm), [cursor]);

  function dayState(cell: CalendarCell) {
    const holiday = holidays[cell.iso];
    const closed = closedWeekdays.includes(cell.weekday);
    return {
      holiday,
      // Holidays and weekly closures both block booking, for different reasons.
      blocked: Boolean(holiday) || closed,
      closed,
    };
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-soft-sm sm:p-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="ماه قبل"
          onClick={() => setCursor((current) => addJalaliMonths(current, -1))}
        >
          <ChevronRight />
        </Button>

        <div className="text-center">
          <p className="text-sm font-bold text-ink">
            {JALALI_MONTHS[cursor.jm - 1]}{" "}
            <span className="num-fa">{toPersianDigits(cursor.jy)}</span>
          </p>
          <button
            type="button"
            onClick={() => setCursor(todayJalali())}
            className="mt-1 text-[11px] text-azure transition-colors hover:text-azure-dark"
          >
            برو به امروز
          </button>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="ماه بعد"
          onClick={() => setCursor((current) => addJalaliMonths(current, 1))}
        >
          <ChevronLeft />
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_SHORT_FA.map((day, index) => (
          <span
            key={day}
            className={cn(
              "py-2 text-[11px] font-semibold",
              index === 6 ? "text-destructive/70" : "text-ink-muted",
            )}
          >
            {day}
          </span>
        ))}

        {cells.map((cell) => {
          const { holiday, blocked, closed } = dayState(cell);
          const selected = cell.iso === selectedIso;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              title={holiday ?? (closed ? "تعطیل هفتگی مرکز" : undefined)}
              aria-current={cell.isToday ? "date" : undefined}
              aria-label={`${toPersianDigits(cell.jalali.jd)} ${JALALI_MONTHS[cell.jalali.jm - 1]}${holiday ? ` — ${holiday}` : ""}`}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-all duration-200",
                !cell.inMonth && "opacity-35",
                selected
                  ? "bg-azure text-white shadow-azure"
                  : blocked
                    ? "bg-destructive/5 text-destructive/70 hover:bg-destructive/10"
                    : cell.isPast
                      ? "text-ink-muted/60 hover:bg-surface"
                      : "text-ink hover:bg-azure-tint hover:text-azure",
                cell.isToday && !selected && "ring-1 ring-azure/50",
              )}
            >
              <span className="num-fa">{cell.label}</span>

              {/* Dot marks a national holiday; dash marks a weekly closure. */}
              {holiday ? (
                <span
                  className={cn(
                    "absolute bottom-1.5 size-1 rounded-full",
                    selected ? "bg-white" : "bg-destructive",
                  )}
                />
              ) : closed ? (
                <span
                  className={cn(
                    "absolute bottom-1.5 h-px w-2.5 rounded-full",
                    selected ? "bg-white/70" : "bg-ink-muted/40",
                  )}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-4 border-t border-border pt-4 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-azure" />
          روز انتخاب‌شده
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive" />
          تعطیل رسمی
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-px w-3 rounded-full bg-ink-muted/50" />
          تعطیلی هفتگی مرکز
        </span>
      </div>
    </div>
  );
}
