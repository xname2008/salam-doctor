import type { Metadata } from "next";
import { redirect } from "next/navigation";

import type { AuthRole } from "@/components/auth/role-selector";
import { VerifyForm } from "@/components/auth/verify-form";
import { safeInternalPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "تایید شماره موبایل",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ mobile?: string; role?: string; next?: string }>;
}) {
  const { mobile, role, next } = await searchParams;

  // Landing here without a mobile number means the first step was skipped.
  if (!mobile) {
    const login = new URLSearchParams();
    if (role === "clinic") login.set("role", "clinic");
    const nextPath = safeInternalPath(next);
    if (nextPath) login.set("next", nextPath);
    redirect(`/auth/login${login.size ? `?${login.toString()}` : ""}`);
  }

  const authRole: AuthRole = role === "clinic" ? "clinic" : "client";

  return (
    <VerifyForm
      mobile={mobile}
      role={authRole}
      nextPath={safeInternalPath(next)}
    />
  );
}
