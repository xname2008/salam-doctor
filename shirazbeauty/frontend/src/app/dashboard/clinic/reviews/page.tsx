import { EyeOff, MessageSquareQuote, Reply, Star } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CLINIC_REVIEWS } from "@/lib/dashboard-data";
import { cn, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "نظرات زیباجویان" };

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`امتیاز ${rating} از ۵`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "size-3.5",
            index < rating ? "fill-amber text-amber" : "text-border",
          )}
        />
      ))}
    </span>
  );
}

export default function ClinicReviewsPage() {
  const average =
    CLINIC_REVIEWS.reduce((sum, review) => sum + review.rating, 0) /
    CLINIC_REVIEWS.length;
  const awaiting = CLINIC_REVIEWS.filter((review) => !review.reply).length;
  const hidden = CLINIC_REVIEWS.filter((review) => !review.isPublished).length;

  return (
    <>
      <PageHeader
        title="نظرات زیباجویان"
        description="به بازخورد مراجعان پاسخ دهید تا اعتماد مراجعان جدید جلب شود."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="میانگین امتیاز"
          value={toPersianDigits(average.toFixed(1))}
          hint={`از ${toPersianDigits(CLINIC_REVIEWS.length)} نظر ثبت‌شده`}
          icon={Star}
          tone="amber"
        />
        <StatCard
          label="در انتظار پاسخ"
          value={toPersianDigits(awaiting)}
          hint="نظر بدون پاسخ"
          icon={MessageSquareQuote}
        />
        <StatCard
          label="در انتظار انتشار"
          value={toPersianDigits(hidden)}
          hint="در حال بررسی توسط ادمین"
          icon={EyeOff}
          tone="neutral"
        />
      </section>

      <div className="mt-8 space-y-5">
        {CLINIC_REVIEWS.map((review) => (
          <article
            key={review.id}
            className="rounded-2xl border border-border bg-white p-6 shadow-soft-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{review.client.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-ink">{review.client}</p>
                  <p className="mt-1 text-[11px] text-ink-muted num-fa">
                    {review.service} — {review.jalaliDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Stars rating={review.rating} />
                {review.isPublished ? (
                  <Badge variant="verified">منتشر شده</Badge>
                ) : (
                  <Badge variant="warning">در انتظار بررسی</Badge>
                )}
              </div>
            </div>

            <p className="mt-5 text-sm leading-8 text-ink">{review.comment}</p>

            {review.reply ? (
              <div className="mt-5 rounded-xl border-s-2 border-rose bg-surface p-4">
                <p className="text-[11px] font-semibold text-rose">پاسخ مرکز</p>
                <p className="mt-2 text-xs leading-7 text-ink-muted">{review.reply}</p>
              </div>
            ) : (
              <form className="mt-5 space-y-3">
                <Textarea
                  className="min-h-20"
                  placeholder="پاسخ خود را بنویسید..."
                  aria-label={`پاسخ به نظر ${review.client}`}
                />
                <Button size="sm" type="submit">
                  <Reply />
                  ثبت پاسخ
                </Button>
              </form>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
