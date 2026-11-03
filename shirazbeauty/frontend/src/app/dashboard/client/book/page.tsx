import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";

import { BookingFlow } from "./booking-flow";

export const metadata: Metadata = { title: "رزرو نوبت" };

export default async function ClientBookPage({
  searchParams,
}: {
  searchParams: Promise<{ clinic_id?: string; service_id?: string }>;
}) {
  const params = await searchParams;
  const clinicId = Number(params.clinic_id);
  const serviceId = Number(params.service_id);

  return (
    <>
      <PageHeader
        title="رزرو نوبت زیبایی"
        description="کلینیک و خدمت را انتخاب کنید، روز شمسی را برگزینید و نوبت خود را ثبت کنید."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/client/appointments">
              <CalendarDays />
              نوبت‌های من
            </Link>
          </Button>
        }
      />
      <BookingFlow
        initialClinicId={Number.isInteger(clinicId) && clinicId > 0 ? clinicId : null}
        initialServiceId={
          Number.isInteger(serviceId) && serviceId > 0 ? serviceId : null
        }
      />
    </>
  );
}
