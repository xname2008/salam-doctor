import type { Metadata } from "next";

import { ClientOverview } from "./client-overview";

export const metadata: Metadata = { title: "پیش‌خوان" };

export default function ClientOverviewPage() {
  return <ClientOverview />;
}
