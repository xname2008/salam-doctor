"use client";

import { ArrowLeft, Loader2, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { RoleSelector, type AuthRole } from "@/components/auth/role-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { UI_ROLE_TO_API } from "@/lib/auth";
import { toEnglishDigits } from "@/lib/utils";
import type { OtpRequestResponse } from "@/types";

const MOBILE_PATTERN = /^09\d{9}$/;

export function LoginForm({
  initialRole = "client",
  nextPath = null,
}: {
  initialRole?: AuthRole;
  nextPath?: string | null;
}) {
  const router = useRouter();
  const [role, setRole] = useState<AuthRole>(initialRole);
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    // Users often paste Persian digits; normalise before validating.
    const normalised = toEnglishDigits(mobile).replace(/[\s-]/g, "");

    if (!MOBILE_PATTERN.test(normalised)) {
      setError("شماره موبایل معتبر نیست. نمونه صحیح: ۰۹۱۲۳۴۵۶۷۸۹");
      return;
    }

    setError(null);
    setSubmitting(true);

    const verifyParams = new URLSearchParams({
      mobile: normalised,
      role,
    });
    if (nextPath) verifyParams.set("next", nextPath);
    const nextStep = `/auth/verify?${verifyParams.toString()}`;

    try {
      const response = await api.post<OtpRequestResponse>(
        "/auth/login",
        { mobile_number: normalised, role: UI_ROLE_TO_API[role] },
        { auth: false },
      );

      toast.success(response.message, {
        // Only ever set outside production, so this cannot leak a live code.
        description: response.debug_code
          ? `کد تست: ${response.debug_code}`
          : undefined,
      });

      router.push(nextStep);
    } catch (caught) {
      if (caught instanceof ApiError) {
        // 429 means a code was already sent and is still valid, so the user
        // should continue to the verify step rather than be blocked here.
        if (caught.status === 429) {
          toast.info(caught.message);
          router.push(nextStep);
          return;
        }

        const fieldError = caught.fieldErrors?.mobile_number;
        if (fieldError) setError(fieldError);
        toast.error(caught.message);
      } else {
        toast.error("خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.");
      }

      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs text-ink-muted transition-colors hover:text-rose"
      >
        بازگشت به صفحه اصلی
        <ArrowLeft className="size-3.5" />
      </Link>

      <h1 className="mt-8 text-2xl font-extrabold text-ink">ورود یا ثبت‌نام</h1>
      <p className="mt-3 text-sm leading-8 text-ink-muted">
        شماره موبایل خود را وارد کنید. کد تایید برای شما پیامک می‌شود.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
        <div className="space-y-3">
          <Label>نوع ورود</Label>
          <RoleSelector value={role} onChange={setRole} disabled={submitting} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mobile">شماره موبایل</Label>
          <div className="relative">
            <Smartphone className="pointer-events-none absolute inset-y-0 start-4 my-auto size-4 text-ink-muted" />
            <Input
              id="mobile"
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              placeholder="09123456789"
              value={mobile}
              disabled={submitting}
              onChange={(event) => {
                setMobile(event.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "mobile-error" : undefined}
              className="ps-11 text-start tracking-widest"
            />
          </div>
          {error ? (
            <p id="mobile-error" role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" />
              در حال ارسال کد...
            </>
          ) : (
            "دریافت کد تایید"
          )}
        </Button>
      </form>

      <p className="mt-8 text-center text-[11px] leading-6 text-ink-muted">
        با ورود به شیراز بیوتی،{" "}
        <Link href="/terms" className="text-rose hover:underline">
          قوانین و مقررات
        </Link>{" "}
        و{" "}
        <Link href="/privacy" className="text-rose hover:underline">
          حریم خصوصی
        </Link>{" "}
        را می‌پذیرید.
      </p>
    </div>
  );
}
