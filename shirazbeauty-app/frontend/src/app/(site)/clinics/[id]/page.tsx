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

import { BrandMark } from "@/components/shared/brand-mark";
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

      <section className="relative overflow-hidden bg-gradient-surface pb-16 pt-10 sm:pb-20 sm:pt-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dotted opacity-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-24 top-0 size-[28rem] rounded-full bg-azure-tint blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -end-16 bottom-0 size-80 rounded-full bg-azure/10 blur-3xl"
        />

        <div className="container relative">
          <nav
            aria-label="مسیر صفحه"
            className="flex flex-wrap items-center gap-2 text-xs text-ink-muted"
          >
            <Link href="/" className="transition-colors hover:text-azure">
              خانه
            </Link>
            <span aria-hidden>/</span>
            <Link href="/clinics" className="transition-colors hover:text-azure">
              کلینیک‌ها
            </Link>
            <span aria-hidden>/</span>
            <span className="font-medium text-ink">{clinic.clinic_name}</span>
          </nav>

          <div className="mt-8 overflow-hidden rounded-[2rem] border border-azure/15 bg-white/80 shadow-soft backdrop-blur-sm">
            <div className="relative min-h-52 bg-gradient-azure px-6 py-10 text-white sm:min-h-64 sm:px-12 sm:py-14">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-10 opacity-15"
              >
                <BrandMark className="size-40 [&_stop]:[stop-color:#fff] [&_rect]:stroke-white" />
              </div>

              {clinic.is_verified ? (
                <Badge variant="verified" className="bg-white/95">
                  <BadgeCheck />
                  مرکز تاییدشده
                </Badge>
              ) : null}

              <h1 className="mt-5 max-w-3xl text-3xl font-extrabold leading-[1.55] sm:text-5xl sm:leading-[1.45]">
                {clinic.clinic_name}
              </h1>
              <p className="mt-4 flex max-w-2xl items-start gap-2 text-sm leading-8 text-white/85 sm:text-base">
                <MapPin className="mt-1 size-4 shrink-0" />
                {clinic.address}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-white text-azure-dark shadow-soft hover:bg-azure-tint hover:text-azure-dark"
                >
                  <a href="#services">
                    <CalendarCheck />
                    مشاهده خدمات و رزرو
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
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

      <section className="container -mt-6 pb-20 sm:pb-28">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.9fr)] lg:items-start">
          <div className="space-y-6">
            <article className="rounded-3xl border border-azure/10 bg-white p-6 shadow-soft-sm sm:p-8">
              <span className="text-xs font-semibold uppercase tracking-[0.28em] text-azure">
                درباره مرکز
              </span>
              <h2 className="mt-3 text-xl font-extrabold text-ink sm:text-2xl">
                معرفی {clinic.clinic_name}
              </h2>
              <span className="mt-3 block h-px w-16 bg-gradient-azure" />
              <p className="mt-5 text-sm leading-9 text-ink-muted sm:text-[15px]">
                {clinic.description}
              </p>
            </article>

            <article className="rounded-3xl border border-azure/10 bg-white p-6 shadow-soft-sm sm:p-8">
              <h2 className="text-lg font-extrabold text-ink">آدرس و تماس</h2>
              <dl className="mt-6 space-y-5 text-sm">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-azure-tint text-azure">
                    <MapPin className="size-4" />
                  </span>
                  <div>
                    <dt className="text-xs text-ink-muted">آدرس</dt>
                    <dd className="mt-1 font-medium leading-8 text-ink">
                      {clinic.address}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-azure-tint text-azure">
                    <Phone className="size-4" />
                  </span>
                  <div>
                    <dt className="text-xs text-ink-muted">تلفن مرکز</dt>
                    <dd className="mt-1">
                      <a
                        href={`tel:${clinic.contact_number}`}
                        dir="ltr"
                        className="font-semibold text-azure num-fa hover:text-azure-dark"
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
            <div className="overflow-hidden rounded-3xl border border-azure/15 bg-white shadow-soft">
              <div className="border-b border-azure/10 bg-gradient-to-l from-azure-tint/80 to-white px-6 py-5">
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink">
                  <Sparkles className="size-4 text-azure" />
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
                            <Clock3 className="size-3.5 text-azure" />
                            <span className="num-fa">
                              {toPersianDigits(service.duration_minutes)} دقیقه
                            </span>
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-extrabold text-azure num-fa">
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
