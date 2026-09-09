import { BellRing, Camera, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DISTRICTS } from "@/lib/constants";

export const metadata: Metadata = { title: "پروفایل من" };

const NOTIFICATIONS = [
  {
    id: "sms-reminder",
    title: "یادآوری پیامکی نوبت",
    description: "۲۴ ساعت پیش از هر نوبت پیامک یادآوری دریافت کنید.",
    defaultChecked: true,
  },
  {
    id: "offers",
    title: "پیشنهادها و تخفیف‌ها",
    description: "از کمپین‌های تخفیف مراکز زیبایی شیراز باخبر شوید.",
    defaultChecked: true,
  },
  {
    id: "reviews",
    title: "یادآوری ثبت نظر",
    description: "پس از هر مراجعه، برای ثبت نظر یادآوری دریافت کنید.",
    defaultChecked: false,
  },
];

export default function ClientProfilePage() {
  return (
    <>
      <PageHeader
        title="پروفایل من"
        description="اطلاعات شخصی خود را به‌روز نگه دارید تا فرایند رزرو سریع‌تر انجام شود."
        action={<Button>ذخیره تغییرات</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.8fr]">
        <aside className="space-y-6">
          <div className="rounded-2xl border border-border bg-white p-6 text-center shadow-soft-sm">
            <div className="relative mx-auto w-fit">
              <Avatar className="size-24">
                <AvatarFallback className="text-2xl">ن</AvatarFallback>
              </Avatar>
              <button
                type="button"
                aria-label="تغییر تصویر پروفایل"
                className="absolute -bottom-1 -start-1 flex size-9 items-center justify-center rounded-xl border border-border bg-white text-azure shadow-soft-sm transition-colors hover:bg-azure-tint"
              >
                <Camera className="size-4" />
              </button>
            </div>

            <h2 className="mt-5 text-base font-bold text-ink">نازنین حسینی</h2>
            <p className="mt-1.5 text-xs text-ink-muted num-fa" dir="ltr">
              ۰۹۱۲***۴۵۶۷
            </p>

            <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-mint/10 px-3 py-2 text-[11px] text-mint">
              <ShieldCheck className="size-3.5" />
              شماره موبایل تایید شده است
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-soft-sm">
            <div className="flex items-center gap-2">
              <BellRing className="size-4 text-azure" />
              <h2 className="text-sm font-bold text-ink">اعلان‌ها</h2>
            </div>

            <div className="mt-5 space-y-5">
              {NOTIFICATIONS.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4">
                  <div>
                    <Label htmlFor={item.id} className="text-xs">
                      {item.title}
                    </Label>
                    <p className="mt-1 text-[11px] leading-6 text-ink-muted">
                      {item.description}
                    </p>
                  </div>
                  <Switch id={item.id} defaultChecked={item.defaultChecked} />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="rounded-2xl border border-border bg-white p-6 shadow-soft-sm sm:p-8">
          <h2 className="text-sm font-bold text-ink">اطلاعات شخصی</h2>
          <p className="mt-1.5 text-xs text-ink-muted">
            این اطلاعات فقط برای مرکزی که نوبت می‌گیرید نمایش داده می‌شود.
          </p>

          <Separator className="my-6" />

          <form className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first-name">نام</Label>
              <Input id="first-name" defaultValue="نازنین" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">نام خانوادگی</Label>
              <Input id="last-name" defaultValue="حسینی" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-mobile">شماره موبایل</Label>
              <Input
                id="profile-mobile"
                dir="ltr"
                defaultValue="09123456789"
                disabled
                className="text-start"
              />
              <p className="text-[11px] text-ink-muted">
                برای تغییر شماره با پشتیبانی تماس بگیرید.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">ایمیل (اختیاری)</Label>
              <Input id="email" type="email" dir="ltr" placeholder="you@example.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthdate">تاریخ تولد</Label>
              <Input id="birthdate" placeholder="۱۳۷۲/۰۵/۱۴" className="num-fa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">منطقه محل سکونت</Label>
              <Select id="district" defaultValue="maaliabad">
                {DISTRICTS.map((district) => (
                  <option key={district.slug} value={district.slug}>
                    {district.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="skin-notes">
                یادداشت پوستی و حساسیت‌ها (اختیاری)
              </Label>
              <Textarea
                id="skin-notes"
                placeholder="مثلا: پوست حساس، سابقه حساسیت به بی‌حسی موضعی..."
              />
              <p className="text-[11px] text-ink-muted">
                این یادداشت پیش از جلسه در اختیار متخصص قرار می‌گیرد.
              </p>
            </div>

            <div className="flex gap-3 sm:col-span-2">
              <Button type="submit">ذخیره تغییرات</Button>
              <Button type="button" variant="ghost">
                انصراف
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
