import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";

import { ClinicProfileForm } from "./clinic-profile-form";

export const metadata: Metadata = { title: "اطلاعات مرکز" };

export default function ClinicProfilePage() {
  return (
    <>
      <PageHeader
        title="اطلاعات مرکز"
        description="اطلاعاتی که در صفحه عمومی مرکز شما به زیباجویان نمایش داده می‌شود."
      />
      <ClinicProfileForm />
    </>
  );
}
