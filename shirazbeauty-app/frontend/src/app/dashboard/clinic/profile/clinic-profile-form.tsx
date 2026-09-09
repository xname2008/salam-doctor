"use client";

import { BadgeCheck, Loader2, Phone, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, toErrorMessage } from "@/lib/api";
import type { ApiClinicProfile, ClinicMeResponse } from "@/types";

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function emptyFormFrom(data: ClinicMeResponse | null | undefined) {
  return {
    clinicName: asText(data?.clinic_name),
    address: asText(data?.address),
    contactNumber: asText(data?.contact_number),
    profileId: typeof data?.id === "number" ? data.id : null,
    isVerified: Boolean(data?.is_verified),
  };
}

export function ClinicProfileForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [address, setAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [profileId, setProfileId] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await api.get<ClinicMeResponse>("/clinics/me");
        if (cancelled) return;
        const next = emptyFormFrom(data);
        setClinicName(next.clinicName);
        setAddress(next.address);
        setContactNumber(next.contactNumber);
        setProfileId(next.profileId);
        setIsVerified(next.isVerified);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          toast.error("برای ویرایش اطلاعات مرکز وارد حساب کلینیک شوید");
          router.push("/auth/login?role=clinic");
          return;
        }
        // A missing profile used to 404. Treat that as a blank form so the
        // manager can still type and submit.
        if (error instanceof ApiError && error.status === 404) {
          const next = emptyFormFrom(null);
          setClinicName(next.clinicName);
          setAddress(next.address);
          setContactNumber(next.contactNumber);
          setProfileId(next.profileId);
          setIsVerified(next.isVerified);
          return;
        }
        toast.error("اطلاعات مرکز دریافت نشد", {
          description: toErrorMessage(error),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setFieldErrors({});
    setSaving(true);

    try {
      const wasCreate = profileId === null;
      const saved = await api.put<ApiClinicProfile>("/clinics/me", {
        clinic_name: clinicName.trim(),
        address: address.trim(),
        contact_number: contactNumber.trim(),
      });
      setProfileId(saved.id);
      setClinicName(saved.clinic_name);
      setAddress(saved.address);
      setContactNumber(saved.contact_number);
      setIsVerified(saved.is_verified);
      toast.success(
        wasCreate ? "پروفایل مرکز با موفقیت ایجاد شد" : "اطلاعات مرکز ذخیره شد",
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error("نشست شما منقضی شده است. دوباره وارد شوید");
        router.push("/auth/login?role=clinic");
        return;
      }
      if (error instanceof ApiError && error.fieldErrors) {
        setFieldErrors(error.fieldErrors);
      }
      toast.error("ذخیره اطلاعات مرکز انجام نشد", {
        description: toErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
      <section className="rounded-2xl border border-border bg-white p-6 shadow-soft-sm sm:p-8">
        <h2 className="text-base font-bold text-ink">مشخصات اصلی</h2>
        <p className="mt-1.5 text-xs text-ink-muted">
          {profileId === null
            ? "هنوز پروفایلی برای این حساب ثبت نشده. فرم را پر کنید تا مرکز شما ایجاد شود."
            : "این اطلاعات در صفحه عمومی مرکز شما نمایش داده می‌شود."}
        </p>
        <Separator className="my-6" />

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="clinic-name">نام مرکز</Label>
            <Input
              id="clinic-name"
              value={clinicName}
              onChange={(event) => setClinicName(event.target.value)}
              placeholder="مثلا کلینیک زیبایی نهال"
              required
              minLength={2}
              maxLength={160}
            />
            {fieldErrors.clinic_name ? (
              <p className="text-[11px] text-destructive">{fieldErrors.clinic_name}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic-address">آدرس دقیق</Label>
            <Input
              id="clinic-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="شیراز، بلوار معالی‌آباد، ..."
              required
              minLength={5}
            />
            {fieldErrors.address ? (
              <p className="text-[11px] text-destructive">{fieldErrors.address}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinic-phone">تلفن تماس</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute inset-y-0 start-4 my-auto size-4 text-ink-muted" />
              <Input
                id="clinic-phone"
                dir="ltr"
                className="ps-11 text-start"
                value={contactNumber}
                onChange={(event) => setContactNumber(event.target.value)}
                placeholder="07136251478"
                required
                maxLength={20}
              />
            </div>
            {fieldErrors.contact_number ? (
              <p className="text-[11px] text-destructive">
                {fieldErrors.contact_number}
              </p>
            ) : null}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {profileId === null ? "ایجاد پروفایل مرکز" : "ذخیره تغییرات"}
            </Button>
          </div>
        </form>
      </section>

      <aside className="space-y-6">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-soft-sm">
          <h2 className="text-base font-bold text-ink">وضعیت احراز هویت</h2>
          {isVerified ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-mint/10 p-4">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-mint" />
              <div>
                <p className="text-xs font-semibold text-mint">مرکز تاییدشده</p>
                <p className="mt-1 text-[11px] leading-6 text-ink-muted">
                  مجوز فعالیت شما بررسی شده و مرکز در فهرست عمومی نمایش داده می‌شود.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber/10 p-4">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber" />
              <div>
                <p className="text-xs font-semibold text-amber">در انتظار تایید</p>
                <p className="mt-1 text-[11px] leading-6 text-ink-muted">
                  پس از ذخیره پروفایل، کارشناسان شیراز بیوتی مجوز فعالیت را بررسی
                  می‌کنند. تا آن زمان مرکز در فهرست عمومی دیده نمی‌شود.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
      <div className="rounded-2xl border border-border bg-white p-6 sm:p-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-3 h-3 w-64" />
        <Separator className="my-6" />
        <div className="space-y-5">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}
