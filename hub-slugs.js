'use strict';

// ==========================================================================
// hub-slugs.js — canonical list of every /shiraz/:slug hub page.
//
// Single source for sitemap.xml generation. Keep in sync with:
//   prisma/seed-mock-clinics.js  (SERVICE_CATALOG + LONGTAIL_SERVICES)
//   seo-config.js                (long-tail SEO overrides)
// ==========================================================================

/** Parent category hubs (lower sitemap priority than leaf/service pages). */
const PARENT_SLUGS = new Set([
  'dermatology',
  'laser-surgery',
  'body-contouring',
  'injectables',
  'dentistry',
]);

/**
 * Every hub slug that must appear in sitemap.xml for Google indexing.
 * Order: parents → catalog leaves → long-tail keyword pages.
 */
const HUB_SLUGS = [
  // —— Parent hubs ——
  'dermatology',
  'laser-surgery',
  'body-contouring',
  'injectables',
  'dentistry',
  // —— Catalog leaf services ——
  'hair-transplant',
  'eyebrow-transplant',
  'skin-rejuvenation',
  'laser-hair-removal',
  'cosmetic-surgery',
  'slimming',
  'botox',
  'fillers',
  'mesotherapy',
  'dental-implant',
  'orthodontics',
  'dental-veneer',
  // —— Long-tail (Hair / Laser / Skin / HIFU) ——
  'hair-transplant-installment',
  'micro-fit-hair-transplant',
  'laser-candela-2026',
  'laser-titanium-2026',
  'mens-laser-shiraz',
  'co2-fractional-laser',
  'fotona-laser',
  'hifu-doublo-gold',
  'light-therapy',
  'mole-removal',
  'facial',
  'pore-treatment',
  'buccal-fat',
  // Soft-404 batch B
  'breast-surgery',
  'ear-piercing',
  'wart-cryotherapy',
  'skin-biopsy',
];

function hubPriority(slug) {
  return PARENT_SLUGS.has(slug) ? '0.7' : '0.8';
}

module.exports = { HUB_SLUGS, PARENT_SLUGS, hubPriority };
