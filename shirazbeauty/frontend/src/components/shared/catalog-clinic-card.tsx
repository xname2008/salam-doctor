import { BadgeCheck, MapPin, Zap } from "lucide-react";
import Link from "next/link";

import { ClinicCover } from "@/components/shared/clinic-cover";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  catalogStartingPrice,
  districtFromAddress,
} from "@/lib/public-clinic";
import { formatToman, toPersianDigits } from "@/lib/utils";
import type { CatalogClinic } from "@/types";

export function CatalogClinicCard({ clinic }: { clinic: CatalogClinic }) {
  const startingPrice = catalogStartingPrice(clinic);
  const district = districtFromAddress(clinic.address);
  const serviceLabels = clinic.services.slice(0, 2).map((service) => service.service_name);

  return (
    <Card className="group overflow-hidden rounded-2xl hover:-translate-y-0.5 hover:border-rose/20 hover:shadow-soft">
      <Link href={`/clinics/${clinic.id}`} className="block">
        <ClinicCover name={clinic.clinic_name} seed={clinic.id}>
          <div className="flex items-start justify-between">
            <Badge variant="verified" className="bg-white/90">
              <BadgeCheck />
              تاییدشده
            </Badge>
            <Badge variant="azure" className="bg-white/90">
              <Zap />
              رزرو آنلاین
            </Badge>
          </div>
        </ClinicCover>

        <div className="px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4">
          <h3 className="text-[15px] font-bold leading-7 text-ink transition-colors duration-300 group-hover:text-rose sm:text-base">
            {clinic.clinic_name}
          </h3>

          <p className="mt-1 flex items-center gap-1 text-[11px] leading-6 text-ink-muted">
            <MapPin className="size-3 shrink-0 text-rose/70" />
            <span className="truncate">{district}</span>
            <span className="mx-0.5 text-border">·</span>
            <span className="num-fa shrink-0">
              {toPersianDigits(clinic.services.length)} خدمت
            </span>
          </p>

          {serviceLabels.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {serviceLabels.map((label) => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between border-t border-border/80 pt-3">
            <span className="text-[11px] text-ink-muted">شروع از</span>
            <span className="text-xs font-semibold text-ink num-fa">
              {startingPrice !== null
                ? `${formatToman(startingPrice)} تومان`
                : "تماس بگیرید"}
            </span>
          </div>
        </div>
      </Link>
    </Card>
  );
}
