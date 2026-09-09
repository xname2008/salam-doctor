import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
import { FOOTER_NAV, SITE } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-gradient-surface">
      <div className="container py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <BrandMark />
              <span className="text-lg font-extrabold tracking-tight text-ink">
                {SITE.name}
              </span>
            </div>
            <p className="mt-5 text-sm leading-8 text-ink-muted">{SITE.description}</p>

            <ul className="mt-6 space-y-3 text-sm text-ink-muted">
              <li className="flex items-start gap-3">
                <MapPin className="mt-1 size-4 shrink-0 text-azure" />
                <span>{SITE.address}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="size-4 shrink-0 text-azure" />
                <a
                  href={`tel:${SITE.phoneHref}`}
                  className="num-fa transition-colors hover:text-ink"
                >
                  {SITE.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="size-4 shrink-0 text-azure" />
                <a
                  href={`mailto:${SITE.email}`}
                  dir="ltr"
                  className="transition-colors hover:text-ink"
                >
                  {SITE.email}
                </a>
              </li>
            </ul>
          </div>

          {FOOTER_NAV.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-bold text-ink">{column.title}</h3>
              <span className="mt-3 block h-px w-10 bg-gradient-azure" />
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-muted transition-colors hover:text-azure"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider-azure mt-14" />

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-ink-muted sm:flex-row">
          <p className="num-fa">© ۱۴۰۵ {SITE.name} — تمامی حقوق محفوظ است.</p>
          <p>طراحی و توسعه در شیراز</p>
        </div>
      </div>
    </footer>
  );
}
