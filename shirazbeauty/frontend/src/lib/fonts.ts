import localFont from "next/font/local";

/**
 * Vazirmatn RD (rounded digits) variable font, self-hosted so the site never
 * depends on a font CDN that is unreliable from inside Iran.
 */
export const vazirmatn = localFont({
  src: [
    {
      path: "../../public/fonts/vazirmatn-variable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
  fallback: ["Tahoma", "Arial", "sans-serif"],
  adjustFontFallback: false,
});
