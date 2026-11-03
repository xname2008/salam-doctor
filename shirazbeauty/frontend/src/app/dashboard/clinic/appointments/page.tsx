import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";

import { ClinicAppointmentsBoard } from "./clinic-appointments-board";

export const metadata: Metadata = { title: "مدیریت نوبت‌ها" };

export default function ClinicAppointmentsPage() {
  return (
    <>
      <PageHeader
        title="مدیریت نوبت‌ها"
        description="رزروهای زیباجویان را ببینید، تایید کنید یا در صورت نیاز لغو نمایید."
      />
      <ClinicAppointmentsBoard />
    </>
  );
}
