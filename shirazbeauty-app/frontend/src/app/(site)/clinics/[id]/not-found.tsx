import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function ClinicNotFound() {
  return (
    <section className="container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-azure">
        ۴۰۴
      </p>
      <h1 className="mt-4 text-2xl font-extrabold text-ink sm:text-3xl">
        این کلینیک در فهرست عمومی نیست
      </h1>
      <p className="mt-4 max-w-md text-sm leading-8 text-ink-muted">
        ممکن است مرکز هنوز تایید نشده باشد یا شناسه صفحه اشتباه باشد. از فهرست
        کلینیک‌های تاییدشده شیراز انتخاب کنید.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/clinics">مشاهده کلینیک‌های تاییدشده</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">بازگشت به صفحه اصلی</Link>
        </Button>
      </div>
    </section>
  );
}
