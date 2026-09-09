"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * App-wide toast host. `dir="rtl"` keeps the close button and icon on the
 * correct side for Persian.
 */
export function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="top-center"
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border !border-border !bg-white !text-ink !shadow-soft !font-vazirmatn",
          title: "!text-sm !font-bold",
          description: "!text-xs !text-ink-muted !leading-6",
          actionButton: "!bg-azure !text-white !rounded-full",
          cancelButton: "!bg-surface !text-ink-muted !rounded-full",
          error: "!border-destructive/30",
          success: "!border-mint/40",
        },
      }}
    />
  );
}
