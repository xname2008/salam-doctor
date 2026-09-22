import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";

import { ClientAppointmentsBoard } from "./client-appointments-board";

export const metadata: Metadata = { title: "نوبت‌های من" };

export default function ClientAppointmentsPage() {
  return (
    <>
      <PageHeader
        title="نوبت‌های من"
        description="تاریخچه مراجعات و رزروهای آینده شما در مراکز زیبایی شیراز."
        action={
          <Button asChild>
            <Link href="/dashboard/client/book">
              <Search />
              رزرو نوبت جدید
            </Link>
          </Button>
        }
      />
      <ClientAppointmentsBoard />
    </>
  );
}
