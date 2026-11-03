"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function SiteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="inline-flex items-center rounded-full border border-rose/15 bg-rose-tint/70 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-rose">
        خطا
      </span>
      <h1 className="mt-4 text-2xl font-extrabold text-ink sm:text-3xl">
        نمایش این صفحه ممکن نشد
      </h1>
      <p className="mt-4 max-w-md text-sm leading-8 text-ink-muted">
        لطفا دوباره تلاش کنید. اگر مشکل ادامه داشت، چند لحظه دیگر سر بزنید.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          تلاش دوباره
        </Button>
        <Button asChild variant="outline">
          <Link href="/">بازگشت به خانه</Link>
        </Button>
      </div>
    </section>
  );
}
