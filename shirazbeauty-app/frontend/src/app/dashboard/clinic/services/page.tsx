import { Clock, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES } from "@/lib/constants";
import { CLINIC_SERVICES } from "@/lib/dashboard-data";
import { formatToman, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "خدمات و تعرفه‌ها" };

export default function ClinicServicesPage() {
  const active = CLINIC_SERVICES.filter((service) => service.isActive).length;

  return (
    <>
      <PageHeader
        title="خدمات و تعرفه‌ها"
        description="خدمات مرکز، مدت‌زمان هر جلسه و تعرفه آن‌ها را مدیریت کنید."
        action={
          <Button>
            <Plus />
            افزودن خدمت
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-soft-sm">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Tags className="size-4 text-azure" />
              فهرست خدمات
            </h2>
            <span className="text-xs text-ink-muted num-fa">
              {toPersianDigits(active)} خدمت فعال از{" "}
              {toPersianDigits(CLINIC_SERVICES.length)}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-surface">
                <TableHead>عنوان خدمت</TableHead>
                <TableHead>دسته‌بندی</TableHead>
                <TableHead>مدت</TableHead>
                <TableHead>تعرفه (تومان)</TableHead>
                <TableHead>نمایش</TableHead>
                <TableHead className="text-end">عملیات</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {CLINIC_SERVICES.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-semibold">{service.name}</TableCell>
                  <TableCell>
                    <Badge>{service.category}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap num-fa">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <Clock className="size-3.5" />
                      {toPersianDigits(service.durationMinutes)} دقیقه
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-bold num-fa">
                    {formatToman(service.price)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      defaultChecked={service.isActive}
                      aria-label={`نمایش ${service.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label="ویرایش خدمت">
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="حذف خدمت"
                        className="text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-white p-6 shadow-soft-sm">
          <h2 className="text-base font-bold text-ink">افزودن خدمت جدید</h2>
          <p className="mt-1.5 text-xs leading-6 text-ink-muted">
            خدمت جدید پس از ثبت، بلافاصله در صفحه عمومی مرکز نمایش داده می‌شود.
          </p>

          <form className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">عنوان خدمت</Label>
              <Input id="service-name" placeholder="مثلا: لیزر موهای زائد — کل بدن" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-category">دسته‌بندی</Label>
              <Select id="service-category" defaultValue={CATEGORIES[0]?.slug}>
                {CATEGORIES.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="service-duration">مدت (دقیقه)</Label>
                <Input
                  id="service-duration"
                  type="number"
                  inputMode="numeric"
                  placeholder="۴۵"
                  className="no-spinner"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-price">تعرفه (تومان)</Label>
                <Input
                  id="service-price"
                  type="number"
                  inputMode="numeric"
                  placeholder="۲۹۰۰۰۰۰"
                  className="no-spinner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service-description">توضیح کوتاه</Label>
              <Textarea
                id="service-description"
                className="min-h-24"
                placeholder="نوع دستگاه، تعداد جلسات پیشنهادی و مراقبت‌های پس از جلسه..."
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface p-4">
              <Label htmlFor="service-active" className="text-xs">
                نمایش در صفحه عمومی مرکز
              </Label>
              <Switch id="service-active" defaultChecked />
            </div>

            <Button type="submit" className="w-full">
              <Plus />
              ثبت خدمت
            </Button>
          </form>
        </aside>
      </div>
    </>
  );
}
