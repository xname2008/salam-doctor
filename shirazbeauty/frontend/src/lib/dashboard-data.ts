import type { AppointmentStatus } from "@/types";

/**
 * Placeholder data for the Phase 2 dashboard skeletons. Every export here is
 * replaced by an API call in Phases 4-6.
 */

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PENDING: "در انتظار تایید",
  CONFIRMED: "تاییدشده",
  COMPLETED: "انجام شده",
  CANCELLED: "لغوشده",
  CANCELLED_BY_CLIENT: "لغو توسط زیباجو",
  CANCELLED_BY_CLINIC: "لغو توسط مرکز",
  NO_SHOW: "عدم مراجعه",
};

export const STATUS_VARIANTS: Record<
  AppointmentStatus,
  "default" | "azure" | "verified" | "warning" | "danger"
> = {
  PENDING: "warning",
  CONFIRMED: "azure",
  COMPLETED: "verified",
  CANCELLED: "danger",
  CANCELLED_BY_CLIENT: "danger",
  CANCELLED_BY_CLINIC: "danger",
  NO_SHOW: "default",
};

export interface ClientAppointment {
  id: number;
  reference: string;
  clinic: string;
  service: string;
  specialist: string;
  jalaliDate: string;
  time: string;
  district: string;
  price: number;
  status: AppointmentStatus;
}

export const CLIENT_APPOINTMENTS: ClientAppointment[] = [
  {
    id: 1,
    reference: "SB-۸۴۲۱۹",
    clinic: "کلینیک زیبایی نهال",
    service: "لیزر موهای زائد — فول بادی",
    specialist: "دکتر سارا رضایی",
    jalaliDate: "۱۲ شهریور ۱۴۰۵",
    time: "۱۶:۳۰",
    district: "معالی‌آباد",
    price: 4500000,
    status: "CONFIRMED",
  },
  {
    id: 2,
    reference: "SB-۸۴۳۰۷",
    clinic: "کلینیک تخصصی پوست مهسا",
    service: "تزریق بوتاکس پیشانی",
    specialist: "دکتر مهسا کریمی",
    jalaliDate: "۱۹ شهریور ۱۴۰۵",
    time: "۱۱:۰۰",
    district: "عفیف‌آباد",
    price: 6200000,
    status: "PENDING",
  },
  {
    id: 3,
    reference: "SB-۸۳۸۸۱",
    clinic: "سالن زیبایی سمر",
    service: "میکروبلیدینگ ابرو",
    specialist: "سمیرا احمدی",
    jalaliDate: "۲۸ مرداد ۱۴۰۵",
    time: "۱۴:۰۰",
    district: "چمران",
    price: 3800000,
    status: "COMPLETED",
  },
  {
    id: 4,
    reference: "SB-۸۳۵۲۰",
    clinic: "کلینیک لیزر هیرا",
    service: "هیدرافیشیال صورت",
    specialist: "دکتر نگار موسوی",
    jalaliDate: "۱۴ مرداد ۱۴۰۵",
    time: "۰۹:۳۰",
    district: "زند",
    price: 2900000,
    status: "COMPLETED",
  },
  {
    id: 5,
    reference: "SB-۸۳۲۰۴",
    clinic: "کلینیک زیبایی صالح",
    service: "مزوتراپی مو",
    specialist: "دکتر امیر صالحی",
    jalaliDate: "۰۲ مرداد ۱۴۰۵",
    time: "۱۷:۰۰",
    district: "فرهنگ‌شهر",
    price: 5200000,
    status: "CANCELLED_BY_CLIENT",
  },
];

export interface ClinicAppointment {
  id: number;
  reference: string;
  client: string;
  mobile: string;
  service: string;
  jalaliDate: string;
  time: string;
  durationMinutes: number;
  price: number;
  status: AppointmentStatus;
  isNewClient: boolean;
}

export const CLINIC_APPOINTMENTS: ClinicAppointment[] = [
  {
    id: 1,
    reference: "SB-۹۱۰۲۴",
    client: "نازنین حسینی",
    mobile: "۰۹۱۲***۴۵۶۷",
    service: "لیزر موهای زائد — زیربغل",
    jalaliDate: "۰۹ شهریور ۱۴۰۵",
    time: "۰۹:۰۰",
    durationMinutes: 30,
    price: 850000,
    status: "CONFIRMED",
    isNewClient: false,
  },
  {
    id: 2,
    reference: "SB-۹۱۰۲۹",
    client: "مریم پورکاظم",
    mobile: "۰۹۱۷***۲۲۸۱",
    service: "هیدرافیشیال صورت",
    jalaliDate: "۰۹ شهریور ۱۴۰۵",
    time: "۱۰:۰۰",
    durationMinutes: 45,
    price: 2900000,
    status: "CONFIRMED",
    isNewClient: true,
  },
  {
    id: 3,
    reference: "SB-۹۱۰۳۵",
    client: "الهام صادقی",
    mobile: "۰۹۳۰***۷۷۴۰",
    service: "تزریق ژل لب",
    jalaliDate: "۰۹ شهریور ۱۴۰۵",
    time: "۱۲:۳۰",
    durationMinutes: 60,
    price: 7800000,
    status: "PENDING",
    isNewClient: true,
  },
  {
    id: 4,
    reference: "SB-۹۱۰۴۱",
    client: "زهرا کشاورز",
    mobile: "۰۹۱۳***۰۹۱۲",
    service: "هایفو صورت",
    jalaliDate: "۰۹ شهریور ۱۴۰۵",
    time: "۱۵:۰۰",
    durationMinutes: 90,
    price: 12500000,
    status: "PENDING",
    isNewClient: false,
  },
  {
    id: 5,
    reference: "SB-۹۱۰۵۰",
    client: "سمانه رحیمی",
    mobile: "۰۹۰۲***۳۳۱۹",
    service: "لیزر موهای زائد — فول بادی",
    jalaliDate: "۰۹ شهریور ۱۴۰۵",
    time: "۱۷:۰۰",
    durationMinutes: 75,
    price: 4500000,
    status: "CONFIRMED",
    isNewClient: false,
  },
];

export interface ClinicServiceRow {
  id: number;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export const CLINIC_SERVICES: ClinicServiceRow[] = [
  {
    id: 1,
    name: "لیزر موهای زائد — فول بادی",
    category: "لیزر موهای زائد",
    durationMinutes: 75,
    price: 4500000,
    isActive: true,
  },
  {
    id: 2,
    name: "لیزر موهای زائد — زیربغل",
    category: "لیزر موهای زائد",
    durationMinutes: 30,
    price: 850000,
    isActive: true,
  },
  {
    id: 3,
    name: "تزریق بوتاکس پیشانی",
    category: "تزریق بوتاکس و ژل",
    durationMinutes: 45,
    price: 6200000,
    isActive: true,
  },
  {
    id: 4,
    name: "تزریق ژل لب",
    category: "تزریق بوتاکس و ژل",
    durationMinutes: 60,
    price: 7800000,
    isActive: true,
  },
  {
    id: 5,
    name: "هایفو صورت",
    category: "هایفو و لیفت",
    durationMinutes: 90,
    price: 12500000,
    isActive: true,
  },
  {
    id: 6,
    name: "هیدرافیشیال صورت",
    category: "پاکسازی و جوانسازی پوست",
    durationMinutes: 45,
    price: 2900000,
    isActive: false,
  },
];

export interface ClinicReview {
  id: number;
  client: string;
  service: string;
  rating: number;
  jalaliDate: string;
  comment: string;
  isPublished: boolean;
  reply?: string;
}

export const CLINIC_REVIEWS: ClinicReview[] = [
  {
    id: 1,
    client: "نازنین ح.",
    service: "لیزر موهای زائد — فول بادی",
    rating: 5,
    jalaliDate: "۰۵ شهریور ۱۴۰۵",
    comment:
      "برخورد پرسنل عالی بود و دستگاه کندلا واقعا تفاوت رو نشون داد. بعد از سه جلسه نتیجه کاملا مشخصه.",
    isPublished: true,
    reply: "سپاس از اعتماد شما. مشتاق دیدار مجدد هستیم.",
  },
  {
    id: 2,
    client: "مریم پ.",
    service: "هیدرافیشیال صورت",
    rating: 4,
    jalaliDate: "۰۳ شهریور ۱۴۰۵",
    comment: "نتیجه خوب بود ولی کمی منتظر ماندم. محیط کلینیک تمیز و آرام است.",
    isPublished: true,
  },
  {
    id: 3,
    client: "الهام ص.",
    service: "تزریق ژل لب",
    rating: 5,
    jalaliDate: "۳۱ مرداد ۱۴۰۵",
    comment: "دقت دکتر در فرم‌دهی عالی بود، دقیقا همون چیزی که می‌خواستم.",
    isPublished: false,
  },
];

export interface SavedClinic {
  id: number;
  name: string;
  slug: string;
  district: string;
  rating: number;
  reviewCount: number;
  topService: string;
  startingPrice: number;
}

export const SAVED_CLINICS: SavedClinic[] = [
  {
    id: 1,
    name: "کلینیک زیبایی نهال",
    slug: "nahal-beauty",
    district: "معالی‌آباد",
    rating: 4.9,
    reviewCount: 312,
    topService: "لیزر موهای زائد",
    startingPrice: 450000,
  },
  {
    id: 2,
    name: "کلینیک تخصصی پوست مهسا",
    slug: "mahsa-derma",
    district: "عفیف‌آباد",
    rating: 4.8,
    reviewCount: 198,
    topService: "تزریق بوتاکس و ژل",
    startingPrice: 620000,
  },
  {
    id: 3,
    name: "سالن زیبایی سمر",
    slug: "samar-salon",
    district: "چمران",
    rating: 4.9,
    reviewCount: 264,
    topService: "میکروپیگمنتیشن",
    startingPrice: 380000,
  },
];

export interface WorkingHourRow {
  weekday: number;
  label: string;
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
  slotMinutes: number;
}

export const WORKING_HOURS: WorkingHourRow[] = [
  { weekday: 0, label: "شنبه", isOpen: true, opensAt: "09:00", closesAt: "19:00", slotMinutes: 30 },
  { weekday: 1, label: "یکشنبه", isOpen: true, opensAt: "09:00", closesAt: "19:00", slotMinutes: 30 },
  { weekday: 2, label: "دوشنبه", isOpen: true, opensAt: "09:00", closesAt: "19:00", slotMinutes: 30 },
  { weekday: 3, label: "سه‌شنبه", isOpen: true, opensAt: "09:00", closesAt: "19:00", slotMinutes: 30 },
  { weekday: 4, label: "چهارشنبه", isOpen: true, opensAt: "09:00", closesAt: "17:00", slotMinutes: 30 },
  { weekday: 5, label: "پنجشنبه", isOpen: true, opensAt: "10:00", closesAt: "14:00", slotMinutes: 45 },
  { weekday: 6, label: "جمعه", isOpen: false, opensAt: "00:00", closesAt: "00:00", slotMinutes: 30 },
];

/**
 * Cached national holidays. Phase 5 syncs these nightly from holidayapi.ir into
 * the `holidays` table; the shape here matches what that endpoint will return.
 */
export const OFFICIAL_HOLIDAYS: Record<string, string> = {
  "2026-09-05": "شهادت امام محمد باقر (ع)",
  "2026-09-15": "تعطیل رسمی",
  "2026-09-26": "رحلت امام جعفر صادق (ع)",
  "2026-10-05": "تعطیل رسمی",
};

export interface SlotTemplate {
  time: string;
  service: string;
  capacity: number;
  booked: number;
}

export const DAY_SLOTS: SlotTemplate[] = [
  { time: "۰۹:۰۰", service: "لیزر موهای زائد", capacity: 1, booked: 1 },
  { time: "۰۹:۳۰", service: "لیزر موهای زائد", capacity: 1, booked: 0 },
  { time: "۱۰:۰۰", service: "هیدرافیشیال صورت", capacity: 1, booked: 1 },
  { time: "۱۰:۴۵", service: "هیدرافیشیال صورت", capacity: 1, booked: 0 },
  { time: "۱۱:۳۰", service: "تزریق بوتاکس", capacity: 1, booked: 0 },
  { time: "۱۲:۳۰", service: "تزریق ژل", capacity: 1, booked: 1 },
  { time: "۱۵:۰۰", service: "هایفو صورت", capacity: 1, booked: 1 },
  { time: "۱۶:۳۰", service: "لیزر موهای زائد", capacity: 1, booked: 0 },
  { time: "۱۷:۰۰", service: "لیزر موهای زائد", capacity: 1, booked: 1 },
  { time: "۱۸:۰۰", service: "مشاوره رایگان", capacity: 2, booked: 0 },
];
