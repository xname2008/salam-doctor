import type { Metadata } from "next";

import { ClinicOverview } from "./clinic-overview";

export const metadata: Metadata = { title: "پیش‌خوان" };

export default function ClinicOverviewPage() {
  return <ClinicOverview />;
}
