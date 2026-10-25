import { cn } from "@/lib/utils";

/**
 * Shiraz Beauty monogram. Drawn as SVG so it stays crisp at any size and
 * inherits the rose gradient without shipping a raster asset.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("size-10", className)}
    >
      <defs>
        <linearGradient id="sb-rose" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6F1F36" />
          <stop offset="52%" stopColor="#932A48" />
          <stop offset="100%" stopColor="#D4899C" />
        </linearGradient>
      </defs>
      <rect
        x="1"
        y="1"
        width="46"
        height="46"
        rx="15"
        stroke="url(#sb-rose)"
        strokeWidth="1.4"
      />
      <path
        d="M24 11c2.6 5.1 5.6 8.1 10.7 10.7C29.6 24.3 26.6 27.3 24 32.4c-2.6-5.1-5.6-8.1-10.7-10.7C18.4 19.1 21.4 16.1 24 11Z"
        fill="url(#sb-rose)"
      />
      <path
        d="M17 34.8c2.4 1.6 4.7 2.4 7 2.4s4.6-.8 7-2.4"
        stroke="url(#sb-rose)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
