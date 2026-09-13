'use strict';

const { PARENT_SLUGS } = require('./hub-slugs');

/** Fallback Persian labels when Prisma Service rows are missing */
const HUB_LABELS_FA = Object.freeze({
  dermatology: 'پوست و مو',
  'laser-surgery': 'لیزر و جراحی',
  'body-contouring': 'پیکرتراشی',
  injectables: 'تزریقات زیبایی',
  dentistry: 'دندان‌پزشکی',
  'hair-transplant': 'کاشت مو',
  'eyebrow-transplant': 'کاشت ابرو',
  'skin-rejuvenation': 'جوانسازی پوست',
  'laser-hair-removal': 'لیزر موهای زائد',
  'cosmetic-surgery': 'جراحی زیبایی',
  slimming: 'لاغری و پیکرتراشی',
  rhinoplasty: 'جراحی بینی',
  lasik: 'لیزیک',
  'femto-lasik': 'فمتولیزیک',
  prk: 'پی‌آر‌کی',
  pharmacy: 'داروخانه',
  botox: 'تزریق بوتاکس',
  fillers: 'تزریق فیلر',
  mesotherapy: 'مزوتراپی',
  'dental-implant': 'ایمپلنت دندان',
  orthodontics: 'ارتودنسی',
  'dental-veneer': 'ونیر دندان',
  'hair-transplant-installment': 'کاشت مو اقساطی',
  'micro-fit-hair-transplant': 'کاشت مو میکرو FIT',
  'laser-candela-2026': 'لیزر کاندلا',
  'laser-titanium-2026': 'لیزر تیتانیوم',
  'mens-laser-shiraz': 'لیزر آقایان',
  'co2-fractional-laser': 'لیزر CO2 فراکشنال',
  'fotona-laser': 'لیزر فوتونا',
  'hifu-doublo-gold': 'هایفو دابلو گلد',
  'light-therapy': 'نور درمانی',
  'mole-removal': 'برداشتن خال',
  facial: 'فیشیال',
  'pore-treatment': 'درمان منافذ باز پوست',
  'buccal-fat': 'بوکال فت',
  'breast-surgery': 'جراحی سینه',
  'ear-piercing': 'پیرسینگ گوش',
  'wart-cryotherapy': 'درمان زگیل تناسلی',
  'skin-biopsy': 'نمونه‌برداری پوستی',
  'skin-diseases': 'بیماری‌های پوستی',
});

function hubLabelFa(slug, dbName) {
  if (dbName && String(dbName).trim()) return String(dbName).trim();
  const key = String(slug || '').trim().toLowerCase();
  return HUB_LABELS_FA[key] || key;
}

function isParentHubSlug(slug) {
  return PARENT_SLUGS.has(String(slug || '').trim().toLowerCase());
}

module.exports = { HUB_LABELS_FA, hubLabelFa, isParentHubSlug };
