'use strict';

/**
 * Canonical English slugs for /services/:slug
 * Duplicate Persian (and legacy alias) paths 301 here.
 */

const express = require('express');

const CANONICAL_SERVICE_SLUGS = new Set([
  'botox',
  'qswitch',
  'deka-laser',
  'candela-laser',
  'co2-laser',
  'fotona-laser',
  'hair-transplant-fit',
  'botox-filler',
  'eyebrow-beard-transplant',
  'rf-virtue-endolift',
  'hifu-doublo-gold',
  'light-therapy',
]);

/**
 * Duplicate / legacy slug → canonical English slug.
 * Keys are stored lowercase (Persian NFC).
 */
const SERVICE_SLUG_REDIRECTS = {
  // Q-switch (canonical: qswitch)
  'q-switch': 'qswitch',
  'q-switch-laser': 'qswitch',
  'qswitch-laser': 'qswitch',
  'qi-switch': 'qswitch',
  'لیزر-کیوسوئیچ': 'qswitch',
  'لیزر-کیو-سوئیچ': 'qswitch',
  'کیوسوئیچ': 'qswitch',
  'کیو-سوئیچ': 'qswitch',
  'لیزر-کیوسوییچ': 'qswitch',
  'كيوسوئيچ': 'qswitch',
  'ليزر-كيوسوئيچ': 'qswitch',

  // Botox (canonical: botox / botox-filler)
  'بوتاکس': 'botox',
  'تزریق-بوتاکس': 'botox',
  filler: 'botox-filler',
  'botox-and-filler': 'botox-filler',
  'بوتاکس-و-فیلر': 'botox-filler',
  'فیلر': 'botox-filler',

  // Lasers / devices
  deka: 'deka-laser',
  'لیزر-دکا': 'deka-laser',
  'دکا': 'deka-laser',
  candela: 'candela-laser',
  'کندلا': 'candela-laser',
  'لیزر-کندلا': 'candela-laser',
  co2: 'co2-laser',
  co2laser: 'co2-laser',
  'لیزر-co2': 'co2-laser',
  'لیزر-سی-او-دو': 'co2-laser',
  fotona: 'fotona-laser',
  'فوتونا': 'fotona-laser',
  'لیزر-فوتونا': 'fotona-laser',

  // Hair
  fit: 'hair-transplant-fit',
  'fit-method': 'hair-transplant-fit',
  'کاشت-مو-fit': 'hair-transplant-fit',
  'کاشت-ابرو-و-ریش': 'eyebrow-beard-transplant',
  'کاشت-ابرو': 'eyebrow-beard-transplant',

  // Energy devices
  'هایفو-دابلو-گلد': 'hifu-doublo-gold',
  'هایفو': 'hifu-doublo-gold',
  'rf-virtue': 'rf-virtue-endolift',
  'اندولیفت': 'rf-virtue-endolift',

  // Light therapy / phototherapy
  'لایت-تراپی': 'light-therapy',
  'لایتتراپی': 'light-therapy',
  'نوردرمانی': 'light-therapy',
  'نور-درمانی': 'light-therapy',
  'فتوتراپی': 'light-therapy',
  'light-therapy-shiraz': 'light-therapy',
};

function decodeSlug(raw) {
  let value = String(raw == null ? '' : raw).trim();
  try {
    value = decodeURIComponent(value);
  } catch (_err) {
    /* already decoded */
  }
  return value
    .normalize('NFC')
    .replace(/^\/+|\/+$/g, '')
    .replace(/^services\//i, '')
    .split(/[?#]/)[0]
    .trim()
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, '-');
}

function isEnglishServiceSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug || ''));
}

function persianLabelSlug(label) {
  return decodeSlug(
    String(label || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\u0600-\u06FF]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}

function registerAlias(fromSlug, canonical) {
  const from = decodeSlug(fromSlug);
  const to = decodeSlug(canonical);
  if (!from || !to || from === to) return;
  if (!SERVICE_SLUG_REDIRECTS[from]) SERVICE_SLUG_REDIRECTS[from] = to;
}

function resolveCanonicalEnglishSlug(raw) {
  const slug = decodeSlug(raw);
  if (!slug) return null;
  if (SERVICE_SLUG_REDIRECTS[slug]) return SERVICE_SLUG_REDIRECTS[slug];
  // "نور درمانی" → نور-درمانی — also match joined Persian forms (نوردرمانی).
  if (/[\u0600-\u06FF]/.test(slug)) {
    const collapsed = slug.replace(/-/g, '');
    if (collapsed !== slug && SERVICE_SLUG_REDIRECTS[collapsed]) {
      return SERVICE_SLUG_REDIRECTS[collapsed];
    }
  }
  if (CANONICAL_SERVICE_SLUGS.has(slug)) return slug;
  if (isEnglishServiceSlug(slug)) return slug;
  return null;
}

/** Hub/API slug: canonical English when mapped, else decoded lowercase slug. */
function resolveHubServiceSlug(raw) {
  return resolveCanonicalEnglishSlug(raw) || decodeSlug(raw);
}

function needsServiceSlugRedirect(raw) {
  const slug = decodeSlug(raw);
  const canonical = resolveCanonicalEnglishSlug(slug);
  return Boolean(canonical && slug && canonical !== slug);
}

function canonicalServicePath(raw) {
  const slug = resolveCanonicalEnglishSlug(raw);
  if (!slug) return null;
  return `/services/${slug}`;
}

function canonicalServiceUrl(raw, siteBase) {
  const path = canonicalServicePath(raw);
  if (!path) return null;
  const base = String(siteBase || 'https://salam-doctor.com').replace(/\/+$/, '');
  return `${base}${path}`;
}

function englishSlugFromLabel(label) {
  const raw = String(label || '').trim();
  if (!raw) return null;
  const asSlug = decodeSlug(raw);
  const mapped = resolveCanonicalEnglishSlug(asSlug) || resolveCanonicalEnglishSlug(persianLabelSlug(raw));
  if (mapped) return mapped;
  try {
    const { transliterateFa } = require('./clinicSlug');
    const slugify = require('slugify');
    const latin = slugify(transliterateFa(raw), { lower: true, strict: true, trim: true });
    return latin ? latin.slice(0, 80) : null;
  } catch (_err) {
    return isEnglishServiceSlug(asSlug) ? asSlug : null;
  }
}

function slugsReferToSameService(a, b) {
  const ca = resolveCanonicalEnglishSlug(a) || decodeSlug(a);
  const cb = resolveCanonicalEnglishSlug(b) || decodeSlug(b);
  return Boolean(ca && cb && ca === cb);
}

/**
 * Express middleware: /services/{persian-or-alias} → 301 /services/{english}
 */
function serviceSlugRedirectMiddleware(req, res, next) {
  const pathname = String((req.path || req.url || '').split('?')[0]);
  const match = pathname.match(/^\/(api\/)?services\/(.+)$/i);
  if (!match) {
    if (typeof next === 'function') return next();
    return false;
  }
  const isApi = Boolean(match[1]);
  const raw = match[2];
  if (/^index\.html$/i.test(raw)) {
    if (typeof next === 'function') return next();
    return false;
  }
  const canonical = resolveCanonicalEnglishSlug(raw);
  const current = decodeSlug(raw);
  if (canonical && current && canonical !== current) {
    const dest = isApi ? `/api/services/${canonical}` : `/services/${canonical}`;
    res.redirect(301, dest);
    return true;
  }
  if (!isEnglishServiceSlug(current)) {
    res.status(404).type('text/plain; charset=utf-8').send('Service not found');
    return true;
  }
  if (typeof next === 'function') return next();
  return false;
}

function createServiceSlugRedirectApp() {
  const app = express();
  app.use(serviceSlugRedirectMiddleware);
  return app;
}

module.exports = {
  CANONICAL_SERVICE_SLUGS,
  SERVICE_SLUG_REDIRECTS,
  decodeSlug,
  isEnglishServiceSlug,
  persianLabelSlug,
  registerAlias,
  resolveCanonicalEnglishSlug,
  resolveHubServiceSlug,
  needsServiceSlugRedirect,
  canonicalServicePath,
  canonicalServiceUrl,
  englishSlugFromLabel,
  slugsReferToSameService,
  serviceSlugRedirectMiddleware,
  createServiceSlugRedirectApp,
};
