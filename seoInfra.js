/**
 * Dynamic SEO meta + JSON-LD + sitemap helpers.
 * Uses catalog (data.min.js) + SQLite overlays; optionally merges Prisma/Postgres.
 */
'use strict';

const { buildMedicalEntityJsonLd } = require('./jsonLdMedicalEntity');
const { buildFaqPageJsonLd } = require('./faqPageJsonLd');
const clinicSlug = require('./clinicSlug');
const {
  breadcrumbListJsonLd,
  breadcrumbNavHtml,
  buildProfileBreadcrumbs,
  buildLocalHubBreadcrumbs,
  buildCityHubBreadcrumbs,
} = require('./utils/breadcrumb');
const {
  isEnglishServiceSlug,
  resolveCanonicalEnglishSlug,
  canonicalServicePath,
  SERVICES_REDIRECTED_TO_HUB,
} = require('./serviceSlugMap');

let sanitizeHtml;
try {
  sanitizeHtml = require('sanitize-html');
} catch (_err) {
  sanitizeHtml = (html) => String(html || '');
}

const SITE_BASE = 'https://salam-doctor.com';
const DEFAULT_OG = `${SITE_BASE}/images/hero-collage.png`;
const SITE_NAME_FA = 'سلام دکتر';
const SITE_NAME_EN = 'Salam Doctor';
const SITE_LOGO = `${SITE_BASE}/images/logo-heart.svg`;

/** Public category landings (id → file + Persian name).
 * Dual-hub losers (hair/skin/injection/surgery/laser) 301 to /shiraz/*;
 * keep file keys for legacy categorySeo lookups only.
 */
const CATEGORY_PAGES = [
  { id: 'hair', file: 'hair-transplant.html', name: 'کاشت مو و ابرو' },
  { id: 'skin', file: 'skin-rejuvenation.html', name: 'جوانسازی و پوست' },
  { id: 'laser', file: 'laser-hair.html', name: 'لیزر موهای زائد' },
  { id: 'injection', file: 'injection.html', name: 'تزریقات زیبایی' },
  { id: 'surgery', file: 'cosmetic-surgery.html', name: 'جراحی زیبایی' },
  { id: 'slimming', file: 'slimming.html', name: 'لاغری و پیکرتراشی' },
  { id: 'lasik', file: 'lasik.html', name: 'لیزیک' },
  { id: 'femto-lasik', file: 'femto-lasik.html', name: 'فمتولیزیک' },
  { id: 'prk', file: 'prk.html', name: 'پی‌آر‌کی' },
  { id: 'products', file: 'products.html', name: 'محصولات زیبایی' },
  { id: 'eye', file: 'eye.html', name: 'چشم و بینایی' },
];

const CATEGORY_BY_FILE = new Map(
  CATEGORY_PAGES.map((c) => [c.file, c])
);

function escapeHtmlAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function xmlEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteUrl(pathOrUrl) {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return SITE_BASE + '/';
  if (/^https?:\/\//i.test(raw)) return raw;
  return SITE_BASE + (raw.startsWith('/') ? raw : '/' + raw);
}

function absoluteImage(pathOrUrl) {
  const raw = String(pathOrUrl || '').trim();
  if (!raw) return DEFAULT_OG;
  return absoluteUrl(raw);
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(value) {
  if (!value) return todayIsoDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? todayIsoDate() : d.toISOString().slice(0, 10);
}

function categorySeo(categoryName, fileName) {
  const fileKey = String(fileName || '').trim();
  const FILE_OVERRIDES = {
    'skin-rejuvenation.html': {
      title: 'بهترین مراکز جوانسازی پوست در شیراز | قیمت و نوبت‌دهی | سلام دکتر',
      description:
        'لیست کلینیک‌های جوانسازی و پوست در شیراز. مقایسه مراکز معتبر، قیمت و مشاوره رایگان با سلام دکتر.',
      h1: 'بهترین مراکز جوانسازی پوست در شیراز',
    },
    'slimming.html': {
      title: 'بهترین مراکز لاغری و پیکرتراشی در شیراز | قیمت و نوبت‌دهی | سلام دکتر',
      description:
        'لیست کلینیک‌های لاغری و پیکرتراشی در شیراز. مقایسه مراکز معتبر، قیمت و مشاوره رایگان با سلام دکتر.',
      h1: 'بهترین مراکز لاغری و پیکرتراشی در شیراز',
    },
    'injection.html': {
      title: 'بهترین مراکز تزریقات زیبایی در شیراز | قیمت و نوبت‌دهی | سلام دکتر',
      description:
        'لیست کلینیک‌های تزریق بوتاکس، فیلر و ژل در شیراز. مقایسه مراکز معتبر + مشاوره رایگان با سلام دکتر.',
      h1: 'بهترین مراکز تزریقات زیبایی در شیراز',
    },
    'laser-hair.html': {
      title: 'بهترین مراکز لیزر موهای زائد در شیراز | قیمت و نوبت‌دهی | سلام دکتر',
      description:
        'لیست کلینیک‌های لیزر موهای زائد در شیراز. مقایسه دستگاه‌ها و مراکز معتبر + مشاوره رایگان با سلام دکتر.',
      h1: 'بهترین مراکز لیزر موهای زائد در شیراز',
    },
    'cosmetic-surgery.html': {
      title: 'بهترین مراکز جراحی زیبایی در شیراز | قیمت و نوبت‌دهی | سلام دکتر',
      description:
        'لیست کلینیک‌های جراحی زیبایی در شیراز. مقایسه مراکز معتبر + مشاوره رایگان با سلام دکتر.',
      h1: 'بهترین مراکز جراحی زیبایی در شیراز',
    },
  };
  if (fileKey && FILE_OVERRIDES[fileKey]) {
    return FILE_OVERRIDES[fileKey];
  }
  const name = String(categoryName || '').trim() || 'زیبایی';
  const title = `بهترین کلینیک‌های ${name} در شیراز | سلام دکتر`;
  const description = `معرفی بهترین کلینیک‌های ${name} در شیراز. مقایسه مراکز معتبر، مشاهده خدمات و ارتباط مستقیم از طریق سلام دکتر.`;
  return { title, description };
}

function serviceSeo(serviceName) {
  const name = String(serviceName || '').trim() || 'خدمات زیبایی';
  const title = `مرکز تخصصی ${name} در شیراز | رزرو نوبت`;
  const description = `لیست مراکز تخصصی ${name} در شیراز. مشاهده پروفایل، آدرس و راه‌های ارتباط برای رزرو نوبت از طریق سلام دکتر.`;
  return { title, description };
}

function formatLocalBookingHeadline(opts) {
  const specialty = String((opts && opts.specialty) || '').trim() || 'خدمات پزشکی';
  const city = String((opts && opts.city) || '').trim();
  const neighborhood = String((opts && opts.neighborhood) || '').trim();

  let location = '';
  if (city && neighborhood) location = `${city}, ${neighborhood}`;
  else location = city || neighborhood;

  if (location) return `نوبت دهی ${specialty} در ${location}`;
  return `نوبت دهی ${specialty}`;
}

function clinicLocalSeoDescription(headline, opts) {
  const city = String((opts && opts.city) || '').trim();
  const neighborhood = String((opts && opts.neighborhood) || '').trim();
  const where = city && neighborhood ? `${city}، ${neighborhood}` : city || neighborhood;
  if (where) {
    return `${headline}. رزرو نوبت آنلاین، مشاهده آدرس و شماره تماس در ${where} از طریق سلام دکتر.`;
  }
  return `${headline}. رزرو نوبت آنلاین، مشاهده آدرس و شماره تماس از طریق سلام دکتر.`;
}

function resolveClinicLocalSeoModifiers(clinic, overlay) {
  const src = clinic || {};
  const extra = overlay || {};
  const pick = (...values) => {
    for (const value of values) {
      if (value == null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  };

  const district =
    src.district && typeof src.district === 'object'
      ? src.district.name || src.district.slug
      : src.district;
  const overlayDistrict =
    extra.district && typeof extra.district === 'object'
      ? extra.district.name
      : extra.district;

  const firstService = Array.isArray(src.services) && src.services[0]
    ? typeof src.services[0] === 'string'
      ? src.services[0]
      : src.services[0].name || src.services[0].label
    : null;

  const addrCity =
    src.address && typeof src.address === 'object' ? src.address.city : null;

  return {
    specialty:
      pick(
        src.medicalSpecialty,
        src.specialty,
        firstService,
        src.name,
        src.sliderTitle
      ) || 'خدمات پزشکی',
    city: pick(src.city, src.cityFa, src.city_name, addrCity, extra.city, extra.cityFa),
    neighborhood: pick(
      src.neighborhood,
      src.mahalle,
      district,
      extra.neighborhood,
      overlayDistrict
    ),
  };
}

function clinicSeo(clinicName, opts) {
  const options = opts || {};
  const specialty =
    String(options.specialty || clinicName || '').trim() || 'خدمات پزشکی';
  const city = String(options.city || 'شیراز').trim();
  const neighborhood = String(options.neighborhood || '').trim();
  const modifiers = { specialty, city, neighborhood };
  const displayName = String(clinicName || '').trim() || 'مرکز درمانی';
  const bookingHeadline = formatLocalBookingHeadline(modifiers);
  // Front-load clinic name + city; keep H1 shorter than <title>.
  const h1 = `${displayName} شیراز | پوست، مو و زیبایی`;
  const title = `${displayName} شیراز | پوست، مو و زیبایی | آدرس و نوبت | سلام دکتر`;
  return {
    title,
    h1,
    description: options.description || clinicLocalSeoDescription(bookingHeadline, modifiers),
  };
}

/**
 * Build the HTML fragment injected at <!-- DYNAMIC_SEO_TAGS -->.
 */
function buildSeoTagsHtml(opts) {
  const title = opts.title || '';
  const description = opts.description || '';
  // og:title / og:description default to the <title>/<meta description> values,
  // but callers (e.g. clinic profiles) may override them with a cleaner,
  // share-card-friendly value (e.g. just the clinic name) via ogTitle/ogDescription.
  const ogTitle = opts.ogTitle || title;
  const ogDescription = opts.ogDescription || description;
  const canonical = opts.canonical || SITE_BASE + '/';
  const ogImage = opts.ogImage || DEFAULT_OG;
  const jsonLd = Array.isArray(opts.jsonLd)
    ? opts.jsonLd
    : opts.jsonLd
      ? [opts.jsonLd]
      : [];

  const lines = [];
  if (title) lines.push(`  <title>${escapeHtmlAttr(title)}</title>`);
  if (description) {
    lines.push(
      `  <meta name="description" content="${escapeHtmlAttr(description)}">`
    );
  }
  if (!opts.skipCanonical) {
    lines.push(`  <link rel="canonical" href="${escapeHtmlAttr(canonical)}">`);
  }
  lines.push(`  <meta property="og:type" content="website">`);
  lines.push(`  <meta property="og:url" content="${escapeHtmlAttr(canonical)}">`);
  if (ogTitle) {
    lines.push(`  <meta property="og:title" content="${escapeHtmlAttr(ogTitle)}">`);
  }
  if (ogDescription) {
    lines.push(
      `  <meta property="og:description" content="${escapeHtmlAttr(ogDescription)}">`
    );
  }
  lines.push(`  <meta property="og:image" content="${escapeHtmlAttr(ogImage)}">`);
  lines.push(`  <meta property="og:locale" content="fa_IR">`);
  lines.push(`  <meta property="og:site_name" content="سلام دکتر">`);
  lines.push(`  <meta name="twitter:card" content="summary_large_image">`);
  if (ogTitle) {
    lines.push(`  <meta name="twitter:title" content="${escapeHtmlAttr(ogTitle)}">`);
  }
  if (ogDescription) {
    lines.push(
      `  <meta name="twitter:description" content="${escapeHtmlAttr(ogDescription)}">`
    );
  }
  lines.push(`  <meta name="twitter:image" content="${escapeHtmlAttr(ogImage)}">`);

  for (const obj of jsonLd.filter(Boolean)) {
    lines.push(
      `  <script type="application/ld+json">${JSON.stringify(obj).replace(
        /</g,
        '\\u003c'
      )}</script>`
    );
  }

  return lines.join('\n');
}

const SEO_PLACEHOLDER = '<!-- DYNAMIC_SEO_TAGS -->';
const LEGACY_SITE_HOST = 'salam-doctor.ir';

function metaAttrForKey(key) {
  if (key.startsWith('og:')) return 'property';
  return 'name';
}

/** Rewrite or insert a single meta tag; twitter keys use name= (not property=). */
function upsertMetaTag(html, key, value) {
  if (!value) return html;
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const primaryAttr = metaAttrForKey(key);
  const tag = `<meta ${primaryAttr}="${key}" content="${escapeHtmlAttr(value)}">`;
  const primaryRe = new RegExp(
    `<meta\\s+${primaryAttr}=["']${escapedKey}["']\\s+content=["'][^"']*["']\\s*/?>`,
    'i'
  );
  let out = html;
  if (primaryRe.test(out)) {
    out = out.replace(primaryRe, tag);
  } else {
    out = out.replace(/<\/head>/i, `  ${tag}\n</head>`);
  }
  // Legacy inject used property= for twitter:* — remove those duplicates.
  if (key.startsWith('twitter:')) {
    const wrongRe = new RegExp(
      `<meta\\s+property=["']${escapedKey}["']\\s+content=["'][^"']*["']\\s*/?>\\s*`,
      'gi'
    );
    out = out.replace(wrongRe, '');
  }
  return out;
}

/** Normalize any leftover .ir host in static head tags and page JSON-LD. */
function normalizeLegacySiteUrls(html) {
  let out = String(html || '');
  const legacy = `https://${LEGACY_SITE_HOST}`;
  if (!out.includes(LEGACY_SITE_HOST)) return out;

  out = out.replace(
    /<script type="application\/ld\+json"(?![^>]*data-seo-infra)[^>]*>[\s\S]*?<\/script>/gi,
    (block) => block.replace(new RegExp(legacy, 'g'), SITE_BASE)
  );
  const headMatch = out.match(/<head[^>]*>[\s\S]*?<\/head>/i);
  if (headMatch) {
    const fixedHead = headMatch[0].replace(new RegExp(legacy, 'g'), SITE_BASE);
    out = out.replace(headMatch[0], fixedHead);
  }
  return out;
}

/**
 * Inject SEO tags. Prefers replacing <!-- DYNAMIC_SEO_TAGS -->;
 * falls back to rewriting existing title/meta tags.
 */
function injectHeadSeo(html, opts) {
  // Every page gets Organization + WebSite (SearchAction) ahead of its own
  // page-specific schema, regardless of which branch below handles it.
  const mergedOpts = Object.assign({}, opts, {
    jsonLd: withGlobalSchema(opts.jsonLd),
  });

  const block = buildSeoTagsHtml(mergedOpts);
  let out = normalizeLegacySiteUrls(String(html || ''));

  if (out.includes(SEO_PLACEHOLDER)) {
    return normalizeLegacySiteUrls(out.replace(SEO_PLACEHOLDER, block));
  }

  // Legacy fallback: mutate existing tags
  const title = mergedOpts.title || '';
  const description = mergedOpts.description || '';
  const ogTitle = mergedOpts.ogTitle || title;
  const ogDescription = mergedOpts.ogDescription || description;
  const canonical = mergedOpts.canonical || SITE_BASE + '/';
  const ogImage = mergedOpts.ogImage || DEFAULT_OG;
  const jsonLd = mergedOpts.jsonLd;

  if (title) {
    if (/<title>[\s\S]*?<\/title>/i.test(out)) {
      out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(title)}</title>`);
    } else {
      out = out.replace(/<\/head>/i, `<title>${escapeHtmlAttr(title)}</title>\n</head>`);
    }
  }

  const metaPairs = [
    ['description', description],
    ['og:url', canonical],
    ['og:title', ogTitle],
    ['og:description', ogDescription],
    ['og:image', ogImage],
    ['twitter:title', ogTitle],
    ['twitter:description', ogDescription],
    ['twitter:image', ogImage],
  ];

  for (const [key, value] of metaPairs) {
    out = upsertMetaTag(out, key, value);
  }

  const canonRe = /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i;
  const canonTag = `<link rel="canonical" href="${escapeHtmlAttr(canonical)}">`;
  if (canonRe.test(out)) out = out.replace(canonRe, canonTag);
  else out = out.replace(/<\/head>/i, `  ${canonTag}\n</head>`);

  out = out.replace(
    /<script type="application\/ld\+json" data-seo-infra="1">[\s\S]*?<\/script>\s*/gi,
    ''
  );

  if (jsonLd.length) {
    const blocks = jsonLd
      .filter(Boolean)
      .map(
        (obj) =>
          `<script type="application/ld+json" data-seo-infra="1">${JSON.stringify(obj).replace(
            /</g,
            '\\u003c'
          )}</script>`
      )
      .join('\n');
    out = out.replace(/<\/head>/i, `${blocks}\n</head>`);
  }

  return normalizeLegacySiteUrls(out);
}

/**
 * Sitewide Organization schema — brand identity for Google's Knowledge Panel.
 * Emitted on every page (see injectHeadSeo) so it stays consistent platform-wide.
 */
function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_BASE}/#organization`,
    name: SITE_NAME_FA,
    alternateName: SITE_NAME_EN,
    url: `${SITE_BASE}/`,
    logo: {
      '@type': 'ImageObject',
      url: SITE_LOGO,
    },
    sameAs: ['https://ble.ir/salamdoctoradmin'],
  };
}

/**
 * Sitewide WebSite schema + SearchAction — enables Google's Sitelinks
 * Search Box. Target must match a real, working search route (see
 * searchRouter.js: GET /search?q=...).
 */
function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_BASE}/#website`,
    name: SITE_NAME_FA,
    alternateName: SITE_NAME_EN,
    url: `${SITE_BASE}/`,
    inLanguage: 'fa-IR',
    publisher: { '@id': `${SITE_BASE}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_BASE}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Prepend the sitewide Organization + WebSite schema to a page's own
 * jsonLd list. Kept as separate <script> blocks (not merged into one
 * object) so per-page schema (LocalBusiness, BreadcrumbList, …) stays
 * independent and easy to reason about.
 */
function withGlobalSchema(jsonLd) {
  const extra = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  return [organizationSchema(), websiteSchema(), ...extra];
}

/** @deprecated prefer breadcrumbListJsonLd from ./utils/breadcrumb — kept as alias */
function breadcrumbList(items) {
  return breadcrumbListJsonLd(
    (items || []).map((item) => ({
      name: item && item.name,
      url: item && (item.url != null ? item.url : item.item),
    }))
  );
}

/** First argument that parses to a finite number, else null. */
function firstFiniteNumber(...values) {
  for (const v of values) {
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function clampRating(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clinic/center profile schema — dynamically maps directory data into a
 * MedicalBusiness + BeautySalon LocalBusiness subtype (this platform lists
 * both medical and cosmetic/beauty centers, so both types are declared per
 * schema.org's multi-type support). AggregateRating is only included when
 * real rating + review-count data exists on the record — never fabricated,
 * per Google's structured-data guidelines.
 */
function medicalClinicSchema(clinic) {
  if (!clinic) return null;
  const name =
    clinic.name || clinic.sliderTitle || `مرکز ${clinic.id || ''}`.trim();
  const phone =
    (clinic.contact_info && clinic.contact_info.phone) ||
    clinic.phone ||
    null;
  const image = absoluteImage(clinic.image || DEFAULT_OG);
  const url = clinic.url || clinicProfilePath(clinic.id);
  const description =
    typeof clinic.description === 'string' && clinic.description.trim()
      ? clinic.description.trim()
      : null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': ['MedicalBusiness', 'BeautySalon'],
    name,
    image,
    url: absoluteUrl(url),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'شیراز',
      addressRegion: 'فارس',
      addressCountry: 'IR',
    },
  };
  if (description) schema.description = description;
  if (clinic.address) schema.address.streetAddress = String(clinic.address);
  if (phone) schema.telephone = String(phone);

  const lat = clinic.latitude != null ? Number(clinic.latitude) : null;
  const lng = clinic.longitude != null ? Number(clinic.longitude) : null;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng,
    };
  }

  // Only present once the directory actually stores real ratings/reviews.
  const ratingValue = firstFiniteNumber(clinic.ratingValue, clinic.rating);
  const reviewCount = firstFiniteNumber(
    clinic.reviewCount,
    clinic.ratingCount,
    clinic.reviewsCount
  );
  if (ratingValue != null && reviewCount != null && reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: clampRating(ratingValue, 1, 5),
      reviewCount: Math.round(reviewCount),
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

// --------------------------------------------------------------------------
// Local SEO hub helpers — /{city_slug}/{service_slug}
// MedicalClinic + AggregateRating JSON-LD, injectable <head> fragments.
// --------------------------------------------------------------------------

function formatTomanFa(n) {
  return Number(n).toLocaleString('fa-IR');
}

function graphNodeStrip(entity) {
  if (!entity || typeof entity !== 'object') return entity;
  const { '@context': _ctx, ...rest } = entity;
  return rest;
}

/**
 * Per-clinic MedicalClinic node for hub ItemList (DirectoryRepository shape).
 * @param {object} clinic
 * @param {object} cityInfo  from local-seo-registry
 */
function directoryClinicMedicalClinicSchema(clinic, cityInfo) {
  if (!clinic) return null;
  const city = cityInfo || { nameFa: 'شیراز', regionFa: 'فارس', country: 'IR' };
  const schema = {
    '@type': 'MedicalClinic',
    name: clinic.name,
    url: absoluteUrl(clinic.profileUrl || clinicProfilePath(clinic.id)),
    address: {
      '@type': 'PostalAddress',
      streetAddress: clinic.address || undefined,
      addressLocality: city.nameFa,
      addressRegion: city.regionFa,
      addressCountry: city.country || 'IR',
    },
  };
  if (clinic.phone) schema.telephone = String(clinic.phone);
  if (clinic.biography) schema.description = String(clinic.biography).slice(0, 500);
  if (Array.isArray(clinic.services) && clinic.services.length) {
    schema.medicalSpecialty = clinic.services.slice(0, 5);
  }
  if (clinic.district && clinic.district.name) {
    schema.areaServed = {
      '@type': 'Place',
      name: clinic.district.name,
    };
  }

  const ratingValue = firstFiniteNumber(
    clinic.rating && clinic.rating.value,
    clinic.ratingValue,
    clinic.rating
  );
  const reviewCount = firstFiniteNumber(
    clinic.rating && clinic.rating.count,
    clinic.reviewCount,
    clinic.ratingCount
  );
  if (ratingValue != null && reviewCount != null && reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: clampRating(ratingValue, 1, 5),
      reviewCount: Math.round(reviewCount),
      bestRating: 5,
      worstRating: 1,
    };
  }
  return schema;
}

/** Minimum primary clinics before SERP/body use LIST (comparison) framing. */
const HUB_LIST_MIN_CLINICS = 3;

/**
 * Count clinics rendered as primary cards on a hub (not relatedClinics).
 * Same number must drive LIST vs GUIDE, FAQ, and JSON-LD.
 */
function hubListedClinicCount(data) {
  const clinics = Array.isArray(data && data.clinics) ? data.clinics : [];
  const active = clinics.filter((c) => c && c.isActive !== false);
  return active.length > 0 ? active.length : clinics.length;
}

function isHubListMode(data) {
  return hubListedClinicCount(data) >= HUB_LIST_MIN_CLINICS;
}

/**
 * Hub-level MedicalClinic representing the city+service landing.
 */
function localHubMedicalClinicEntity(data, canonical, displayName) {
  const { service, cityInfo, stats, districts } = data;
  const city = cityInfo || { nameFa: data.city, regionFa: 'فارس', country: 'IR' };
  const hubId = `${canonical}#medical-clinic`;
  const label = displayName || `${service.name} در ${city.nameFa}`;
  const count = hubListedClinicCount(data);
  const description =
    count >= HUB_LIST_MIN_CLINICS
      ? `لیست مراکز ${service.name} در ${city.nameFa}`
      : count === 1
        ? `معرفی مرکز ${service.name} در ${city.nameFa}`
        : `راهنمای ${service.name} در ${city.nameFa}`;
  const entity = {
    '@type': 'MedicalClinic',
    '@id': hubId,
    name: label,
    url: canonical,
    description,
    address: {
      '@type': 'PostalAddress',
      addressLocality: city.nameFa,
      addressRegion: city.regionFa,
      addressCountry: city.country || 'IR',
    },
    medicalSpecialty: service.name,
  };
  if (city.latitude != null && city.longitude != null) {
    entity.geo = {
      '@type': 'GeoCoordinates',
      latitude: city.latitude,
      longitude: city.longitude,
    };
  }
  if (districts && districts.length) {
    entity.areaServed = districts.slice(0, 6).map((d) => ({
      '@type': 'Place',
      name: d.name,
    }));
  }
  if (stats.reviewCount > 0 && stats.ratingValue) {
    entity.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: clampRating(stats.ratingValue, 1, 5),
      reviewCount: Math.round(stats.reviewCount),
      bestRating: 5,
      worstRating: 1,
      itemReviewed: { '@id': hubId },
    };
  }
  return entity;
}

function localHubBreadcrumbList(data, canonical) {
  const built = buildLocalHubBreadcrumbs({
    city: data.city,
    cityInfo: data.cityInfo,
    citySlug: data.citySlug || (data.cityInfo && data.cityInfo.slug),
    service: data.service,
    canonicalPath: canonical || data.canonicalPath,
  });
  return built.jsonLd;
}

function localHubFaqPage(data, extraFaqs) {
  const { service, city } = data;
  const count = hubListedClinicCount(data);
  const listMode = isHubListMode(data);
  const priceAnswer = service.minPrice
    ? `هزینه ${service.name} در ${city} از حدود ${formatTomanFa(service.minPrice)} تومان شروع می‌شود و بسته به مرکز، تجهیزات و تعداد جلسات متغیر است.`
    : `هزینه ${service.name} در ${city} بسته به مرکز، تجهیزات و تعداد جلسات متفاوت است؛ برای قیمت دقیق مشاوره رایگان بگیرید.`;

  const custom = Array.isArray(extraFaqs)
    ? extraFaqs.filter((f) => f && f.q && f.a).map((f) => ({ name: f.q, text: f.a }))
    : [];

  let bestClinicAnswer;
  if (listMode) {
    bestClinicAnswer = `در حال حاضر ${count} مرکز ارائه‌دهنده ${service.name} در ${city} در سلام دکتر ثبت شده‌اند؛ مراکز را از نظر امتیاز، منطقه و تجهیزات مقایسه کنید و برای مشاوره رایگان اقدام نمایید.`;
  } else if (count === 1) {
    bestClinicAnswer =
      `در این صفحه می‌توانید پروفایل مرکز مرتبط با ${service.name} در ${city} را ببینید. فهرست مراکز این خدمت در حال تکمیل است؛ هنگام انتخاب به مجوز، تجربه پزشک و نمونه کار توجه کنید و برای معرفی مرکز از فرم ثبت‌نام استفاده کنید.`;
  } else {
    bestClinicAnswer =
      `فهرست مراکز ${service.name} در ${city} در حال تکمیل است. معیارهایی مانند مجوز رسمی، تجربه پزشک، نمونه کار و شفافیت هزینه را بررسی کنید و برای معرفی مرکز از فرم ثبت‌نام سلام دکتر استفاده کنید.`;
  }

  const qas = [
    ...custom,
    {
      name: `بهترین مرکز ${service.name} در ${city} کدام است؟`,
      text: bestClinicAnswer,
    },
    { name: `هزینه ${service.name} در ${city} چقدر است؟`, text: priceAnswer },
    {
      name: `چطور از اصل بودن دستگاه‌های ${service.name} مطمئن شویم؟`,
      text: 'مراکزی که در سلام دکتر نشان «دستگاه اصل» دارند، مدارک اصالت تجهیزات آن‌ها بررسی و تأیید شده است.',
    },
    {
      name: `برای رزرو نوبت ${service.name} چه کنیم؟`,
      text: 'کافی است روی دکمه «مشاوره رایگان» مرکز موردنظر کلیک کنید تا کارشناسان سلام دکتر شما را راهنمایی کنند.',
    },
  ];

  return {
    '@type': 'FAQPage',
    mainEntity: qas.map((qa) => ({
      '@type': 'Question',
      name: qa.name,
      acceptedAnswer: { '@type': 'Answer', text: qa.text },
    })),
  };
}

/**
 * ItemList of doctors/clinics for a city+service hub.
 * Each ListItem points at the canonical profile URL (/doctor/:slug).
 */
function buildLocalHubDoctorItemList(data, canonical) {
  const { service, city, clinics, cityInfo } = data;
  const activeClinics = (clinics || []).filter((c) => c && c.isActive !== false);
  const listed = activeClinics.length ? activeClinics : clinics || [];

  return {
    '@type': 'ItemList',
    '@id': `${canonical}#doctor-list`,
    name: `پزشکان و مراکز ${service.name} در ${city}`,
    description: `فهرست مراکز فعال ارائه‌دهنده ${service.name} در ${city}`,
    numberOfItems: listed.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: listed.map((c, i) => {
      const profileUrl = absoluteUrl(c.profileUrl || clinicProfilePath(c));
      const entity = directoryClinicMedicalClinicSchema(c, cityInfo) || {
        '@type': 'MedicalClinic',
        name: c.name,
      };
      entity.url = profileUrl;
      entity['@id'] = `${profileUrl}#clinic`;

      return {
        '@type': 'ListItem',
        position: i + 1,
        url: profileUrl,
        name: c.name,
        item: entity,
      };
    }),
  };
}

/**
 * Build @graph JSON-LD for a local hub page.
 * LIST (>=3 clinics): MedicalClinic + ItemList + FAQ.
 * GUIDE thin/empty: MedicalWebPage + FAQ; ItemList only when ≥1 clinic (no "لیست 0").
 */
function buildLocalHubJsonLd(data, canonical, extraFaqs, displayName) {
  const count = hubListedClinicCount(data);
  const listMode = isHubListMode(data);
  const faq = localHubFaqPage(data, extraFaqs);
  const crumbs = graphNodeStrip(localHubBreadcrumbList(data, canonical));
  const graph = [];

  if (listMode || count >= 1) {
    graph.push(localHubMedicalClinicEntity(data, canonical, displayName));
  } else {
    graph.push({
      '@type': 'MedicalWebPage',
      '@id': `${canonical}#webpage`,
      name: displayName || `${data.service.name} در ${data.city}`,
      url: canonical,
      description: `راهنمای ${data.service.name} در ${data.city}؛ معیارهای انتخاب مرکز و مشاوره رایگان سلام دکتر.`,
      inLanguage: 'fa-IR',
      isPartOf: { '@id': `${SITE_BASE}/#website` },
    });
  }

  graph.push(crumbs);

  if (count >= 1) {
    const itemList = buildLocalHubDoctorItemList(data, canonical);
    // Avoid boastful "لیست N مرکز برتر" in ItemList description
    itemList.description = listMode
      ? `فهرست مراکز فعال ارائه‌دهنده ${data.service.name} در ${data.city}`
      : `معرفی مرکز مرتبط با ${data.service.name} در ${data.city}`;
    graph.push(itemList);
  }

  graph.push(faq);

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

function sanitizeHubSeoHtml(html) {
  if (typeof sanitizeHtml !== 'function') {
    return String(html || '');
  }
  const defaults = sanitizeHtml.defaults || {};
  const baseTags = Array.isArray(defaults.allowedTags)
    ? defaults.allowedTags
    : ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'a'];
  return sanitizeHtml(String(html || ''), {
    allowedTags: baseTags.concat(['h2', 'h3', 'h4', 'img', 'figure', 'figcaption', 'section', 'article']),
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      '*': ['class', 'dir'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags:
      typeof sanitizeHtml.simpleTransform === 'function'
        ? { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }) }
        : undefined,
  });
}

/**
 * Title + meta description + H1 for a local hub (no HTML).
 * Precedence: seo-config overrides → DB LocalHubSeo → generated defaults.
 * Never put raw clinic counts in SERP fields when listed clinics < HUB_LIST_MIN_CLINICS.
 */
function buildLocalHubSeoMeta(data, overrides = {}) {
  const { service, city, districts, canonicalPath, hubSeo } = data;
  const canonical = absoluteUrl(canonicalPath || `/shiraz/${service.slug}`);
  const count = hubListedClinicCount(data);
  const listMode = isHubListMode(data);
  const districtNames = (districts || []).slice(0, 4).map((d) => d.name).join('، ');
  const priceBit = service.minPrice
    ? ` قیمت از ${formatTomanFa(service.minPrice)} تومان.`
    : '';

  const db = hubSeo || {};

  const defaultTitle = `بهترین مراکز ${service.name} در ${city} | قیمت و نوبت‌دهی | سلام دکتر`;
  const defaultH1 = `بهترین مراکز ${service.name} در ${city}`;
  const defaultDescription = listMode
    ? (`بهترین مراکز ${service.name} در ${city}` +
        (districtNames ? ` (${districtNames})` : '') +
        `؛ ${count} مرکز فعال با تجهیزات اصل و دستگاه‌های تأیید‌شده.${priceBit} رزرو مشاوره رایگان.`)
    : count === 0
      ? `راهنمای ${service.name} در ${city}. معیارهای انتخاب مرکز معتبر، نکات هزینه و مشاوره رایگان با سلام دکتر.`
      : `لیست کلینیک‌های ${service.name} در ${city}. مقایسه مراکز معتبر + مشاوره رایگان با سلام دکتر.`;

  const title = overrides.title || db.metaTitle || defaultTitle;
  const description = overrides.description || db.metaDescription || defaultDescription;
  const h1Title = overrides.h1 || db.h1Title || defaultH1;

  const seoDescriptionHtml = sanitizeHubSeoHtml(
    overrides.seoDescription || db.seoDescription || ''
  );

  return {
    title,
    description,
    h1Title,
    canonical,
    seoDescriptionHtml,
    hubMode: listMode ? 'list' : 'guide',
    listedClinicCount: count,
  };
}

/**
 * SEO payload for city hub pages (/shiraz).
 */
function buildCityHubSeo(data, overrides = {}) {
  const city = (data && data.city) || 'شیراز';
  const citySlug = (data && data.citySlug) || 'shiraz';
  const canonical = absoluteUrl((data && data.canonicalPath) || `/${citySlug}`);
  const title =
    overrides.title ||
    `مراکز پزشکی و کلینیک‌های زیبایی ${city} | سلام دکتر`;
  const description =
    overrides.description ||
    `فهرست خدمات پزشکی و زیبایی در ${city}؛ کاشت مو، بوتاکس، لیزر، جوانسازی پوست و سایر تخصص‌ها. معرفی مراکز فعال و مشاوره رایگان سلام دکتر.`;
  const h1Title = overrides.h1 || `مراکز پزشکی و کلینیک‌های زیبایی ${city}`;

  const crumbs = buildCityHubBreadcrumbs({
    city,
    citySlug,
    cityInfo: data && data.cityInfo,
    canonicalPath: data && data.canonicalPath,
  });

  const headHtml = buildSeoTagsHtml({
    title,
    description,
    canonical,
    ogImage: overrides.ogImage || DEFAULT_OG,
    jsonLd: crumbs.jsonLd,
  });

  return {
    title,
    h1Title,
    description,
    canonical,
    ogImage: overrides.ogImage || DEFAULT_OG,
    breadcrumbHtml: crumbs.html,
    breadcrumbItems: crumbs.items,
    headHtml,
    jsonLd: JSON.stringify(crumbs.jsonLd),
  };
}

/**
 * Full SEO payload for EJS templates or JSON API / vanilla JS injection.
 * @returns {{ title, h1Title, description, canonical, ogImage, jsonLd, headHtml, faq, jsonLdObject, seoDescriptionHtml }}
 */
function buildLocalHubSeo(data, overrides = {}) {
  const meta = buildLocalHubSeoMeta(data, overrides);
  const ogImage = overrides.ogImage || DEFAULT_OG;
  const jsonLdObject = buildLocalHubJsonLd(
    data,
    meta.canonical,
    overrides.faqs,
    meta.h1Title
  );
  const jsonLd = JSON.stringify(jsonLdObject);
  const faqEntity = jsonLdObject['@graph'].find((n) => n && n['@type'] === 'FAQPage');
  const faq = faqEntity
    ? faqEntity.mainEntity.map((q) => ({ q: q.name, a: q.acceptedAnswer.text }))
    : [];

  const crumbs = buildLocalHubBreadcrumbs({
    city: data.city,
    cityInfo: data.cityInfo,
    citySlug: data.citySlug || (data.cityInfo && data.cityInfo.slug),
    service: data.service,
    canonicalPath: meta.canonical,
  });

  const headHtml = buildSeoTagsHtml({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    ogImage,
    jsonLd: jsonLdObject,
  });

  return {
    title: meta.title,
    h1Title: meta.h1Title,
    description: meta.description,
    canonical: meta.canonical,
    ogImage,
    jsonLd,
    jsonLdObject,
    headHtml,
    faq,
    seoDescriptionHtml: meta.seoDescriptionHtml || '',
    breadcrumbHtml: crumbs.html,
    breadcrumbItems: crumbs.items,
    hubMode: meta.hubMode,
    listedClinicCount: meta.listedClinicCount,
  };
}

function clinicProfilePath(clinicId) {
  return clinicSlug.clinicProfilePath(clinicId);
}

function categoryBreadcrumbs(category) {
  return breadcrumbList([
    { name: 'خانه', url: '/' },
    { name: 'خدمات', url: '/category.html' },
    {
      name: category.name,
      url: `/${category.file}`,
    },
  ]);
}

function serviceBreadcrumbs(meta) {
  return breadcrumbList([
    { name: 'خانه', url: '/' },
    { name: 'خدمات', url: '/category.html' },
    {
      name: meta.label || meta.title,
      url: `/services/${meta.slug}`,
    },
  ]);
}

/**
 * Profile BreadcrumbList: Home > City > Doctor/Clinic
 * @param {object} clinic
 * @param {{ city?: string, specialty?: string, profileUrl?: string }=} opts
 */
function clinicBreadcrumbs(clinic, opts) {
  const options = opts || {};
  const built = buildProfileBreadcrumbs({
    clinic,
    clinicId: clinic && clinic.id,
    name: (clinic && (clinic.name || clinic.sliderTitle)) || options.name,
    city: options.city || (clinic && (clinic.city || clinic.cityFa)),
    citySlug: options.citySlug || (clinic && clinic.citySlug),
    specialty:
      options.specialty ||
      (clinic && (clinic.medicalSpecialty || clinic.specialty)),
    profileUrl: options.profileUrl || (clinic && clinic.url),
  });
  return built.jsonLd;
}

/** Visible + JSON-LD breadcrumb payload for /doctor/:slug profiles */
function buildClinicBreadcrumbPayload(clinic, opts) {
  return buildProfileBreadcrumbs(
    Object.assign(
      {
        clinic,
        clinicId: clinic && clinic.id,
        name: clinic && (clinic.name || clinic.sliderTitle),
      },
      opts || {}
    )
  );
}

function urlsetXml(entries) {
  const body = (entries || [])
    .map((e) => {
      const lines = ['  <url>', `    <loc>${xmlEscape(e.loc)}</loc>`];
      if (e.lastmod) lines.push(`    <lastmod>${xmlEscape(e.lastmod)}</lastmod>`);
      if (e.changefreq) {
        lines.push(`    <changefreq>${xmlEscape(e.changefreq)}</changefreq>`);
      }
      if (e.priority) lines.push(`    <priority>${xmlEscape(e.priority)}</priority>`);
      lines.push('  </url>');
      return lines.join('\n');
    })
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    body +
    '\n</urlset>\n'
  );
}

function normalizeSitemapSlug(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^(?:\/+)?services\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/[^\w\u0600-\u06FF-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Collect a distinct set of /services/:slug values from every available source.
 */
async function collectUniqueServiceSlugs(deps) {
  const slugs = new Set();
  const addSlug = (raw) => {
    const canonical = resolveCanonicalEnglishSlug(raw);
    if (!canonical || !isEnglishServiceSlug(canonical)) return;
    slugs.add(canonical);
  };

  // 1) Curated brand/service landings only (canonical English keys)
  const landings = deps.serviceLandings || {};
  Object.keys(landings).forEach(addSlug);

  // 2) Catalog clinics (data.min.js) — structured {slug} or English mapping of label
  const clinics = typeof deps.loadClinicsData === 'function' ? deps.loadClinicsData() : [];
  for (const clinic of clinics) {
    const services = Array.isArray(clinic && clinic.services) ? clinic.services : [];
    for (const item of services) {
      if (item == null) continue;
      if (typeof item === 'string') {
        addSlug(item);
        continue;
      }
      if (typeof item === 'object') {
        if (item.slug) addSlug(item.slug);
        else if (item.url && String(item.url).includes('/services/')) {
          addSlug(String(item.url).split('/services/')[1]);
        } else if (item.label || item.name) {
          addSlug(item.label || item.name);
        }
      }
    }
  }

  // 3) SQLite clinic_profiles.services_json overlay
  if (typeof deps.loadSqliteServiceSlugs === 'function') {
    try {
      const rows = deps.loadSqliteServiceSlugs() || [];
      rows.forEach(addSlug);
    } catch (err) {
      console.warn('[seo] sqlite service slugs skipped:', (err && err.message) || err);
    }
  }

  // 4) PostgreSQL distinct service slugs (+ device brands when available)
  if (typeof deps.loadPostgresServiceSlugs === 'function') {
    try {
      const rows = await deps.loadPostgresServiceSlugs();
      (rows || []).forEach(addSlug);
    } catch (err) {
      console.warn('[seo] postgres service slugs skipped:', (err && err.message) || err);
    }
  }

  return Array.from(slugs).sort();
}

/** Hubs that 301 elsewhere — never list in pages sitemap. */
const SITEMAP_EXCLUDED_HUB_SLUGS = new Set([
  'body-contouring', // → /shiraz/slimming
  'light-therapy', // → /shiraz/skin-rejuvenation
  'dental-implant', // → /shiraz/dentistry
  'dental-veneer', // → /shiraz/dentistry
  'orthodontics', // → /shiraz/dentistry
  'co2-laser', // → /shiraz/co2-fractional-laser
]);

/** Extra /shiraz/* required in pages sitemap but not always in HUB_SLUGS. */
const SITEMAP_EXTRA_HUB_SLUGS = [];

/**
 * Pages-only sitemap entries (NO articles, NO /services/*).
 * Mirrors scripts/generate-sitemap.js allowlist — articles live in sitemap-articles.xml.
 * Doctor profiles: ACTIVE clinics only, canonical /doctor/:clean-slug, with <lastmod>.
 */
async function collectSitemapEntries(deps) {
  const {
    loadClinicsData,
    hubSlugs,
    tryLoadPrismaUrls,
  } = deps;
  const today = todayIsoDate();
  const seen = new Set();
  const entries = [];

  const add = (pathname, lastmod, priority, changefreq) => {
    let p = String(pathname || '/').trim();
    if (!p.startsWith('/')) p = '/' + p;
    if (p.length > 1) p = p.replace(/\/+$/, '');

    // Never list articles, /services/*, redirects, or dirty doctor slugs.
    if (p.startsWith('/articles/')) return;
    if (p.startsWith('/services/')) return;
    if (
      p === '/laser-hair.html' ||
      p === '/cosmetic-surgery.html' ||
      p === '/hair-transplant.html' ||
      p === '/skin-rejuvenation.html' ||
      p === '/injection.html' ||
      p === '/slimming.html' ||
      p === '/rhinoplasty.html' ||
      p === '/lasik.html' ||
      p === '/femto-lasik.html' ||
      p === '/prk.html' ||
      p === '/pharmacy.html' ||
      p === '/shiraz/co2-laser' ||
      p === '/index.html' ||
      p === '/search'
    ) {
      return;
    }
    if (/profile\.html/i.test(p) || /[?&]id=/i.test(p)) return;
    if (p.startsWith('/doctor/')) {
      const slug = p.slice('/doctor/'.length);
      if (!clinicSlug.isCleanCanonicalSlug(slug) || /^\d+$/.test(slug)) return;
    }
    if (p.startsWith('/shiraz/')) {
      const hub = p.slice('/shiraz/'.length).split('/')[0];
      if (SITEMAP_EXCLUDED_HUB_SLUGS.has(hub)) return;
    }

    const loc = SITE_BASE + p;
    if (seen.has(loc)) return;
    seen.add(loc);
    const entry = {
      loc,
      lastmod: fmtDate(lastmod) || today,
      priority: priority || '0.7',
    };
    if (changefreq) entry.changefreq = changefreq;
    entries.push(entry);
  };

  // Core + static category hubs (allowlist; laser-hair.html excluded above).
  add('/', today, '1.0', 'daily');
  add('/about.html', today, '0.6', 'monthly');
  add('/articles.html', today, '0.7', 'weekly');
  add('/faq.html', today, '0.5', 'monthly');
  add('/contact.html', today, '0.6', 'monthly');
  add('/clinic-promote.html', today, '0.7', 'weekly');
  add('/category.html', today, '0.6', 'weekly');
  add('/products.html', today, '0.6', 'weekly');
  add('/shiraz', today, '0.9', 'daily');

  // Active doctors — catalog (fallback when Prisma is empty / unavailable).
  const clinics = typeof loadClinicsData === 'function' ? loadClinicsData() : [];
  try {
    clinicSlug.registerClinics(clinics);
  } catch (_err) {
    /* optional */
  }
  for (const clinic of clinics) {
    if (!clinic || clinic.id == null) continue;
    if (!clinic.name && !clinic.sliderTitle) continue;
    if (clinic.active === false || clinic.isActive === false) continue;
    if (
      clinic.contractStatus &&
      String(clinic.contractStatus).toUpperCase() !== 'ACTIVE'
    ) {
      continue;
    }
    const slug = clinicSlug.slugForClinic(clinic);
    if (!clinicSlug.isCleanCanonicalSlug(slug)) continue;
    add(`/doctor/${slug}`, today, '0.6', 'weekly');
  }

  // Prisma: doctors + /shiraz hubs only (skip /services/* and other city landings).
  if (typeof tryLoadPrismaUrls === 'function') {
    try {
      const extra = await tryLoadPrismaUrls();
      for (const row of extra || []) {
        if (!row || !row.path) continue;
        const p = String(row.path);
        if (p.startsWith('/services/') || p.startsWith('/articles/')) continue;
        if (p.startsWith('/doctor/')) {
          add(p, row.lastmod || today, row.priority || '0.6', row.changefreq || 'weekly');
          continue;
        }
        if (p.startsWith('/shiraz/')) {
          add(p, row.lastmod || today, row.priority || '0.8', row.changefreq || 'weekly');
        }
      }
    } catch (err) {
      console.warn('[seo] prisma sitemap merge skipped:', (err && err.message) || err);
    }
  }

  // Curated /shiraz/:slug hubs (soft-404 landings + catalog leaves + extras).
  const hubSet = new Set();
  if (Array.isArray(hubSlugs)) {
    for (const slug of hubSlugs) {
      if (slug) hubSet.add(String(slug).toLowerCase());
    }
  }
  for (const slug of SITEMAP_EXTRA_HUB_SLUGS) hubSet.add(slug);
  for (const excluded of SITEMAP_EXCLUDED_HUB_SLUGS) hubSet.delete(excluded);
  for (const slug of Array.from(hubSet).sort()) {
    add('/shiraz/' + slug, today, '0.8', 'weekly');
  }

  add('/doctor/nahal-clinic', today, '0.6', 'weekly');

  entries.sort((a, b) => a.loc.localeCompare(b.loc));
  return entries;
}

function createSeoInfraHandlers(deps) {
  const fs = require('fs');
  const path = require('path');
  const { CATEGORY_DEFS } = (() => {
    try {
      return require('./categoryMonetize');
    } catch (_err) {
      return { CATEGORY_DEFS: [] };
    }
  })();

  const categoryById = new Map(
    (CATEGORY_DEFS || []).map((c) => [c.id, c])
  );
  // Also map from CATEGORY_PAGES (file-based names)
  for (const c of CATEGORY_PAGES) {
    if (!categoryById.has(c.id)) categoryById.set(c.id, { id: c.id, label: c.name });
  }

  function handleCategoryLandingFile(fileName, res) {
    const cat = CATEGORY_BY_FILE.get(fileName);
    const filePath = path.join(deps.rootDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.error('[seo] category HTML missing in backend root:', filePath);
      deps.sendText(res, 404, 'Not Found');
      return;
    }
    let html = fs.readFileSync(filePath, 'utf8');
    if (cat) {
      const seo = categorySeo(cat.name, fileName);
      const canonical = `${SITE_BASE}/${cat.file}`;
      const categoryEntity = {
        '@context': 'https://schema.org',
        '@type': 'MedicalBusiness',
        name: seo.h1 || `سلام دکتر - ${cat.name}`,
        description: seo.description,
        url: canonical,
        image: DEFAULT_OG,
        telephone: '+989007000462',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'شیراز',
          addressCountry: 'IR',
        },
      };
      html = injectHeadSeo(html, {
        title: seo.title,
        description: seo.description,
        canonical,
        ogImage: DEFAULT_OG,
        jsonLd: [categoryBreadcrumbs(cat), categoryEntity],
      });
      if (seo.h1) {
        html = html.replace(
          /(<h1[^>]*data-hero-title[^>]*>)([\s\S]*?)(<\/h1>)/i,
          `$1${seo.h1}$3`
        );
        html = html.replace(
          /(<h1(?![^>]*data-hero-title)[^>]*>)([\s\S]*?)(<\/h1>)/i,
          (m, open, _body, close) => {
            if (/data-hero-title/i.test(open)) return m;
            return `${open}${seo.h1}${close}`;
          }
        );
      }
      // Keep embedded MedicalBusiness blocks in sync with Title A (name/description/url).
      html = html.replace(
        /<script type="application\/ld\+json">\s*\{[\s\S]*?"@type"\s*:\s*"MedicalBusiness"[\s\S]*?\}\s*<\/script>/i,
        `<script type="application/ld+json">\n${JSON.stringify(categoryEntity, null, 2)}\n  </script>`
      );
    }
    deps.sendHtml(res, 200, html);
  }

  function handleCategoryHub(req, res) {
    const filePath = path.join(deps.rootDir, 'category.html');
    if (!fs.existsSync(filePath)) {
      deps.sendText(res, 404, 'Not Found');
      return;
    }
    let html = fs.readFileSync(filePath, 'utf8');
    const type = String(
      (deps.getSearchParams ? deps.getSearchParams(req.url).get('type') : '') || ''
    )
      .trim()
      .toLowerCase();
    const def = type ? categoryById.get(type) : null;
    const name = (def && (def.label || def.name)) || 'زیبایی و درمان';
    const seo = categorySeo(name);
    const canonical = type
      ? `${SITE_BASE}/category.html?type=${encodeURIComponent(type)}`
      : `${SITE_BASE}/category.html`;
    const crumbs = breadcrumbList([
      { name: 'خانه', url: '/' },
      { name: 'خدمات', url: '/category.html' },
      ...(def
        ? [{ name, url: `/category.html?type=${encodeURIComponent(type)}` }]
        : []),
    ]);
    html = injectHeadSeo(html, {
      title: seo.title,
      description: seo.description,
      canonical,
      ogImage: DEFAULT_OG,
      jsonLd: [crumbs],
    });
    deps.sendHtml(res, 200, html);
  }

  async function handleSitemap(res, method) {
    try {
      const entries = await collectSitemapEntries({
        loadClinicsData: deps.loadClinicsData,
        serviceLandings: deps.serviceLandings,
        hubSlugs: deps.hubSlugs,
        tryLoadPrismaUrls: deps.tryLoadPrismaUrls,
        loadUniqueServiceSlugs: deps.loadUniqueServiceSlugs,
        loadSqliteServiceSlugs: deps.loadSqliteServiceSlugs,
        loadPostgresServiceSlugs: deps.loadPostgresServiceSlugs,
      });
      const xml = urlsetXml(entries);
      const body = Buffer.from(xml, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'public, max-age=3600',
      });
      if (method !== 'HEAD') res.end(body);
      else res.end();
    } catch (err) {
      console.error('[seo] sitemap failed:', err);
      deps.sendText(res, 500, 'Failed to build sitemap');
    }
  }

  function tryHandle(req, res, pathname, method) {
    if ((method === 'GET' || method === 'HEAD') && pathname === '/sitemap.xml') {
      return handleSitemap(res, method).then(() => true);
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/category.html') {
      handleCategoryHub(req, res);
      return Promise.resolve(true);
    }

    // Dedicated category landing HTML with injected SEO
    const file = pathname.replace(/^\//, '');
    if (
      (method === 'GET' || method === 'HEAD') &&
      CATEGORY_BY_FILE.has(file)
    ) {
      handleCategoryLandingFile(file, res);
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  return {
    tryHandle,
    handleCategoryPage: handleCategoryLandingFile,
    handleCategoryHub,
    handleSitemap,
    injectHeadSeo,
    buildSeoTagsHtml,
    categorySeo,
    serviceSeo,
    clinicSeo,
    formatLocalBookingHeadline,
    resolveClinicLocalSeoModifiers,
    medicalClinicSchema,
    categoryBreadcrumbs,
    serviceBreadcrumbs,
  clinicBreadcrumbs,
  buildClinicBreadcrumbPayload,
  CATEGORY_PAGES,
  CATEGORY_BY_FILE,
  };
}

module.exports = {
  SITE_BASE,
  DEFAULT_OG,
  SEO_PLACEHOLDER,
  CATEGORY_PAGES,
  CATEGORY_BY_FILE,
  escapeHtmlAttr,
  buildSeoTagsHtml,
  injectHeadSeo,
  categorySeo,
  serviceSeo,
  clinicSeo,
  formatLocalBookingHeadline,
  resolveClinicLocalSeoModifiers,
  organizationSchema,
  websiteSchema,
  medicalClinicSchema,
  buildMedicalEntityJsonLd,
  buildFaqPageJsonLd,
  directoryClinicMedicalClinicSchema,
  localHubMedicalClinicEntity,
  buildLocalHubDoctorItemList,
  buildLocalHubJsonLd,
  buildLocalHubSeoMeta,
  buildLocalHubSeo,
  buildCityHubSeo,
  hubListedClinicCount,
  isHubListMode,
  HUB_LIST_MIN_CLINICS,
  sanitizeHubSeoHtml,
  formatTomanFa,
  breadcrumbList,
  breadcrumbListJsonLd,
  breadcrumbNavHtml,
  buildProfileBreadcrumbs,
  buildLocalHubBreadcrumbs,
  buildCityHubBreadcrumbs,
  buildClinicBreadcrumbPayload,
  categoryBreadcrumbs,
  serviceBreadcrumbs,
  clinicBreadcrumbs,
  collectSitemapEntries,
  urlsetXml,
  createSeoInfraHandlers,
  absoluteUrl,
  absoluteImage,
  clinicProfilePath,
};
