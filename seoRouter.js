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
const { buildLocalHubSeo, buildCityHubSeo } = require('./seoInfra');
const { HUB_SLUGS } = require('./hub-slugs');
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
  'mens-laser-shiraz': 'laser-hair-removal',
  'co2-fractional-laser': 'skin-rejuvenation',
  'hifu-doublo-gold': 'skin-rejuvenation',
  'laser-hair-removal': 'laser-surgery',
  'cosmetic-surgery': 'laser-surgery',
  'eyebrow-transplant': 'hair-transplant',
  'skin-rejuvenation': 'dermatology',
  botox: 'injectables',
  fillers: 'injectables',
  mesotherapy: 'injectables',
  'dental-implant': 'dentistry',
  orthodontics: 'dentistry',
  'dental-veneer': 'dentistry',
  slimming: 'body-contouring',
  'light-therapy': 'skin-rejuvenation',
});

let SEO_OVERRIDES = {};
try {
  SEO_OVERRIDES = require('./seo-config');
} catch (err) {
  console.warn('[seo] seo-config.js not loaded, using generated metadata only:', err && err.message);
}

function countActiveClinics(data) {
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
    push(data.service.parent.slug);
  }
  push(EMPTY_HUB_FALLBACK_SLUGS[current]);

  // Keyword heuristics when parent/map miss (e.g. future long-tails).
  if (current.includes('laser') && current !== 'laser-hair-removal') {
    push('laser-hair-removal');
    push('laser-surgery');
  }
  if (current.includes('hair') || current.includes('fit') || current.includes('transplant')) {
    push('hair-transplant');
    push('dermatology');
  }
  if (current.includes('botox') || current.includes('filler') || current.includes('meso')) {
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

let cachedClinicsData = null;

function loadClinicsData() {
  if (cachedClinicsData) return cachedClinicsData;
  try {
    const dataPath = path.join(__dirname, 'data.min.js');
    const src = fs.readFileSync(dataPath, 'utf8');
    const fn = new Function(`${src}; return typeof clinicsData !== "undefined" ? clinicsData : [];`);
    cachedClinicsData = fn() || [];
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
  return {
    id: c.id,
    name: c.name,
    address: c.address || '',
    profileUrl: c.link || c.profileUrl || `/doctor/${c.id}`,
    isActive: false,
    district: null,
    devices: [],
    rating: { value: 4.8, count: 12 },
  };
}

/** Hub page when Prisma service row is missing but slug is in sitemap/seo-config. */
function buildSyntheticHubPage(city, slug) {
  const key = String(slug || '').trim().toLowerCase();
  if (!city || !key || !isConfiguredHubSlug(key)) return null;

  const landing = SERVICE_LANDINGS[key] || {};
  const override = SEO_OVERRIDES[key] || {};
  const serviceName =
    String(landing.label || override.h1 || '').trim() || key;
  const parent =
    landing.parentCategory && PARENT_BY_CATEGORY[landing.parentCategory];
  const related = findRelatedClinicsByCategory(
    { slug: key, label: serviceName, parentCategory: landing.parentCategory },
    { loadClinicsData }
  );

  return {
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
    clinics: [],
    relatedClinics: (related.clinics || []).map(shapeRelatedClinicForHub),
    districts: [],
    stats: {
      total: 0,
      active: 0,
      withAuthenticDevice: 0,
      ratingValue: 4.8,
      reviewCount: 0,
    },
  };
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

    const activeCount = countActiveClinics(data);

    if (activeCount === 0 && EMPTY_HUB_MODE !== 'noindex') {
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
    }

    const fileOverride = SEO_OVERRIDES[slug] || {};
    const seo = buildLocalHubSeo(data, fileOverride);

    res.render(
      'directory',
      {
        ...data,
        seo,
        siteBase: SITE_BASE,
        hubSeo: data.hubSeo || null,
        noindex: false,
        activeClinicCount: activeCount,
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

    const activeCount = countActiveClinics(data);
    let redirectTo = null;

    if (activeCount === 0 && EMPTY_HUB_MODE !== 'noindex') {
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
};
