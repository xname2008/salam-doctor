import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Heart,
  Images,
  LayoutDashboard,
  MessageSquareQuote,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export interface DashboardNavItem {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export const CLIENT_NAV: DashboardNavItem[] = [
  {
    label: "پیش‌خوان",
    description: "نوبت‌های پیش‌رو",
    href: "/dashboard/client",
    icon: LayoutDashboard,
  },
  {
    label: "نوبت‌های من",
    description: "تاریخچه و رزروهای آینده",
    href: "/dashboard/client/appointments",
    icon: CalendarDays,
  },
  {
    label: "رزرو نوبت",
    description: "انتخاب مرکز، تاریخ و ساعت",
    href: "/dashboard/client/book",
    icon: CalendarPlus,
  },
  {
    label: "پروفایل من",
    description: "ویرایش اطلاعات شخصی",
    href: "/dashboard/client/profile",
    icon: UserRound,
  },
  {
    label: "مراکز علاقه‌مندی",
    description: "کلینیک‌های ذخیره‌شده",
    href: "/dashboard/client/favorites",
    icon: Heart,
  },
];

export const CLINIC_NAV: DashboardNavItem[] = [
  {
    label: "پیش‌خوان",
    description: "مراجعان امروز",
    href: "/dashboard/clinic",
    icon: LayoutDashboard,
  },
  {
    label: "مدیریت نوبت‌ها",
    description: "تایید، رد و جابه‌جایی",
    href: "/dashboard/clinic/appointments",
    icon: CalendarDays,
  },
  {
    label: "تقویم و زمان‌بندی",
    description: "ساعات کاری و تعطیلات",
    href: "/dashboard/clinic/calendar",
    icon: CalendarRange,
  },
  {
    label: "خدمات و تعرفه‌ها",
    description: "افزودن و ویرایش خدمات",
    href: "/dashboard/clinic/services",
    icon: Tags,
  },
  {
    label: "اطلاعات مرکز",
    description: "گالری، آدرس و تماس",
    href: "/dashboard/clinic/profile",
    icon: Images,
  },
  {
    label: "نظرات زیباجویان",
    description: "بازخورد مراجعان",
    href: "/dashboard/clinic/reviews",
    icon: MessageSquareQuote,
  },
];
