import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: { default: "پنل زیباجو", template: "%s | پنل زیباجو" },
  robots: { index: false, follow: false },
};

export default function ClientDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell
      panel="client"
      panelLabel="پنل زیباجو"
      profileHref="/dashboard/client/profile"
    >
      {children}
    </DashboardShell>
  );
}
