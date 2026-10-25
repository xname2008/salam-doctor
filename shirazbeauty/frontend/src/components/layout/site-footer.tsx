import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
import { FOOTER_NAV, SITE } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-6 bg-ink text-white">
      <div className="container py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-white/10">
                <BrandMark className="size-7 [&_stop]:[stop-color:#E8B4C0]" />
              </span>
              <span className="text-base font-extrabold tracking-tight">{SITE.name}</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-white/65">{SITE.description}</p>

            <ul className="mt-6 space-y-3 text-sm text-white/65">
              <li className="flex items-start gap-3">
                <MapPin className="mt-1 size-4 shrink-0 text-rose-light" />
                <span>{SITE.address}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="size-4 shrink-0 text-rose-light" />
                <a
                  href={`tel:${SITE.phoneHref}`}
                  className="num-fa transition-colors hover:text-white"
                >
                  {SITE.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="size-4 shrink-0 text-rose-light" />
                <a
                  href={`mailto:${SITE.email}`}
                  dir="ltr"
                  className="transition-colors hover:text-white"
                >
                  {SITE.email}
                </a>
              </li>
            </ul>
          </div>

          {FOOTER_NAV.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-bold text-white">{column.title}</h3>
              <span className="mt-3 block h-px w-10 bg-gradient-rose" />
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 transition-colors hover:text-rose-light"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 h-px bg-gradient-to-l from-transparent via-white/15 to-transparent" />

        <div className="flex flex-col items-center justify-between gap-3 pt-6 text-xs text-white/45 sm:flex-row">
          <p className="num-fa">© ۱۴۰۵ {SITE.name} — تمامی حقوق محفوظ است.</p>
          <p>طراحی و توسعه در شیراز</p>
        </div>
      </div>
    </footer>
  );
}
