import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  Clock3,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ClinicCover } from "@/components/shared/clinic-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/constants";
import { fetchPublicClinic } from "@/lib/public-clinic";
import { formatToman, toPersianDigits } from "@/lib/utils";
import type { CatalogService, PublicClinicProfile } from "@/types";

export const revalidate = 120;

interface ClinicPageProps {
  params: Promise<{ id: string }>;
}

function servicePrice(service: CatalogService): number {
  return Number(service.price);
}

function clinicSeoDescription(clinic: PublicClinicProfile): string {
  return clinic.description.slice(0, 160);
}

export async function generateMetadata({
  params,
}: ClinicPageProps): Promise<Metadata> {
  const { id } = await params;
  const clinic = await fetchPublicClinic(id);

  if (!clinic) {
    return {
      title: "کلینیک یافت نشد",
      robots: { index: false, follow: false },
    };
  }

  const title = `${clinic.clinic_name} در شیراز`;
  const description = clinicSeoDescription(clinic);
  const path = `/clinics/${clinic.id}`;

  return {
    title,
    description,
    keywords: [
      clinic.clinic_name,
      "کلینیک زیبایی شیراز",
      "رزرو نوبت آنلاین",
      ...clinic.services.slice(0, 6).map((service) => service.service_name),
    ],
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "fa_IR",
      siteName: SITE.name,
      title: `${title} | ${SITE.name}`,
      description,
      url: path,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE.name}`,
      description,
    },
  };
}

export default async function PublicClinicPage({ params }: ClinicPageProps) {
  const { id } = await params;
  const clinic = await fetchPublicClinic(id);
  if (!clinic) notFound();

  const startingPrice = clinic.services.length
    ? Math.min(...clinic.services.map(servicePrice))
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: clinic.clinic_name,
    description: clinic.description,
    url: `${SITE.url}/clinics/${clinic.id}`,
    telephone: clinic.contact_number,
    address: {
      "@type": "PostalAddress",
      streetAddress: clinic.address,
      addressLocality: "شیراز",
      addressRegion: "فارس",
      addressCountry: "IR",
    },
    areaServed: "شیراز",
    ...(clinic.services.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: `خدمات ${clinic.clinic_name}`,
            itemListElement: clinic.services.map((service) => ({
              "@type": "Offer",
              name: service.service_name,
              price: servicePrice(service),
              priceCurrency: "IRR",
              url: `${SITE.url}/dashboard/client/book?clinic_id=${clinic.id}&service_id=${service.id}`,
            })),
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative overflow-hidden bg-gradient-hero pb-8 pt-6 sm:pb-10 sm:pt-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dotted opacity-50"
        />

        <div className="container relative">
          <nav
            aria-label="مسیر صفحه"
            className="flex flex-wrap items-center gap-2 text-xs text-ink-muted"
          >
            <Link href="/" className="transition-colors hover:text-rose">
              خانه
            </Link>
            <span aria-hidden>/</span>
            <Link href="/clinics" className="transition-colors hover:text-rose">
              کلینیک‌ها
            </Link>
            <span aria-hidden>/</span>
            <span className="font-medium text-ink">{clinic.clinic_name}</span>
          </nav>

          <div className="mt-6 overflow-hidden rounded-[2rem] border border-rose/10 bg-white shadow-soft">
            <ClinicCover
              name={clinic.clinic_name}
              seed={clinic.id}
              variant="hero"
              className="rounded-t-[2rem]"
            >
              <div className="flex h-full flex-col justify-start">
                {clinic.is_verified ? (
                  <Badge variant="verified" className="w-fit bg-white/95">
                    <BadgeCheck />
                    مرکز تاییدشده
                  </Badge>
                ) : null}
              </div>
            </ClinicCover>

            <div className="px-5 py-6 sm:px-8 sm:py-7">
              <h1 className="max-w-3xl text-2xl font-extrabold leading-snug text-ink sm:text-3xl">
                {clinic.clinic_name}
              </h1>
              <p className="mt-3 flex max-w-2xl items-start gap-2 text-sm leading-7 text-ink-muted">
                <MapPin className="mt-0.5 size-4 shrink-0 text-rose" />
                {clinic.address}
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <Button asChild>
                  <a href="#services">
                    <CalendarCheck />
                    مشاهده خدمات و رزرو
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`tel:${clinic.contact_number}`}>
                    <Phone />
                    <span className="num-fa" dir="ltr">
                      {toPersianDigits(clinic.contact_number)}
                    </span>
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container pb-16 sm:pb-20">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.9fr)] lg:items-start">
          <div className="space-y-6">
            <article className="rounded-3xl border border-rose/10 bg-white p-5 shadow-soft-sm sm:p-6">
              <span className="inline-flex items-center rounded-full border border-rose/15 bg-rose-tint/70 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-rose">
                درباره مرکز
              </span>
              <h2 className="mt-3 text-lg font-extrabold text-ink sm:text-xl">
                معرفی {clinic.clinic_name}
              </h2>
              <span className="mt-2 block h-px w-12 bg-gradient-rose" />
              <p className="mt-3 text-sm leading-7 text-ink-muted">
                {clinic.description}
              </p>
            </article>

            <article className="rounded-3xl border border-rose/10 bg-white p-5 shadow-soft-sm sm:p-6">
              <h2 className="text-base font-extrabold text-ink">آدرس و تماس</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-tint text-rose">
                    <MapPin className="size-4" />
                  </span>
                  <div>
                    <dt className="text-xs text-ink-muted">آدرس</dt>
                    <dd className="mt-0.5 font-medium leading-7 text-ink">
                      {clinic.address}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-tint text-rose">
                    <Phone className="size-4" />
                  </span>
                  <div>
                    <dt className="text-xs text-ink-muted">تلفن مرکز</dt>
                    <dd className="mt-1">
                      <a
                        href={`tel:${clinic.contact_number}`}
                        dir="ltr"
                        className="font-semibold text-rose num-fa hover:text-rose-dark"
                      >
                        {toPersianDigits(clinic.contact_number)}
                      </a>
                    </dd>
                  </div>
                </div>
              </dl>
            </article>
          </div>

          <aside id="services" className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-3xl border border-rose/15 bg-white shadow-soft">
              <div className="border-b border-rose/10 bg-gradient-to-l from-rose-tint/80 to-white px-6 py-5">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
                  <Sparkles className="size-4 text-rose" />
                  لیست خدمات
                </h2>
                <p className="mt-1.5 text-xs leading-6 text-ink-muted">
                  {startingPrice !== null
                    ? `شروع قیمت از ${formatToman(startingPrice)} تومان`
                    : "هنوز خدمتی برای رزرو آنلاین ثبت نشده است."}
                </p>
              </div>

              {clinic.services.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-ink-muted">
                  خدمات این مرکز به‌زودی اینجا نمایش داده می‌شود.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {clinic.services.map((service) => (
                    <li key={service.id} className="px-5 py-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink">
                            {service.service_name}
                          </p>
                          {service.description?.trim() ? (
                            <p className="mt-1.5 text-xs leading-7 text-ink-muted">
                              {service.description}
                            </p>
                          ) : null}
                          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                            <Clock3 className="size-3.5 text-rose" />
                            <span className="num-fa">
                              {toPersianDigits(service.duration_minutes)} دقیقه
                            </span>
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-extrabold text-rose num-fa">
                          {formatToman(servicePrice(service))}
                          <span className="ms-1 text-[11px] font-medium text-ink-muted">
                            تومان
                          </span>
                        </p>
                      </div>
                      <Button asChild variant="primary" size="sm" className="mt-4 w-full">
                        <Link
                          href={`/dashboard/client/book?clinic_id=${clinic.id}&service_id=${service.id}`}
                        >
                          دریافت نوبت
                          <ArrowLeft />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
