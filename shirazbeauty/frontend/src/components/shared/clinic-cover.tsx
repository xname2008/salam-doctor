import { Flower2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { clinicCoverMotif, clinicCoverTone } from "@/lib/clinic-visual";
import { cn } from "@/lib/utils";

interface ClinicCoverProps {
  name: string;
  seed?: string | number;
  imageSrc?: string | null;
  variant?: "card" | "hero" | "compact";
  className?: string;
  children?: ReactNode;
}

function PetalMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <path
        d="M16 4c2.2 4.3 4.7 6.8 9 9-4.3 2.2-6.8 4.7-9 9-2.2-4.3-4.7-6.8-9-9 4.3-2.2 6.8-4.7 9-9Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CoverMotifIcon({
  motif,
  className,
}: {
  motif: ReturnType<typeof clinicCoverMotif>;
  className?: string;
}) {
  if (motif === "sparkle") return <Sparkles className={className} strokeWidth={1.4} />;
  if (motif === "blossom") return <Flower2 className={className} strokeWidth={1.4} />;
  return <PetalMark className={className} />;
}

/**
 * Photo-ready clinic header. A real photo fills the frame when present;
 * otherwise a clinic-specific wash + pattern + a small floral mark —
 * never letters sliced from a Persian name.
 */
export function ClinicCover({
  name,
  seed,
  imageSrc,
  variant = "card",
  className,
  children,
}: ClinicCoverProps) {
  const visualSeed = seed ?? name;
  const tone = clinicCoverTone(visualSeed);
  const motif = clinicCoverMotif(visualSeed);
  const hasPhoto = Boolean(imageSrc?.trim());

  return (
    <div
      data-tone={tone}
      className={cn(
        "clinic-cover group/cover relative isolate overflow-hidden",
        variant === "hero" && "min-h-52 sm:min-h-64",
        variant === "card" && "h-36 sm:h-40",
        variant === "compact" && "h-24",
        className,
      )}
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- clinic photos are remote URLs
        <img
          src={imageSrc!}
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover/cover:scale-105"
        />
      ) : (
        <>
          <div aria-hidden className="clinic-cover__wash absolute inset-0" />
          <div aria-hidden className="clinic-cover__pattern absolute inset-0" />
          <div aria-hidden className="clinic-cover__glow absolute inset-0" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span
              className={cn(
                "clinic-cover__mark flex items-center justify-center rounded-full text-white/90",
                variant === "hero" && "size-16 sm:size-[4.5rem]",
                variant === "card" && "size-11 sm:size-12",
                variant === "compact" && "size-9",
              )}
            >
              <CoverMotifIcon
                motif={motif}
                className={cn(
                  variant === "hero" && "size-7 sm:size-8",
                  variant === "card" && "size-5",
                  variant === "compact" && "size-4",
                )}
              />
            </span>
          </div>
        </>
      )}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/20 via-transparent to-white/10"
      />

      {children ? (
        <div className="relative z-10 flex h-full flex-col justify-between p-3 sm:p-3.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
