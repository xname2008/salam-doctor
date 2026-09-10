'use strict';

// ==========================================================================
// search-index.js — keyword index for GET /search?q=
// Maps user queries to /shiraz/:slug hub pages (primary SEO funnel).
// Keep in sync with hub-slugs.js + seo-config long-tail slugs.
// ==========================================================================

const { HUB_SLUGS } = require('./hub-slugs');
const { clinicProfilePath } = require('./clinicSlug');

/** @type {{ slug: string, name: string, keywords: string[] }[]} */
const HUB_ENTRIES = [
  { slug: 'hair-transplant', name: 'کاشت مو', keywords: ['کاشت مو', 'پیوند مو', 'hair transplant', 'graft'] },
  { slug: 'hair-transplant-installment', name: 'کاشت مو اقساطی', keywords: ['اقساط', 'اقساطی', 'چک', 'ضامن', 'installment'] },
  { slug: 'micro-fit-hair-transplant', name: 'کاشت مو Micro FIT', keywords: ['micro fit', 'microfit', 'میکرو فیت', 'میکروگرافت'] },
  { slug: 'eyebrow-transplant', name: 'کاشت ابرو', keywords: ['کاشت ابرو', 'ابرو', 'eyebrow'] },
  { slug: 'skin-rejuvenation', name: 'جوانسازی پوست', keywords: ['جوانسازی', 'rejuvenation', 'پوست'] },
  { slug: 'co2-fractional-laser', name: 'لیزر CO2 فرکشنال', keywords: ['co2', 'فرکشنال', 'جای جوش', 'اسکار', 'منافذ'] },
  { slug: 'fotona-laser', name: 'لیزر فوتونا', keywords: ['فوتونا', 'fotona', 'جوانسازی'] },
  { slug: 'laser-hair-removal', name: 'لیزر موهای زائد', keywords: ['لیزر مو', 'موهای زائد', 'laser hair'] },
  { slug: 'laser-candela-2026', name: 'لیزر کندلا', keywords: ['کندلا', 'candela', 'الکساندرایت', 'alexandrite', 'فول بادی'] },
  { slug: 'laser-titanium-2026', name: 'لیزر تیتانیوم', keywords: ['تیتانیوم', 'titanium', 'پلاتینیوم', 'platinum', 'لیزر تیتانیوم'] },
  { slug: 'mole-removal', name: 'برداشتن خال', keywords: ['خال', 'برداشتن خال', 'برداشت خال', 'mole'] },
  { slug: 'facial', name: 'فیشیال', keywords: ['فیشیال', 'پاکسازی پوست', 'facial'] },
  { slug: 'pore-treatment', name: 'درمان منافذ باز پوست', keywords: ['منافذ', 'منافذ باز', 'pore'] },
  { slug: 'buccal-fat', name: 'بوکال فت', keywords: ['بوکال', 'بوکال فت', 'buccal'] },
  { slug: 'breast-surgery', name: 'جراحی سینه', keywords: ['جراحی سینه', 'سینه', 'ماموپلاستی', 'breast'] },
  { slug: 'ear-piercing', name: 'پیرسینگ گوش', keywords: ['پیرسینگ', 'پیرسینگ گوش', 'piercing'] },
  {
    slug: 'wart-cryotherapy',
    name: 'درمان زگیل تناسلی',
    keywords: ['زگیل', 'زگیل تناسلی', 'کرایو', 'کرایوتراپی', 'wart', 'cryo'],
  },
  {
    slug: 'skin-biopsy',
    name: 'نمونه‌برداری پوستی',
    keywords: ['نمونه برداری', 'نمونه‌برداری', 'بیوپسی', 'biopsy'],
  },
  { slug: 'mens-laser-shiraz', name: 'لیزر موهای زائد آقایان', keywords: ['لیزر آقایان', 'مرد', 'آقا', 'men laser'] },
  { slug: 'cosmetic-surgery', name: 'جراحی زیبایی', keywords: ['جراحی', 'بلفاروپلاستی', 'blepharoplasty', 'بخیه', 'پلک'] },
  { slug: 'hifu-doublo-gold', name: 'هایفو دابلو گلد', keywords: ['هایفو', 'hifu', 'دابلو', 'doublo', 'غبغب', 'لیفت'] },
  { slug: 'botox', name: 'بوتاکس', keywords: ['بوتاکس', 'botox'] },
  { slug: 'fillers', name: 'فیلر و ژل', keywords: ['فیلر', 'ژل', 'filler'] },
  { slug: 'mesotherapy', name: 'مزوتراپی', keywords: ['مزو', 'mesotherapy'] },
  { slug: 'slimming', name: 'لاغری و پیکرتراشی', keywords: ['لاغری', 'پیکرتراشی', 'slimming'] },
  { slug: 'dentistry', name: 'دندانپزشکی', keywords: ['دندان', 'دندانپزشک', 'dental'] },
  { slug: 'dental-implant', name: 'ایمپلنت دندان', keywords: ['ایمپلنت', 'implant'] },
  { slug: 'orthodontics', name: 'ارتودنسی', keywords: ['ارتودنسی', 'بریس'] },
  { slug: 'dental-veneer', name: 'لمینت و کامپوزیت', keywords: ['لمینت', 'کامپوزیت', 'veneer'] },
  { slug: 'dermatology', name: 'پوست و مو', keywords: ['پوست و مو', 'dermatology'] },
  { slug: 'laser-surgery', name: 'لیزر و جراحی', keywords: ['لیزر و جراحی'] },
  { slug: 'body-contouring', name: 'تناسب اندام', keywords: ['تناسب', 'body'] },
  { slug: 'injectables', name: 'تزریقات زیبایی', keywords: ['تزریق', 'injectable'] },
];

// Ensure every hub-slugs entry has at least a name stub (future slugs).
for (const slug of HUB_SLUGS) {
  if (!HUB_ENTRIES.some((e) => e.slug === slug)) {
    HUB_ENTRIES.push({ slug, name: slug.replace(/-/g, ' '), keywords: [slug.replace(/-/g, ' ')] });
  }
}

function normalizeQuery(raw) {
  return String(raw || '')
    .trim()
    .replace(/[\u200c\u200f\u200e]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * @param {string} query
 * @param {number} [limit]
 * @returns {{ slug: string, name: string, score: number, url: string }[]}
 */
function searchHubs(query, limit = 10) {
  const q = normalizeQuery(query);
  if (!q) return [];

  const terms = q.split(' ').filter((t) => t.length > 1);

  return HUB_ENTRIES.map((entry) => {
    const haystack = [entry.name, entry.slug.replace(/-/g, ' '), ...(entry.keywords || [])]
      .join(' ')
      .toLowerCase();
    let score = 0;
    if (haystack.includes(q)) score += 12;
    if (entry.slug.includes(q.replace(/\s+/g, '-'))) score += 15;
    for (const t of terms) {
      if (haystack.includes(t)) score += 3;
      if (entry.slug.includes(t)) score += 4;
    }
    return { slug: entry.slug, name: entry.name, score, url: `/shiraz/${entry.slug}` };
  })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * @param {string} query
 * @param {object[]} clinics from data.min.js
 * @param {number} [limit]
 */
function searchClinics(query, clinics, limit = 6) {
  const q = normalizeQuery(query);
  if (!q || !Array.isArray(clinics)) return [];
  const terms = q.split(' ').filter((t) => t.length > 1);

  return clinics
    .map((c) => {
      if (!c) return null;
      const hay = [c.name, c.sliderTitle, c.sliderTagline, c.address, c.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      let score = 0;
      if (hay.includes(q)) score += 8;
      for (const t of terms) if (hay.includes(t)) score += 2;
      if (!score) return null;
      return {
        id: c.id,
        name: c.name || c.sliderTitle || 'مرکز درمانی',
        tagline: c.sliderTagline || c.address || '',
        url: clinicProfilePath(c),
        score,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { searchHubs, searchClinics, normalizeQuery, HUB_ENTRIES };
