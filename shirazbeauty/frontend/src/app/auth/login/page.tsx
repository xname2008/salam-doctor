import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import type { AuthRole } from "@/components/auth/role-selector";
import { safeInternalPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "ورود یا ثبت‌نام",
  description:
    "با شماره موبایل خود وارد شیراز بیوتی شوید و نوبت کلینیک‌های زیبایی شیراز را آنلاین رزرو کنید.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; next?: string }>;
}) {
  const { role, next } = await searchParams;
  const initialRole: AuthRole = role === "clinic" ? "clinic" : "client";

  return <LoginForm initialRole={initialRole} nextPath={safeInternalPath(next)} />;
}
