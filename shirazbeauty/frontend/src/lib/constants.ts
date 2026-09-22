import type { Category, ClinicSummary, District } from "@/types";

export const SITE = {
  name: "شیراز بیوتی",
  nameEn: "Shiraz Beauty",
  tagline: "مرجع تخصصی زیبایی، پوست و مو در شیراز",
  description:
    "رزرو آنلاین نوبت در بهترین کلینیک‌های زیبایی، پوست، مو و سالن‌های تخصصی شیراز؛ با مقایسه خدمات، قیمت و نظرات مراجعان.",
  url: "https://shirazbeauty.ir",
  phone: "۰۷۱ - ۳۲۰۰ ۰۰۰۰",
  phoneHref: "+987132000000",
  email: "info@shirazbeauty.ir",
  address: "شیراز، بلوار معالی‌آباد، مرکز تجاری آفتاب، طبقه سوم",
} as const;

export const MAIN_NAV = [
  { label: "خانه", href: "/" },
  { label: "کلینیک‌ها", href: "/clinics" },
  { label: "خدمات", href: "/services" },
  { label: "مناطق شیراز", href: "/districts" },
  { label: "مجله زیبایی", href: "/magazine" },
] as const;

export const FOOTER_NAV = [
  {
    title: "دسترسی سریع",
    links: [
      { label: "جستجوی کلینیک", href: "/clinics" },
      { label: "رزرو نوبت", href: "/booking" },
      { label: "مجله زیبایی", href: "/magazine" },
      { label: "سوالات متداول", href: "/faq" },
    ],
  },
  {
    title: "برای متخصصان",
    links: [
      { label: "ثبت کلینیک", href: "/partner" },
      { label: "پنل مدیریت کلینیک", href: "/dashboard/clinic" },
      { label: "تعرفه همکاری", href: "/partner/pricing" },
      { label: "راهنمای متخصصان", href: "/partner/guide" },
    ],
  },
  {
    title: "شیراز بیوتی",
    links: [
      { label: "درباره ما", href: "/about" },
      { label: "تماس با ما", href: "/contact" },
      { label: "قوانین و مقررات", href: "/terms" },
      { label: "حریم خصوصی", href: "/privacy" },
    ],
  },
] as const;

/** Placeholder data for the Phase 1 design preview — replaced by the API in Phase 4. */
export const CATEGORIES: Category[] = [
  {
    id: 1,
    name: "لیزر موهای زائد",
    slug: "laser-hair-removal",
    description: "دستگاه‌های نسل جدید کندلا و کاندلا الکس",
    icon: "Sparkles",
    clinicCount: 48,
  },
  {
    id: 2,
    name: "تزریق بوتاکس و ژل",
    slug: "botox-filler",
    description: "جوانسازی و فرم‌دهی توسط پزشک متخصص",
    icon: "Syringe",
    clinicCount: 36,
  },
  {
    id: 3,
    name: "کاشت مو",
    slug: "hair-transplant",
    description: "روش‌های FUT و FIT با تضمین تراکم",
    icon: "Scissors",
    clinicCount: 21,
  },
  {
    id: 4,
    name: "پاکسازی و جوانسازی پوست",
    slug: "skin-rejuvenation",
    description: "هیدرافیشیال، مزوتراپی و میکرونیدلینگ",
    icon: "Droplets",
    clinicCount: 42,
  },
  {
    id: 5,
    name: "هایفو و لیفت",
    slug: "hifu-lift",
    description: "لیفت غیرجراحی صورت و بدن",
    icon: "Waves",
    clinicCount: 19,
  },
  {
    id: 6,
    name: "میکروپیگمنتیشن",
    slug: "micropigmentation",
    description: "میکروبلیدینگ ابرو، خط چشم و لب",
    icon: "Brush",
    clinicCount: 27,
  },
  {
    id: 7,
    name: "سالن تخصصی مو",
    slug: "hair-salon",
    description: "رنگ، کراتین و پروتئین تراپی",
    icon: "Wind",
    clinicCount: 55,
  },
  {
    id: 8,
    name: "درمان ریزش و پوست",
    slug: "dermatology",
    description: "ویزیت تخصصی پوست، مو و ناخن",
    icon: "Stethoscope",
    clinicCount: 33,
  },
];

export const DISTRICTS: District[] = [
  { id: 1, name: "معالی‌آباد", slug: "maaliabad", clinicCount: 64 },
  { id: 2, name: "عفیف‌آباد", slug: "afifabad", clinicCount: 38 },
  { id: 3, name: "قصرالدشت", slug: "ghasrodasht", clinicCount: 29 },
  { id: 4, name: "چمران", slug: "chamran", clinicCount: 24 },
  { id: 5, name: "زند", slug: "zand", clinicCount: 31 },
  { id: 6, name: "ستارخان", slug: "sattarkhan", clinicCount: 18 },
  { id: 7, name: "فرهنگ‌شهر", slug: "farhangshahr", clinicCount: 22 },
  { id: 8, name: "قدوسی غربی", slug: "ghodousi-gharbi", clinicCount: 15 },
];

export const FEATURED_CLINICS: ClinicSummary[] = [
  {
    id: 3,
    name: "کلینیک زیبایی نهال",
    slug: "nahal-beauty",
    district: "معالی‌آباد",
    coverImage: "",
    categories: ["لیزر موهای زائد", "هایفو و لیفت"],
    rating: 4.9,
    reviewCount: 312,
    startingPrice: 450000,
    isVerified: true,
    hasInstantBooking: true,
  },
  {
    id: 4,
    name: "کلینیک تخصصی پوست مهسا",
    slug: "mahsa-derma",
    district: "عفیف‌آباد",
    coverImage: "",
    categories: ["تزریق بوتاکس و ژل", "جوانسازی پوست"],
    rating: 4.8,
    reviewCount: 198,
    startingPrice: 620000,
    isVerified: true,
    hasInstantBooking: true,
  },
  {
    id: 101,
    name: "مرکز کاشت مو پارسه",
    slug: "parseh-hair",
    district: "قصرالدشت",
    coverImage: "",
    categories: ["کاشت مو", "درمان ریزش"],
    rating: 4.7,
    reviewCount: 145,
    startingPrice: 1850000,
    isVerified: true,
    hasInstantBooking: false,
  },
  {
    id: 102,
    name: "سالن زیبایی سمر",
    slug: "samar-salon",
    district: "چمران",
    coverImage: "",
    categories: ["سالن تخصصی مو", "میکروپیگمنتیشن"],
    rating: 4.9,
    reviewCount: 264,
    startingPrice: 380000,
    isVerified: true,
    hasInstantBooking: true,
  },
  {
    id: 103,
    name: "کلینیک لیزر هیرا",
    slug: "hira-laser",
    district: "زند",
    coverImage: "",
    categories: ["لیزر موهای زائد", "پاکسازی پوست"],
    rating: 4.6,
    reviewCount: 121,
    startingPrice: 390000,
    isVerified: false,
    hasInstantBooking: true,
  },
  {
    id: 104,
    name: "کلینیک زیبایی صالح",
    slug: "saleh-beauty",
    district: "فرهنگ‌شهر",
    coverImage: "",
    categories: ["تزریق ژل", "مزوتراپی"],
    rating: 4.8,
    reviewCount: 176,
    startingPrice: 520000,
    isVerified: true,
    hasInstantBooking: false,
  },
];

export const TRUST_STATS = [
  { value: "۳۲۰+", label: "کلینیک و سالن تاییدشده" },
  { value: "۱۸۰۰+", label: "خدمت تخصصی زیبایی" },
  { value: "۴۵٬۰۰۰+", label: "نوبت رزرو شده" },
  { value: "۹۸٪", label: "رضایت مراجعان" },
];

export const HOW_IT_WORKS = [
  {
    step: "۰۱",
    title: "جستجو کنید",
    description:
      "کلینیک‌های زیبایی شیراز را بر اساس خدمت، منطقه، محدوده قیمت و امتیاز مراجعان فیلتر کنید.",
  },
  {
    step: "۰۲",
    title: "مقایسه و انتخاب",
    description:
      "تعرفه خدمات، تجهیزات، نمونه‌کارها و نظرات تاییدشده را کنار هم ببینید و متخصص خود را انتخاب کنید.",
  },
  {
    step: "۰۳",
    title: "رزرو نوبت",
    description:
      "روی تقویم شمسی، ساعت آزاد را انتخاب و نوبت خود را در کمتر از یک دقیقه قطعی کنید.",
  },
];
