import { BadgeCheck, MapPin, Sparkles, Zap } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
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
    <Card className="group overflow-hidden hover:-translate-y-1 hover:border-azure/35 hover:shadow-soft">
      <Link href={`/clinics/${clinic.id}`} className="block">
        <div className="relative h-44 overflow-hidden bg-gradient-tint">
          <div className="absolute inset-0 flex items-center justify-center opacity-35">
            <BrandMark className="size-16" />
          </div>

          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <Badge variant="verified" className="bg-white/90">
              <BadgeCheck />
              تاییدشده
            </Badge>
            <Badge variant="azure" className="bg-white/90">
              <Zap />
              رزرو آنلاین
            </Badge>
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-base font-bold text-ink transition-colors group-hover:text-azure">
            {clinic.clinic_name}
          </h3>

          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
            <MapPin className="size-3.5 shrink-0 text-azure" />
            <span className="line-clamp-1">{district}</span>
            <span className="mx-1 text-border">|</span>
            <span className="num-fa shrink-0">
              {toPersianDigits(clinic.services.length)} خدمت
            </span>
          </p>

          {serviceLabels.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {serviceLabels.map((label) => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Sparkles className="size-3.5 text-azure" />
              شروع قیمت از
            </span>
            <span className="text-sm font-bold text-ink num-fa">
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
