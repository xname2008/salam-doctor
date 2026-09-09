'use strict';

/**
 * Commercial package landing definitions for Google Ads / SKAG campaigns.
 * Each package maps to a service label, default clinic, and pricing copy.
 */

const PACKAGES = Object.freeze({
  'candela-laser': {
    slug: 'candela-laser',
    label: 'لیزر کندلا',
    service: 'لیزر کندلا تیتانیوم',
    skagPreset: 'candela',
    defaultClinicId: 114,
    city: 'شیراز',
    subheadline:
      'مشاوره تخصصی لیزر کندلا، تجهیزات اصل و شفافیت کامل در هزینه — قبل از تصمیم‌گیری، دقیق بدانید چه می‌پردازید.',
    trustBadges: ['مجوز وزارت بهداشت', 'دستگاه Candela اصل', 'گزارش شفاف هزینه'],
    pricingPackages: [
      {
        name: 'مشاوره + طرح درمان',
        total: 'رایگان',
        highlight: false,
        items: [
          { label: 'ویزیت پزشک متخصص', amount: '۰ تومان' },
          { label: 'طرح درمان شخصی‌سازی‌شده', amount: '۰ تومان' },
        ],
      },
      {
        name: 'پکیج لیزر کندلا (نمونه)',
        total: 'از ۸٬۵۰۰٬۰۰۰ تومان',
        perSession: 'هر ناحیه',
        highlight: true,
        items: [
          { label: 'جلسه لیزر کندلا', amount: 'شفاف در قرارداد' },
          { label: 'بی‌حسی موضعی', amount: 'شامل پکیج' },
          { label: 'پیگیری ۲ هفته‌ای', amount: 'رایگان' },
        ],
      },
    ],
  },
  'hair-transplant': {
    slug: 'hair-transplant',
    label: 'کاشت مو',
    service: 'کاشت مو',
    skagPreset: 'hair-transplant',
    defaultClinicId: 114,
    city: 'شیراز',
    subheadline:
      'مشاوره تخصصی کاشت مو، تکنیک FIT/SUT و برآورد شفاف هزینه — با تیم پزشکی مجرب.',
    trustBadges: ['مجوز وزارت بهداشت', 'نمونه‌کار واقعی', 'قرارداد شفاف'],
    pricingPackages: [
      {
        name: 'مشاوره کاشت مو',
        total: 'رایگان',
        highlight: false,
        items: [
          { label: 'معاینه و آنالیز ریزش', amount: '۰ تومان' },
          { label: 'طرح درمان', amount: '۰ تومان' },
        ],
      },
      {
        name: 'پکیج کاشت مو FIT',
        total: 'از ۳۵٬۰۰۰٬۰۰۰ تومان',
        perSession: 'بسته به تعداد گرافت',
        highlight: true,
        items: [
          { label: 'عمل کاشت مو', amount: 'شفاف در قرارداد' },
          { label: 'دارو و کیت مراقبت', amount: 'شامل پکیج پایه' },
          { label: 'ویزیت‌های پیگیری', amount: '۳ جلسه' },
        ],
      },
    ],
  },
  botox: {
    slug: 'botox',
    label: 'بوتاکس',
    service: 'تزریق بوتاکس',
    skagPreset: 'botox',
    defaultClinicId: 114,
    city: 'شیراز',
    subheadline: 'تزریق بوتاکس توسط پزشک متخصص با برند معتبر و تعرفه شفاف.',
    trustBadges: ['پزشک متخصص', 'برند اصل', 'قیمت شفاف'],
    pricingPackages: [
      {
        name: 'مشاوره بوتاکس',
        total: 'رایگان',
        highlight: false,
        items: [{ label: 'ویزیت و برنامه‌ریزی', amount: '۰ تومان' }],
      },
      {
        name: 'پکیج بوتاکس پیشانی',
        total: 'از ۴٬۵۰۰٬۰۰۰ تومان',
        highlight: true,
        items: [
          { label: 'تزریق بوتاکس', amount: 'بر اساس واحد' },
          { label: 'پیگیری ۲ هفته', amount: 'رایگان' },
        ],
      },
    ],
  },
});

const PACKAGE_ALIASES = Object.freeze({
  candela: 'candela-laser',
  'candela-laser': 'candela-laser',
  fit: 'hair-transplant',
  'hair-transplant-fit': 'hair-transplant',
  'botox-filler': 'botox',
});

function normalizePackageSlug(raw) {
  const slug = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '');
  if (!slug) return null;
  return PACKAGE_ALIASES[slug] || (PACKAGES[slug] ? slug : null);
}

function getPackage(slug) {
  const key = normalizePackageSlug(slug);
  return key ? PACKAGES[key] : null;
}

function listPackages() {
  return Object.values(PACKAGES);
}

module.exports = {
  PACKAGES,
  PACKAGE_ALIASES,
  normalizePackageSlug,
  getPackage,
  listPackages,
};
