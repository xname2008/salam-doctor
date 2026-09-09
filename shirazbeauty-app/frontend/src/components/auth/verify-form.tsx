"use client";

import { ArrowLeft, Loader2, MessageSquareText, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { OtpInput } from "@/components/auth/otp-input";
import type { AuthRole } from "@/components/auth/role-selector";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import {
  UI_ROLE_TO_API,
  decodeAccessToken,
  postLoginPath,
  saveSession,
} from "@/lib/auth";
import { formatCountdown, maskMobile } from "@/lib/utils";
import type { AuthResponse, OtpRequestResponse } from "@/types";

const OTP_LENGTH = 5;
const COMPLETE_CODE = /^\d{5}$/;
/** Mirrors OTP_RESEND_COOLDOWN_SECONDS on the API. */
const RESEND_SECONDS = 60;

interface VerifyFormProps {
  mobile: string;
  role: AuthRole;
  nextPath?: string | null;
}

export function VerifyForm({ mobile, role, nextPath = null }: VerifyFormProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  // Guards against the auto-submit firing twice when the user types the last
  // digit and then presses the button before navigation completes.
  const inFlight = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const submit = useCallback(
    async (value: string) => {
      if (inFlight.current) return;

      if (!COMPLETE_CODE.test(value)) {
        setError("کد تایید باید ۵ رقم باشد.");
        return;
      }

      inFlight.current = true;
      setError(null);
      setSubmitting(true);

      try {
        const auth = await api.post<AuthResponse>(
          "/auth/verify",
          {
            mobile_number: mobile,
            otp: value,
            role: UI_ROLE_TO_API[role],
          },
          { auth: false },
        );

        saveSession(auth);

        toast.success(
          auth.is_new_user ? "حساب شما با موفقیت ساخته شد." : "خوش آمدید!",
        );

        // Prefer the user object the API returned; fall back to the JWT
        // `role` claim. Never trust the query-string role — a hand-edited
        // URL must not drop anyone into the clinic panel.
        const roleFromToken = decodeAccessToken(auth.access_token)?.role;
        const resolvedRole = auth.user.role ?? roleFromToken;
        router.replace(postLoginPath(resolvedRole, nextPath));
      } catch (caught) {
        inFlight.current = false;
        setSubmitting(false);

        const message =
          caught instanceof ApiError
            ? caught.message
            : "خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.";

        setError(message);
        toast.error(message);

        // Wrong or expired code: clear the boxes so the next attempt starts clean.
        if (caught instanceof ApiError && caught.status === 400) {
          setCode("");
        }
      }
    },
    [mobile, role, nextPath, router],
  );

  async function handleResend() {
    if (resending || secondsLeft > 0) return;

    setResending(true);
    setError(null);

    try {
      const response = await api.post<OtpRequestResponse>(
        "/auth/login",
        { mobile_number: mobile, role: UI_ROLE_TO_API[role] },
        { auth: false },
      );

      setCode("");
      setSecondsLeft(response.resend_after || RESEND_SECONDS);

      toast.success(response.message, {
        description: response.debug_code
          ? `کد تست: ${response.debug_code}`
          : undefined,
      });
    } catch (caught) {
      if (caught instanceof ApiError) {
        // Still inside the cooldown; sync the timer to what the server says.
        if (caught.status === 429 && caught.retryAfter) {
          setSecondsLeft(caught.retryAfter);
        }
        toast.error(caught.message);
      } else {
        toast.error("ارسال مجدد کد ناموفق بود. دوباره تلاش کنید.");
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <Link
        href={
          nextPath
            ? `/auth/login?role=${role}&next=${encodeURIComponent(nextPath)}`
            : `/auth/login?role=${role}`
        }
        className="inline-flex items-center gap-2 text-xs text-ink-muted transition-colors hover:text-azure"
      >
        تغییر شماره موبایل
        <ArrowLeft className="size-3.5" />
      </Link>

      <span className="mt-8 flex size-12 items-center justify-center rounded-2xl bg-azure-tint text-azure">
        <MessageSquareText className="size-6" />
      </span>

      <h1 className="mt-6 text-2xl font-extrabold text-ink">کد تایید را وارد کنید</h1>
      <p className="mt-3 text-sm leading-8 text-ink-muted">
        کد ۵ رقمی به شماره{" "}
        <span dir="ltr" className="font-semibold text-ink num-fa">
          {maskMobile(mobile)}
        </span>{" "}
        پیامک شد.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(code);
        }}
        className="mt-8 space-y-6"
      >
        <OtpInput
          length={OTP_LENGTH}
          value={code}
          onChange={(next) => {
            setCode(next);
            if (error) setError(null);
          }}
          onComplete={(next) => void submit(next)}
          invalid={Boolean(error)}
          disabled={submitting}
        />

        {error ? (
          <p role="alert" className="text-center text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || !COMPLETE_CODE.test(code)}
        >
          {submitting ? (
            <>
              <Loader2 className="animate-spin" />
              در حال بررسی...
            </>
          ) : (
            "تایید و ورود"
          )}
        </Button>
      </form>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-ink-muted">
        {secondsLeft > 0 ? (
          <>
            <span>ارسال مجدد کد تا</span>
            <span className="font-semibold text-ink num-fa" dir="ltr">
              {formatCountdown(secondsLeft)}
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={resending}
            className="inline-flex items-center gap-2 font-semibold text-azure transition-colors hover:text-azure-dark disabled:opacity-60"
          >
            {resending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCw className="size-3.5" />
            )}
            {resending ? "در حال ارسال..." : "ارسال مجدد کد تایید"}
          </button>
        )}
      </div>
    </div>
  );
}
