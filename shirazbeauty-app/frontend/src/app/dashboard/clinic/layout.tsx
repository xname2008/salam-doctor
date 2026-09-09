import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const metadata: Metadata = {
  title: { default: "پنل مدیریت مرکز", template: "%s | پنل مدیریت مرکز" },
  robots: { index: false, follow: false },
};

export default function ClinicDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell
      panel="clinic"
      panelLabel="پنل مدیریت مرکز"
      profileHref="/dashboard/clinic/profile"
    >
      {children}
    </DashboardShell>
  );
}
