import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";

import { ClinicCalendarManager } from "./clinic-calendar-manager";

export const metadata: Metadata = { title: "تقویم و زمان‌بندی" };

export default function ClinicCalendarPage() {
  return (
    <>
      <PageHeader
        title="تقویم و زمان‌بندی"
        description="روزهای باز و تعطیل مرکز را روی تقویم شمسی مشخص کنید و برای هر روز یادداشت داخلی بگذارید."
      />
      <ClinicCalendarManager />
    </>
  );
}
