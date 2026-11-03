import type { ReactNode } from "react";

import { AuthArtwork } from "@/components/auth/auth-artwork";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <main className="flex items-center justify-center bg-gradient-hero px-6 py-12 sm:px-10">
        <div className="w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-6 shadow-soft backdrop-blur-sm sm:p-8">
          {children}
        </div>
      </main>
      <AuthArtwork />
    </div>
  );
}
