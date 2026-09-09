"use client";

import { CalendarOff, DoorClosed, DoorOpen, NotebookPen, Save } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { jalaliKeyFromDateObject, JalaliCalendar } from "@/components/JalaliCalendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { OFFICIAL_HOLIDAYS } from "@/lib/dashboard-data";
import {
  formatJalali,
  gregorianIsoToJalaliKey,
  jalaliToDate,
  parseJalaliString,
  persianWeekday,
  todayJalaliString,
} from "@/lib/jalali";
import { cn, toPersianDigits } from "@/lib/utils";

interface DayStatus {
  isOpen: boolean;
  note: string;
}

function seedDayStatuses(): Record<string, DayStatus> {
  const seeded: Record<string, DayStatus> = {};
  for (const [iso, title] of Object.entries(OFFICIAL_HOLIDAYS)) {
    const key = gregorianIsoToJalaliKey(iso);
    if (key) seeded[key] = { isOpen: false, note: title };
  }
  return seeded;
}

function isFridayKey(jalaliDate: string): boolean {
  const parsed = parseJalaliString(jalaliDate);
  if (!parsed) return false;
  return persianWeekday(jalaliToDate(parsed)) === 6;
}

function defaultOpenFor(jalaliDate: string): boolean {
  return !isFridayKey(jalaliDate);
}

export function ClinicCalendarManager() {
  const [selectedDate, setSelectedDate] = useState<string | null>(todayJalaliString);
  const [days, setDays] = useState<Record<string, DayStatus>>(seedDayStatuses);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(true);
  const [draftNote, setDraftNote] = useState("");
  const selectedRef = useRef(selectedDate);
  selectedRef.current = selectedDate;

  const selectedStatus = selectedDate ? days[selectedDate] : undefined;
  const parsed = selectedDate ? parseJalaliString(selectedDate) : null;
  const selectedLabel = parsed
    ? formatJalali(parsed, { withYear: true, withWeekday: true })
    : "روزی انتخاب نشده";

  const closedCount = useMemo(
    () => Object.values(days).filter((day) => !day.isOpen).length,
    [days],
  );

  const notedDays = useMemo(
    () =>
      Object.entries(days)
        .filter(([, status]) => status.note || !status.isOpen)
        .sort(([left], [right]) => left.localeCompare(right)),
    [days],
  );

  function openEditor(jalaliDate: string) {
    const current = days[jalaliDate];
    setSelectedDate(jalaliDate);
    setDraftOpen(current?.isOpen ?? defaultOpenFor(jalaliDate));
    setDraftNote(current?.note ?? (isFridayKey(jalaliDate) ? "تعطیلی هفتگی" : ""));
    setEditorOpen(true);
  }

  function handleDateSelect(jalaliDate: string) {
    // The picker can re-emit the current value on re-render; ignore that so
    // saving a day does not immediately reopen the editor.
    if (jalaliDate === selectedRef.current) return;
    openEditor(jalaliDate);
  }

  function handleSave() {
    if (!selectedDate) return;
    setDays((current) => ({
      ...current,
      [selectedDate]: { isOpen: draftOpen, note: draftNote.trim() },
    }));
    setEditorOpen(false);
    toast.success(draftOpen ? "این روز به‌عنوان باز ذخیره شد" : "این روز تعطیل شد", {
      description: selectedLabel,
    });
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <Card className="overflow-hidden border-azure/15 shadow-soft">
          <CardHeader className="bg-gradient-to-l from-azure-tint/70 to-white">
            <p className="text-[11px] font-bold tracking-wide text-azure">تقویم مرکز</p>
            <CardTitle>زمان‌بندی شمسی</CardTitle>
            <CardDescription>
              روی هر روز کلیک کنید تا آن را باز یا تعطیل کنید و یادداشت داخلی بگذارید.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <JalaliCalendar
              value={selectedDate}
              onChange={handleDateSelect}
              size="large"
              disablePast={false}
              disableFridays={false}
              showCaption={false}
              mapDays={({ date }) => {
                const key = jalaliKeyFromDateObject(date);
                const status = days[key];
                if (status && !status.isOpen) return { className: "sb-day-closed" };
                if (status?.note) return { className: "sb-day-holiday" };
                if (persianWeekday(date.toDate()) === 6) return { className: "sb-day-friday" };
                return {};
              }}
            />
            <p className="mt-4 text-center text-sm font-semibold text-azure-dark">
              {selectedLabel}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] text-ink-muted">
              <LegendDot className="bg-azure" label="روز انتخاب‌شده" />
              <LegendDot className="bg-destructive/70" label="تعطیل مرکز" />
              <LegendDot className="bg-amber" label="یادداشت / تعطیل رسمی" />
              <LegendDot className="bg-ink-muted/30" label="جمعه" />
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card className="border-azure/15 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">روز انتخاب‌شده</CardTitle>
              <CardDescription>{selectedLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedStatus && !selectedStatus.isOpen ? (
                <Badge variant="danger">
                  <DoorClosed />
                  تعطیل
                </Badge>
              ) : (
                <Badge variant="verified">
                  <DoorOpen />
                  باز برای نوبت‌دهی
                </Badge>
              )}
              {selectedStatus?.note ? (
                <p className="rounded-2xl bg-surface px-4 py-3 text-sm leading-7 text-ink">
                  {selectedStatus.note}
                </p>
              ) : (
                <p className="text-sm text-ink-muted">برای این روز یادداشتی ثبت نشده است.</p>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!selectedDate}
                onClick={() => selectedDate && openEditor(selectedDate)}
              >
                <NotebookPen />
                ویرایش این روز
              </Button>
            </CardContent>
          </Card>

          <Card className="border-azure/15 shadow-soft">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarOff className="size-4 text-azure" />
                  روزهای تنظیم‌شده
                </CardTitle>
                <span className="rounded-full bg-azure-tint px-2.5 py-0.5 text-[11px] font-bold text-azure-dark num-fa">
                  {toPersianDigits(closedCount)} تعطیل
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {notedDays.length ? (
                <ul className="max-h-80 space-y-2 overflow-auto pe-1">
                  {notedDays.map(([key, status]) => {
                    const parsedDay = parseJalaliString(key);
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => openEditor(key)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-start transition-colors",
                            status.isOpen
                              ? "bg-surface hover:bg-azure-tint/60"
                              : "bg-destructive/5 hover:bg-destructive/10",
                          )}
                        >
                          <span>
                            <span className="block text-xs font-semibold text-ink">
                              {parsedDay
                                ? formatJalali(parsedDay, {
                                    withYear: false,
                                    withWeekday: true,
                                  })
                                : key}
                            </span>
                            {status.note ? (
                              <span className="mt-1 block text-[11px] leading-6 text-ink-muted">
                                {status.note}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-[11px] font-bold",
                              status.isOpen ? "text-mint" : "text-destructive",
                            )}
                          >
                            {status.isOpen ? "باز" : "تعطیل"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">هنوز روز خاصی تنظیم نشده است.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>وضعیت روز</DialogTitle>
            <DialogDescription>{selectedLabel}</DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">نوبت‌دهی در این روز</p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {draftOpen
                    ? "مرکز باز است و نوبت پذیرفته می‌شود."
                    : "این روز برای مراجعان تعطیل است."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-muted">
                  {draftOpen ? "باز" : "تعطیل"}
                </span>
                <Switch
                  checked={draftOpen}
                  onCheckedChange={setDraftOpen}
                  aria-label="باز یا تعطیل بودن روز"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="day-note">یادداشت داخلی</Label>
              <Textarea
                id="day-note"
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                placeholder="مثلاً: تعمیر دستگاه لیزر، یا تعطیل رسمی"
                maxLength={240}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>
              انصراف
            </Button>
            <Button type="button" onClick={handleSave}>
              <Save />
              ذخیره وضعیت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}
