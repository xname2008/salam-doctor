'use strict';

// ==========================================================================
// seoRouter — Express app serving programmatic-SEO hub pages.
//   GET /shiraz/:service_slug          (legacy canonical)
//   GET /:city_slug/:service_slug      e.g. /tehran/hair-transplant
//   GET /api/seo/local-hub/:city/:service  JSON for vanilla JS injection
//
// Mounted from server.js for known local-hub paths.
// ==========================================================================

const path = require('path');
const fs = require('fs');
const express = require('express');
const { DirectoryRepository } = require('./DirectoryRepository');
const { buildLocalHubSeo, buildCityHubSeo, hubListedClinicCount, HUB_LIST_MIN_CLINICS } = require('./seoInfra');
const { HUB_SLUGS } = require('./hub-slugs');
const { hubLabelFa } = require('./hub-labels');
const {
  SERVICE_LANDINGS,
  findRelatedClinicsByCategory,
} = require('./serviceLanding');
const {
  getCity,
  isKnownCitySlug,
  isReservedHubPrefix,
  localHubPath,
} = require('./local-seo-registry');
const {
  decodeSlug,
  resolveCanonicalEnglishSlug,
  resolveHubServiceSlug,
} = require('./serviceSlugMap');

const SITE_BASE = process.env.SITE_BASE || 'https://salam-doctor.com';
const PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * EMPTY_HUB_MODE:
 *   auto     — 301 to a parent/fallback hub with active clinics; else noindex (default)
 *   redirect — always 301 when a fallback target exists; else noindex
 *   noindex  — never redirect; always render with robots noindex when empty
 */
const EMPTY_HUB_MODE = String(process.env.EMPTY_HUB_MODE || 'auto').toLowerCase();

/** Slug → broader hub when Prisma parent is missing or empty */
const EMPTY_HUB_FALLBACK_SLUGS = Object.freeze({
  'hair-transplant-installment': 'hair-transplant',
  'micro-fit-hair-transplant': 'hair-transplant',
  'laser-candela-2026': 'laser-hair-removal',
  'laser-titanium-2026': 'laser-hair-removal',
  'mens-laser-shiraz': 'laser-hair-removal',
  'co2-fractional-laser': 'skin-rejuvenation',
  'fotona-laser': 'skin-rejuvenation',
  'hifu-doublo-gold': 'skin-rejuvenation',
  // Pillar hubs keep their own URL (never 301 to parent) — see PILLAR_HUBS_NO_EMPTY_REDIRECT
  'eyebrow-transplant': 'hair-transplant',
  'skin-rejuvenation': 'dermatology',
  'dental-implant': 'dentistry',
  orthodontics: 'dentistry',
  'dental-veneer': 'dentistry',
  // slimming is pillar KEEP — body-contouring aliases 301 to /shiraz/slimming
  'mole-removal': 'skin-rejuvenation',
  facial: 'skin-rejuvenation',
  'pore-treatment': 'skin-rejuvenation',
  'buccal-fat': 'cosmetic-surgery',
  'breast-surgery': 'cosmetic-surgery',
  'ear-piercing': 'dermatology',
  'wart-cryotherapy': 'dermatology',
  'skin-biopsy': 'dermatology',
});

/**
 * Category / silo pillar hubs: always 200 with self-canonical even when empty.
 * Prevents mesotherapy→injectables and cosmetic-surgery→laser-surgery cannibalization.
 */
const PILLAR_HUBS_NO_EMPTY_REDIRECT = new Set([
  'injectables',
  'mesotherapy',
  'fillers',
  'botox',
  'cosmetic-surgery',
  'laser-hair-removal',
  'laser-surgery',
  'skin-rejuvenation',
  'hair-transplant',
  'dermatology',
  'dentistry',
  'body-contouring',
  'slimming',
  'rhinoplasty',
  'lasik',
  'femto-lasik',
  'prk',
  'pharmacy',
  'breast-surgery',
  'ear-piercing',
  'wart-cryotherapy',
  'skin-biopsy',
  'light-therapy',
  // Device / long-tail hubs: stay 200 GUIDE after placeholder purge (never 301 empty→parent)
  'facial',
  'mole-removal',
  'buccal-fat',
  'pore-treatment',
  'laser-candela-2026',
  'laser-titanium-2026',
  'fotona-laser',
  'co2-fractional-laser',
]);

let SEO_OVERRIDES = {};
try {
  SEO_OVERRIDES = require('./seo-config');
} catch (err) {
  console.warn('[seo] seo-config.js not loaded, using generated metadata only:', err && err.message);
}

function countActiveClinics(data) {
  // Prefer primary listed clinics (same counter as SERP / FAQ / cards).
  if (typeof hubListedClinicCount === 'function') {
    return hubListedClinicCount(data);
  }
  if (!data) return 0;
  if (data.stats && typeof data.stats.active === 'number') {
    return data.stats.active;
  }
  const clinics = Array.isArray(data.clinics) ? data.clinics : [];
  return clinics.filter((c) => c && c.isActive !== false).length;
}

/**
 * Candidate targets for an empty hub, most-specific first.
 * Never includes the current slug.
 */
function emptyHubFallbackCandidates(data) {
  const current = String((data && data.service && data.service.slug) || '')
    .trim()
    .toLowerCase();
  const out = [];
  const push = (slug) => {
    const s = String(slug || '')
      .trim()
      .toLowerCase();
    if (!s || s === current || out.includes(s)) return;
    out.push(s);
  };

  if (data && data.service && data.service.parent && data.service.parent.slug) {
    const parentSlug = String(data.service.parent.slug).trim().toLowerCase();
    // Do not fall back from a pillar hub onto its parent (self-canonical).
    if (!PILLAR_HUBS_NO_EMPTY_REDIRECT.has(current)) {
      push(parentSlug);
    }
  }
  push(EMPTY_HUB_FALLBACK_SLUGS[current]);

  // Keyword heuristics when parent/map miss (e.g. future long-tails).
  // Fotona is rejuvenation/tightening — never fall back to hair-removal.
  if (
    current.includes('laser') &&
    current !== 'laser-hair-removal' &&
    current !== 'laser-surgery' &&
    !current.includes('fotona') &&
    !current.includes('co2')
  ) {
    push('laser-hair-removal');
    push('laser-surgery');
  }
  if (current.includes('hair') || current.includes('fit') || current.includes('transplant')) {
    push('hair-transplant');
    push('dermatology');
  }
  if (
    !PILLAR_HUBS_NO_EMPTY_REDIRECT.has(current) &&
    (current.includes('botox') || current.includes('filler') || current.includes('meso'))
  ) {
    push('injectables');
  }

  return out;
}

/**
 * Find a city–service path that has at least one active clinic.
 * @returns {Promise<string|null>} e.g. "/shiraz/laser-hair-removal"
 */
async function resolveNonEmptyFallbackPath(repo, citySlug, data) {
  const candidates = emptyHubFallbackCandidates(data);
  for (const targetSlug of candidates) {
    try {
      const target = await repo.getLocalHubPageData(citySlug, targetSlug);
      if (target && countActiveClinics(target) > 0) {
        return localHubPath(citySlug, targetSlug);
      }
    } catch (err) {
      console.warn(
        '[seo] empty-hub fallback lookup failed for',
        citySlug,
        targetSlug,
        (err && err.message) || err
      );
    }
  }
  return null;
}

const PARENT_BY_CATEGORY = Object.freeze({
  'skin-aesthetic': { slug: 'skin-rejuvenation', name: 'جوانسازی پوست' },
});

/** Catalog keyword match for long-tail hubs (when Prisma service row is missing). */
const DEVICE_HUB_CLINIC_KEYWORDS = Object.freeze({
  'laser-candela-2026': ['کندلا', 'کاندلا', 'candela'],
  'laser-titanium-2026': ['تیتانیوم', 'titanium', 'پلاتینیوم', 'platinum'],
  'fotona-laser': ['فوتونا', 'fotona'],
  'co2-fractional-laser': ['co2', 'فرکشنال', 'سی او دو', 'سی‌او‌دو'],
  'mole-removal': ['خال', 'برداشتن خال', 'برداشت خال'],
  facial: ['فیشیال', 'پاکسازی پوست', 'پاکسازی'],
  'pore-treatment': ['منافذ', 'منافذ باز'],
  'buccal-fat': ['بوکال', 'buccal'],
  'breast-surgery': ['سینه', 'جراحی سینه', 'ماموپلاستی', 'breast'],
  'ear-piercing': ['پیرسینگ', 'پیرسینگ گوش', 'piercing'],
  'wart-cryotherapy': ['زگیل', 'زگیل تناسلی', 'کرایو', 'کرایوتراپی'],
  'skin-biopsy': ['نمونه برداری', 'نمونه‌برداری', 'بیوپسی', 'biopsy'],
});

const HUB_PARENT_FALLBACK = Object.freeze({
  'laser-candela-2026': { slug: 'laser-hair-removal', name: 'لیزر موهای زائد' },
  'laser-titanium-2026': { slug: 'laser-hair-removal', name: 'لیزر موهای زائد' },
  'fotona-laser': { slug: 'skin-rejuvenation', name: 'جوانسازی پوست' },
  'co2-fractional-laser': { slug: 'skin-rejuvenation', name: 'جوانسازی پوست' },
  'mole-removal': { slug: 'skin-rejuvenation', name: 'جوانسازی پوست' },
  facial: { slug: 'skin-rejuvenation', name: 'جوانسازی پوست' },
  'pore-treatment': { slug: 'skin-rejuvenation', name: 'جوانسازی پوست' },
  'buccal-fat': { slug: 'cosmetic-surgery', name: 'جراحی زیبایی' },
  'breast-surgery': { slug: 'cosmetic-surgery', name: 'جراحی زیبایی' },
  'ear-piercing': { slug: 'dermatology', name: 'پوست و مو' },
  'wart-cryotherapy': { slug: 'dermatology', name: 'پوست و مو' },
  'skin-biopsy': { slug: 'dermatology', name: 'پوست و مو' },
});

const { clinicProfilePath } = require('./clinicSlug');
const {
  isHubListableClinic,
  sanitizeHubClinicList,
  sanitizeHubPageData,
} = require('./hubClinicSanitize');

let cachedClinicsData = null;

function loadClinicsData() {
  if (cachedClinicsData) return cachedClinicsData;
  try {
    const dataPath = path.join(__dirname, 'data.min.js');
    const src = fs.readFileSync(dataPath, 'utf8');
    const fn = new Function(`${src}; return typeof clinicsData !== "undefined" ? clinicsData : [];`);
    const raw = fn() || [];
    cachedClinicsData = sanitizeHubClinicList(
      (Array.isArray(raw) ? raw : []).map((c) => ({
        ...c,
        // Normalize profile URL so dead /doctor/{id} stubs are detectable.
        profileUrl: c.link || clinicProfilePath(c),
        link: c.link || clinicProfilePath(c),
      }))
    );
  } catch (err) {
    console.warn('[seo] loadClinicsData failed:', (err && err.message) || err);
    cachedClinicsData = [];
  }
  return cachedClinicsData;
}

function isConfiguredHubSlug(slug) {
  const key = String(slug || '').trim().toLowerCase();
  return HUB_SLUGS.includes(key) || Boolean(SEO_OVERRIDES[key]) || Boolean(SERVICE_LANDINGS[key]);
}

function shapeRelatedClinicForHub(c) {
  const profileUrl = c.link || c.profileUrl || clinicProfilePath(c);
  return {
    id: c.id,
    name: c.name,
    address: c.address || '',
    profileUrl,
    isActive: false,
    district: null,
    devices: [],
    rating: { value: 4.8, count: 12 },
  };
}

function findCatalogClinicsForDeviceHub(slug) {
  const key = String(slug || '').trim().toLowerCase();
  const keywords = DEVICE_HUB_CLINIC_KEYWORDS[key];
  if (!keywords || !keywords.length) return [];
  const clinics = loadClinicsData();
  const matched = [];
  for (const clinic of clinics) {
    if (!clinic || clinic.id == null) continue;
    if (!isHubListableClinic(clinic)) continue;
    const haystack = [
      clinic.name,
      clinic.sliderTitle,
      clinic.sliderTagline,
      ...(Array.isArray(clinic.services)
        ? clinic.services.map((s) =>
            typeof s === 'string' ? s : (s && (s.label || s.name || s.slug)) || ''
          )
        : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!keywords.some((kw) => haystack.includes(String(kw).toLowerCase()))) continue;
    const profileUrl = clinic.link || clinic.profileUrl || clinicProfilePath(clinic);
    matched.push({
      id: Number(clinic.id),
      name: clinic.name || clinic.sliderTitle || `مرکز ${clinic.id}`,
      address: clinic.address || '',
      profileUrl,
      slug: clinic.slug || null,
      isActive: true,
      district: null,
      devices: [],
      rating: { value: 4.8, count: 12 },
    });
  }
  matched.sort((a, b) => {
    if (a.id === 114) return -1;
    if (b.id === 114) return 1;
    return String(a.name).localeCompare(String(b.name), 'fa');
  });
  return sanitizeHubClinicList(matched);
}

/** Hub page when Prisma service row is missing but slug is in sitemap/seo-config. */
function buildSyntheticHubPage(city, slug) {
  const key = String(slug || '').trim().toLowerCase();
  if (!city || !key || !isConfiguredHubSlug(key)) return null;

  const landing = SERVICE_LANDINGS[key] || {};
  const override = SEO_OVERRIDES[key] || {};
  const serviceName =
    String(landing.label || hubLabelFa(key) || '').trim() || key;
  const parent =
    (landing.parentCategory && PARENT_BY_CATEGORY[landing.parentCategory]) ||
    HUB_PARENT_FALLBACK[key] ||
    null;
  const deviceClinics = findCatalogClinicsForDeviceHub(key);
  const related = deviceClinics.length
    ? { clinics: [], badge: '' }
    : findRelatedClinicsByCategory(
        { slug: key, label: serviceName, parentCategory: landing.parentCategory },
        { loadClinicsData }
      );

  return sanitizeHubPageData({
    citySlug: city.slug,
    cityInfo: city,
    city: city.nameFa,
    canonicalPath: localHubPath(city.slug, key),
    hubSeo: null,
    service: {
      id: null,
      name: serviceName,
      slug: key,
      parent: parent ? { name: parent.name, slug: parent.slug } : null,
      children: [],
      basePrice: null,
      minPrice: null,
    },
    clinics: deviceClinics,
    relatedClinics: sanitizeHubClinicList(
      (related.clinics || []).map(shapeRelatedClinicForHub)
    ),
    districts: [],
    stats: {
      total: deviceClinics.length,
      active: deviceClinics.length,
      withAuthenticDevice: 0,
      ratingValue: 4.8,
      reviewCount: 0,
    },
  });
}

function createSeoApp(options = {}) {
  const repo = options.repository || new DirectoryRepository(options.repoOptions);
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('etag', 'strong');

  const htmlCache = new Map(); // cacheKey -> { expires, html, noindex?: boolean }

  /** @param {string} cacheKey */
  function getCachedHtml(cacheKey) {
    const hit = htmlCache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit;
    return null;
  }

  function setCachedHtml(cacheKey, html, meta) {
    htmlCache.set(cacheKey, {
      expires: Date.now() + PAGE_CACHE_TTL_MS,
      html,
      noindex: Boolean(meta && meta.noindex),
    });
  }

  function sendHtml(res, html, cacheStatus) {
    res.set('X-Cache', cacheStatus);
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.type('html').send(html);
  }

  function sendPermanentRedirect(res, location) {
    res.set('Cache-Control', 'public, max-age=600');
    res.redirect(301, location);
  }

  async function renderLocalHub(req, res, citySlug, serviceSlug) {
    const city = getCity(citySlug);
    if (!city) return res.status(404).send('شهر یافت نشد');

    const decoded = decodeSlug(serviceSlug);
    const canonical = resolveCanonicalEnglishSlug(serviceSlug);
    if (canonical && canonical !== decoded) {
      const dest = localHubPath(city.slug, canonical);
      if (dest !== localHubPath(city.slug, decoded)) {
        return sendPermanentRedirect(res, dest);
      }
    }

    const slug = resolveHubServiceSlug(serviceSlug);
    if (!slug || /\.[a-z0-9]+$/i.test(slug)) return res.status(404).send('Not found');

    if (typeof repo.isHubPublished === 'function') {
      const published = await repo.isHubPublished(city.slug, slug);
      if (!published) return res.status(404).send('دسته‌بندی یافت نشد');
    }

    const cacheKey = `${city.slug}:${slug}`;
    const cached = getCachedHtml(cacheKey);
    if (cached && cached.html) {
      return sendHtml(res, cached.html, 'HIT');
    }

    let data;
    try {
      data = await repo.getLocalHubPageData(city.slug, slug);
    } catch (err) {
      console.error('[seo] repository error for', cacheKey, err && err.message);
      return res.status(503).send('سرویس موقتاً در دسترس نیست');
    }

    if (!data) {
      data = buildSyntheticHubPage(city, slug);
    }
    if (!data) return res.status(404).send('دسته‌بندی یافت نشد');

    // Drop Sample Clinic / dead /doctor/{id} fixtures before counts, SEO, and render.
    sanitizeHubPageData(data);

    const activeCount = countActiveClinics(data);

    if (
      activeCount === 0 &&
      EMPTY_HUB_MODE !== 'noindex' &&
      !PILLAR_HUBS_NO_EMPTY_REDIRECT.has(slug)
    ) {
      const fallbackPath = await resolveNonEmptyFallbackPath(repo, city.slug, data);
      if (fallbackPath && fallbackPath !== localHubPath(city.slug, slug)) {
        console.log(
          `[seo] empty hub prune: /${city.slug}/${slug} (active=0) → 301 ${fallbackPath}`
        );
        return sendPermanentRedirect(res, fallbackPath);
      }
      console.log(
        `[seo] empty hub retained: /${city.slug}/${slug} (active=0) → 200 indexable`
      );
    } else if (activeCount === 0 && PILLAR_HUBS_NO_EMPTY_REDIRECT.has(slug)) {
      console.log(
        `[seo] pillar hub retained: /${city.slug}/${slug} (active=0) → 200 self-canonical`
      );
    }

    const fileOverride = SEO_OVERRIDES[slug] || {};
    const seo = buildLocalHubSeo(data, fileOverride);
    const hubMode = seo.hubMode || (activeCount >= HUB_LIST_MIN_CLINICS ? 'list' : 'guide');

    res.render(
      'directory',
      {
        ...data,
        seo,
        siteBase: SITE_BASE,
        hubSeo: data.hubSeo || null,
        noindex: false,
        activeClinicCount: activeCount,
        listedClinicCount: seo.listedClinicCount != null ? seo.listedClinicCount : activeCount,
        hubMode,
        relatedClinics: data.relatedClinics || [],
      },
      (err, html) => {
        if (err) {
          console.error('[seo] render error for', cacheKey, err && err.message);
          return res.status(500).send('خطای رندر صفحه');
        }
        setCachedHtml(cacheKey, html, {});
        sendHtml(res, html, 'MISS');
      }
    );
  }

  async function renderCityHub(req, res, citySlug) {
    const city = getCity(citySlug);
    if (!city) return res.status(404).send('شهر یافت نشد');

    const cacheKey = `city-hub:${city.slug}`;
    const cached = getCachedHtml(cacheKey);
    if (cached && cached.html) {
      return sendHtml(res, cached.html, 'HIT');
    }

    let data;
    try {
      data = await repo.getCityHubPageData(city.slug);
    } catch (err) {
      console.error('[seo] city hub error for', city.slug, err && err.message);
      return res.status(503).send('سرویس موقتاً در دسترس نیست');
    }
    if (!data) return res.status(404).send('شهر یافت نشد');

    const seo = buildCityHubSeo(data);

    res.render(
      'city-hub',
      {
        ...data,
        seo,
        siteBase: SITE_BASE,
      },
      (err, html) => {
        if (err) {
          console.error('[seo] city hub render error for', city.slug, err && err.message);
          return res.status(500).send('خطای رندر صفحه');
        }
        setCachedHtml(cacheKey, html, {});
        sendHtml(res, html, 'MISS');
      }
    );
  }

  // City hub — /shiraz (must be registered BEFORE /shiraz/:service_slug).
  app.get('/shiraz', (req, res) => {
    renderCityHub(req, res, 'shiraz');
  });

  // Legacy Shiraz canonical URLs (registered first — same handler as multi-city).
  app.get('/shiraz/:service_slug', (req, res) => {
    renderLocalHub(req, res, 'shiraz', req.params.service_slug);
  });

  // Multi-city local SEO hubs.
  app.get('/:city_slug/:service_slug', (req, res) => {
    const citySlug = String(req.params.city_slug || '').trim().toLowerCase();
    if (isReservedHubPrefix(citySlug) || !isKnownCitySlug(citySlug)) {
      return res.status(404).send('Not found');
    }
    if (citySlug === 'shiraz') {
      return res.status(404).send('Not found');
    }
    renderLocalHub(req, res, citySlug, req.params.service_slug);
  });

  // JSON API for vanilla JS / static HTML pages (inject via headHtml or individual fields).
  app.get('/api/seo/local-hub/:city_slug/:service_slug', async (req, res) => {
    const citySlug = String(req.params.city_slug || '').trim().toLowerCase();
    const serviceSlug = String(req.params.service_slug || '').trim();

    if (!isKnownCitySlug(citySlug) || !serviceSlug) {
      return res.status(404).json({ error: 'not_found' });
    }

    const decoded = decodeSlug(serviceSlug);
    const canonical = resolveCanonicalEnglishSlug(serviceSlug);
    if (canonical && canonical !== decoded) {
      return res.redirect(301, localHubPath(citySlug, canonical));
    }

    const resolvedSlug = resolveHubServiceSlug(serviceSlug);

    let data;
    try {
      data = await repo.getLocalHubPageData(citySlug, resolvedSlug);
    } catch (err) {
      console.error('[seo] API repository error for', citySlug, serviceSlug, err && err.message);
      return res.status(503).json({ error: 'service_unavailable' });
    }

    if (!data) return res.status(404).json({ error: 'not_found' });

    sanitizeHubPageData(data);

    const activeCount = countActiveClinics(data);
    let redirectTo = null;

    if (
      activeCount === 0 &&
      EMPTY_HUB_MODE !== 'noindex' &&
      !PILLAR_HUBS_NO_EMPTY_REDIRECT.has(resolvedSlug)
    ) {
      redirectTo = await resolveNonEmptyFallbackPath(repo, citySlug, data);
    }

    const fileOverride = SEO_OVERRIDES[resolvedSlug] || SEO_OVERRIDES[serviceSlug] || {};
    const seo = buildLocalHubSeo(data, fileOverride);

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');

    res.json({
      city: citySlug,
      service: resolvedSlug,
      path: localHubPath(citySlug, resolvedSlug),
      activeClinicCount: activeCount,
      empty: activeCount === 0,
      hubMode: seo.hubMode || (activeCount >= HUB_LIST_MIN_CLINICS ? 'list' : 'guide'),
      listedClinicCount: seo.listedClinicCount != null ? seo.listedClinicCount : activeCount,
      noindex: false,
      redirectTo,
      title: seo.title,
      description: seo.description,
      h1: seo.h1Title,
      h1Title: seo.h1Title,
      seoDescriptionHtml: seo.seoDescriptionHtml || '',
      canonical: seo.canonical,
      ogImage: seo.ogImage,
      breadcrumbHtml: seo.breadcrumbHtml || '',
      breadcrumbItems: seo.breadcrumbItems || [],
      jsonLd: seo.jsonLdObject,
      headHtml: seo.headHtml,
      clinics: data.clinics.map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        phone: c.phone,
        services: c.services,
        rating: c.rating,
        profileUrl: c.profileUrl,
        slug: c.slug,
        district: c.district,
        isActive: c.isActive,
      })),
    });
  });

  app.clearHtmlCache = () => htmlCache.clear();
  return app;
}

/** @deprecated use buildLocalHubSeo from seoInfra */
function buildSeo(data) {
  const override = SEO_OVERRIDES[data.service.slug] || {};
  return buildLocalHubSeo(data, override);
}

module.exports = {
  createSeoApp,
  buildSeo,
  countActiveClinics,
  emptyHubFallbackCandidates,
  resolveNonEmptyFallbackPath,
  EMPTY_HUB_FALLBACK_SLUGS,
  PILLAR_HUBS_NO_EMPTY_REDIRECT,
};
