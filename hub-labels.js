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
  botox: 'تزریق بوتاکس',
  fillers: 'تزریق فیلر',
  mesotherapy: 'مزوتراپی',
  'dental-implant': 'ایمپلنت دندان',
  orthodontics: 'ارتودنسی',
  'dental-veneer': 'ونیر دندان',
  'hair-transplant-installment': 'کاشت مو اقساطی',
  'micro-fit-hair-transplant': 'کاشت مو میکرو FIT',
  'laser-candela-2026': 'لیزر کاندلا',
  'mens-laser-shiraz': 'لیزر آقایان',
  'co2-fractional-laser': 'لیزر CO2 فراکشنال',
  'hifu-doublo-gold': 'هایفو دابلو گلد',
  'light-therapy': 'نور درمانی',
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
