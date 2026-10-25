import { CalendarCheck, ShieldCheck, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";
import { SITE } from "@/lib/constants";

const HIGHLIGHTS = [
  { icon: ShieldCheck, text: "مراکز دارای مجوز و تاییدشده" },
  { icon: CalendarCheck, text: "رزرو نوبت روی تقویم شمسی" },
  { icon: Sparkles, text: "مقایسه تعرفه و نظرات واقعی" },
];

/**
 * The decorative half of the split-screen auth pages. Pure SVG/CSS so there is
 * no image asset to ship or optimise.
 */
export function AuthArtwork() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-rose lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
        <svg className="size-full" viewBox="0 0 400 600" fill="none" preserveAspectRatio="xMidYMid slice">
          <circle cx="320" cy="90" r="150" stroke="white" strokeWidth="1" />
          <circle cx="320" cy="90" r="110" stroke="white" strokeWidth="1" />
          <circle cx="70" cy="470" r="180" stroke="white" strokeWidth="1" />
          <circle cx="70" cy="470" r="130" stroke="white" strokeWidth="1" />
          <path
            d="M200 210c22 43 47 68 90 90-43 22-68 47-90 90-22-43-47-68-90-90 43-22 68-47 90-90Z"
            stroke="white"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -start-24 size-80 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="bg-grain pointer-events-none absolute inset-0 opacity-10"
      />

      <div className="relative flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
          <BrandMark className="size-7 [&_stop]:[stop-color:#fff]" />
        </span>
        <span className="text-lg font-extrabold text-white">{SITE.name}</span>
      </div>

      <div className="relative">
        <h2 className="max-w-sm text-3xl font-extrabold leading-[1.7] text-white">
          زیبایی، با خیال راحت
        </h2>
        <p className="mt-5 max-w-sm text-sm leading-9 text-white/80">
          به بزرگ‌ترین شبکه کلینیک‌های زیبایی، پوست و مو در شیراز بپیوندید و نوبت خود را
          در چند ثانیه رزرو کنید.
        </p>

        <ul className="mt-10 space-y-4">
          {HIGHLIGHTS.map((item) => (
            <li key={item.text} className="flex items-center gap-3 text-sm text-white/90">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <item.icon className="size-4" />
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-white/60">
        © ۱۴۰۵ {SITE.name} — تمامی حقوق محفوظ است.
      </p>
    </div>
  );
}
