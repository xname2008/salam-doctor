import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";
import { SITE } from "@/lib/constants";
import { vazirmatn } from "@/lib/fonts";
import { cn } from "@/lib/utils";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} | ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "کلینیک زیبایی شیراز",
    "لیزر موهای زائد شیراز",
    "تزریق بوتاکس شیراز",
    "کاشت مو شیراز",
    "سالن زیبایی شیراز",
    "رزرو نوبت زیبایی",
  ],
  applicationName: SITE.name,
  authors: [{ name: SITE.nameEn, url: SITE.url }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: SITE.name,
    title: `${SITE.name} | ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} | ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <body className={cn("min-h-dvh bg-background text-foreground")}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
