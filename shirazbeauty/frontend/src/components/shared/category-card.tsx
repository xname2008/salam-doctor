import {
  Brush,
  Droplets,
  Scissors,
  Sparkles,
  Stethoscope,
  Syringe,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { toPersianDigits } from "@/lib/utils";
import type { Category } from "@/types";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Syringe,
  Scissors,
  Droplets,
  Waves,
  Brush,
  Wind,
  Stethoscope,
};

export function CategoryCard({ category }: { category: Category }) {
  const Icon = ICONS[category.icon] ?? Sparkles;

  return (
    <Link
      href={`/services/${category.slug}`}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-border bg-white p-6 shadow-soft-sm transition-all duration-300 hover:-translate-y-1 hover:border-rose/30 hover:shadow-soft"
    >
      <span className="absolute -end-8 -top-8 size-24 rounded-full bg-rose-tint opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <span className="relative flex size-14 items-center justify-center rounded-2xl bg-rose-tint text-rose transition-colors duration-300 group-hover:bg-gradient-rose group-hover:text-white">
        <Icon className="size-6" />
      </span>

      <div className="relative">
        <h3 className="text-base font-bold text-ink">{category.name}</h3>
        <p className="mt-2 text-xs leading-6 text-ink-muted">{category.description}</p>
      </div>

      <span className="relative mt-auto text-xs font-medium text-rose num-fa">
        {toPersianDigits(category.clinicCount)} مرکز فعال
      </span>
    </Link>
  );
}
