'use strict';

/**
 * Reusable breadcrumb helper — HTML nav + schema.org BreadcrumbList JSON-LD.
 *
 * Hierarchies:
 *   Profile:  Home > City > Doctor/Clinic
 *   Hub:      Home > City > Specialty/Service
 */

const { CITIES, getCity, localHubPath } = require('../local-seo-registry');
const clinicSlug = require('../clinicSlug');

const SITE_BASE = 'https://salam-doctor.com';
const HOME_NAME = 'خانه';

/** Persian (and Latin) specialty keywords → local-hub service slug */
const SPECIALTY_HUB_HINTS = [
  {
    slug: 'laser-hair-removal',
    name: 'لیزر موهای زائد',
    keywords: ['لیزر مو', 'موهای زائد', 'laser-hair', 'لیزر موهای'],
  },
  {
    slug: 'hair-transplant',
    name: 'کاشت مو',
    keywords: ['کاشت مو', 'کاشت‌مو', 'hair-transplant', 'fit', 'کاشت تخصصی مو'],
  },
  {
    slug: 'eyebrow-transplant',
    name: 'کاشت ابرو',
    keywords: ['کاشت ابرو', 'eyebrow', 'ابرو و ریش'],
  },
  {
    slug: 'skin-rejuvenation',
    name: 'جوانسازی پوست',
    keywords: ['جوانسازی', 'پوست', 'skin-rejuvenation', 'مزوتراپی پوست'],
  },
  {
    slug: 'botox',
    name: 'بوتاکس',
    keywords: ['بوتاکس', 'botox'],
  },
  {
    slug: 'fillers',
    name: 'فیلر',
    keywords: ['فیلر', 'filler'],
  },
  {
    slug: 'mesotherapy',
    name: 'مزوتراپی',
    keywords: ['مزوتراپی', 'mesotherapy'],
  },
  {
    slug: 'cosmetic-surgery',
    name: 'جراحی زیبایی',
    keywords: ['جراحی زیبایی', 'بلفارو', 'رینو', 'cosmetic-surgery'],
  },
  {
    slug: 'slimming',
    name: 'لاغری و پیکرتراشی',
    keywords: ['لاغری', 'پیکرتراشی', 'کرایو', 'slimming'],
  },
  {
    slug: 'hifu-doublo-gold',
    name: 'هایفو',
    keywords: ['هایفو', 'hifu', 'دابلو'],
  },
  {
    slug: 'co2-fractional-laser',
    name: 'لیزر CO2',
    keywords: ['co2', 'سی او دو', 'فراکشنال'],
  },
  {
    slug: 'dental-implant',
    name: 'ایمپلنت دندان',
    keywords: ['ایمپلنت', 'dental-implant'],
  },
  {
    slug: 'orthodontics',
    name: 'ارتودنسی',
    keywords: ['ارتودنسی', 'orthodont'],
  },
  {
    slug: 'dental-veneer',
    name: 'ونیر دندان',
    keywords: ['ونیر', 'لمینت', 'veneer'],
  },
];

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(pathOrUrl) {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return `${SITE_BASE}/`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return SITE_BASE + (raw.startsWith('/') ? raw : `/${raw}`);
}

function normalizeCrumb(item) {
  if (!item || !item.name) return null;
  const name = String(item.name).trim();
  if (!name) return null;
  const url = item.url != null && String(item.url).trim() ? String(item.url).trim() : null;
  return { name, url };
}

/**
 * @param {Array<{ name: string, url?: string|null }>} items
 * @returns {{ '@context': string, '@type': 'BreadcrumbList', itemListElement: object[] }}
 */
function breadcrumbListJsonLd(items) {
  const crumbs = (items || []).map(normalizeCrumb).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => {
      const entry = {
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
      };
      // Google expects absolute `item` URLs on every ListItem when available.
      if (crumb.url) entry.item = absoluteUrl(crumb.url);
      return entry;
    }),
  };
}

/**
 * Accessible breadcrumb nav markup (SSR-safe).
 * @param {Array<{ name: string, url?: string|null }>} items
 * @param {{ className?: string, wrapClass?: string, ariaLabel?: string }=} opts
 */
function breadcrumbNavHtml(items, opts) {
  const options = opts || {};
  const crumbs = (items || []).map(normalizeCrumb).filter(Boolean);
  if (!crumbs.length) return '';

  const navClass = options.className || 'seo-breadcrumb';
  const wrapClass = options.wrapClass || 'seo-breadcrumb-wrap';
  const ariaLabel = options.ariaLabel || 'breadcrumb';
  const lastIndex = crumbs.length - 1;

  const parts = crumbs.map((crumb, index) => {
    const isLast = index === lastIndex;
    let node;
    if (isLast || !crumb.url) {
      node =
        `<span class="seo-breadcrumb-current"${isLast ? ' aria-current="page"' : ''}>` +
        `${escapeHtml(crumb.name)}</span>`;
    } else {
      node =
        `<a href="${escapeHtml(absoluteUrl(crumb.url))}">${escapeHtml(crumb.name)}</a>`;
    }
    if (index === 0) return node;
    return (
      `<span class="seo-breadcrumb-separator" aria-hidden="true">›</span>${node}`
    );
  });

  return (
    `<div class="${escapeHtml(wrapClass)}">` +
    `<nav class="${escapeHtml(navClass)}" aria-label="${escapeHtml(ariaLabel)}" data-ssr-breadcrumb="1">` +
    parts.join('') +
    `</nav></div>`
  );
}

function citySlugFromName(cityName) {
  const text = String(cityName || '').trim();
  if (!text) return 'shiraz';
  const lower = text.toLowerCase();
  for (const city of Object.values(CITIES)) {
    if (
      city.slug === lower ||
      city.nameFa === text ||
      String(city.nameEn || '').toLowerCase() === lower
    ) {
      return city.slug;
    }
  }
  return 'shiraz';
}

function cityNameFa(citySlug, fallback) {
  const city = getCity(citySlug);
  return (city && city.nameFa) || fallback || 'شیراز';
}

/**
 * Infer hub service slug + display name from specialty text / clinic services.
 */
function resolveServiceCrumb(specialty, clinic) {
  const blobs = [];
  if (specialty) blobs.push(String(specialty));
  if (clinic) {
    if (clinic.medicalSpecialty) blobs.push(String(clinic.medicalSpecialty));
    if (clinic.specialty) blobs.push(String(clinic.specialty));
    if (Array.isArray(clinic.services)) {
      clinic.services.forEach((s) => {
        if (typeof s === 'string') blobs.push(s);
        else if (s && typeof s === 'object') {
          if (s.slug) blobs.push(String(s.slug));
          if (s.name) blobs.push(String(s.name));
          if (s.label) blobs.push(String(s.label));
          if (s.serviceName) blobs.push(String(s.serviceName));
        }
      });
    }
  }
  const haystack = blobs.join(' ').toLowerCase();

  // Prefer explicit English hub slug on a service object
  if (clinic && Array.isArray(clinic.services)) {
    for (const s of clinic.services) {
      if (s && typeof s === 'object' && s.slug) {
        const slug = String(s.slug).trim().toLowerCase();
        const hint = SPECIALTY_HUB_HINTS.find((h) => h.slug === slug);
        if (hint) {
          return {
            slug: hint.slug,
            name: String(s.name || s.label || s.serviceName || hint.name),
          };
        }
      }
    }
  }

  let best = null;
  let bestScore = 0;
  for (const hint of SPECIALTY_HUB_HINTS) {
    let score = 0;
    for (const kw of hint.keywords) {
      if (haystack.indexOf(String(kw).toLowerCase()) !== -1) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = hint;
    }
  }

  if (best && bestScore > 0) {
    return { slug: best.slug, name: String(specialty || best.name).trim() || best.name };
  }

  const name = String(specialty || '').trim() || 'خدمات پزشکی';
  return { slug: null, name };
}

function clinicDisplayName(clinic, fallback) {
  const raw =
    (clinic && (clinic.name || clinic.sliderTitle)) ||
    fallback ||
    'کلینیک';
  const n = String(raw).trim() || 'کلینیک';
  if (/^کلینیک\s/.test(n) || /^دکتر\s/.test(n) || /^پزشک\s/.test(n)) return n;
  return `کلینیک ${n}`;
}

/**
 * Profile trail: Home > City > Clinic (3 levels only).
 * Service hubs (/shiraz/hifu-doublo-gold) are separate landing pages — not shown on clinic profiles.
 * @returns {{ items: Array, jsonLd: object, html: string }}
 */
function buildProfileBreadcrumbs(opts) {
  const options = opts || {};
  const citySlug = options.citySlug || citySlugFromName(options.city);
  const cityLabel = cityNameFa(citySlug, options.city);
  const profilePath =
    options.profileUrl ||
    clinicSlug.clinicProfilePath(options.clinicId || (options.clinic && options.clinic.id));
  const doctorName = clinicDisplayName(options.clinic, options.name);

  const items = [
    { name: HOME_NAME, url: '/' },
    { name: cityLabel, url: `/${citySlug}` },
    { name: doctorName, url: profilePath },
  ];

  return {
    items,
    jsonLd: breadcrumbListJsonLd(items),
    html: breadcrumbNavHtml(items, {
      className: 'seo-breadcrumb profile-breadcrumb',
      wrapClass: 'container seo-breadcrumb-wrap profile-breadcrumb-wrap',
      ariaLabel: 'breadcrumb',
    }),
  };
}

/**
 * City–service hub trail: Home > City > Service
 * @returns {{ items: Array, jsonLd: object, html: string }}
 */
function buildLocalHubBreadcrumbs(opts) {
  const options = opts || {};
  const citySlug =
    options.citySlug ||
    (options.cityInfo && options.cityInfo.slug) ||
    citySlugFromName(options.city);
  const cityLabel =
    (options.cityInfo && options.cityInfo.nameFa) ||
    cityNameFa(citySlug, options.city);
  const serviceName =
    (options.service && options.service.name) ||
    options.serviceName ||
    'خدمت';
  const serviceSlug =
    (options.service && options.service.slug) || options.serviceSlug || '';
  const serviceUrl =
    options.canonicalPath ||
    (serviceSlug ? localHubPath(citySlug, serviceSlug) : `/${citySlug}`);

  const items = [
    { name: HOME_NAME, url: '/' },
    { name: cityLabel, url: `/${citySlug}` },
    { name: serviceName, url: serviceUrl },
  ];

  return {
    items,
    jsonLd: breadcrumbListJsonLd(items),
    html: breadcrumbNavHtml(items, {
      className: 'seo-breadcrumb landing-breadcrumb',
      wrapClass: 'seo-breadcrumb-wrap seo-breadcrumb-wrap--hub',
      ariaLabel: 'breadcrumb',
    }),
  };
}

/**
 * City hub trail: Home > City (e.g. /shiraz)
 * @returns {{ items: Array, jsonLd: object, html: string }}
 */
function buildCityHubBreadcrumbs(opts) {
  const options = opts || {};
  const citySlug =
    options.citySlug ||
    (options.cityInfo && options.cityInfo.slug) ||
    citySlugFromName(options.city);
  const cityLabel =
    (options.cityInfo && options.cityInfo.nameFa) ||
    cityNameFa(citySlug, options.city);
  const cityUrl = options.canonicalPath || `/${citySlug}`;

  const items = [
    { name: HOME_NAME, url: '/' },
    { name: cityLabel, url: cityUrl },
  ];

  return {
    items,
    jsonLd: breadcrumbListJsonLd(items),
    html: breadcrumbNavHtml(items, {
      className: 'seo-breadcrumb landing-breadcrumb',
      wrapClass: 'seo-breadcrumb-wrap seo-breadcrumb-wrap--hub',
      ariaLabel: 'breadcrumb',
    }),
  };
}

module.exports = {
  SITE_BASE,
  HOME_NAME,
  SPECIALTY_HUB_HINTS,
  absoluteUrl,
  escapeHtml,
  breadcrumbListJsonLd,
  breadcrumbNavHtml,
  citySlugFromName,
  cityNameFa,
  resolveServiceCrumb,
  buildProfileBreadcrumbs,
  buildLocalHubBreadcrumbs,
  buildCityHubBreadcrumbs,
};
