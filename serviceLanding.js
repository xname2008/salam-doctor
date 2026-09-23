/**
 * Dynamic /services/:slug landing pages.
 * Canonical routes are English-only (e.g. /services/qswitch).
 * Note: /shiraz/botox 301 → /shiraz/botox (see server.js consolidation).
 * Persian / alias slugs 301 via Express middleware (serviceSlugMap).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { clinicProfilePath } = require('./clinicSlug');
const { sanitizeHubClinicList, isHubListableClinic } = require('./hubClinicSanitize');
const {
  CANONICAL_SERVICE_SLUGS,
  decodeSlug,
  isEnglishServiceSlug,
  persianLabelSlug,
  registerAlias,
  resolveCanonicalEnglishSlug,
  needsServiceSlugRedirect,
  canonicalServicePath,
  canonicalServiceUrl,
  englishSlugFromLabel,
  slugsReferToSameService,
  serviceSlugRedirectMiddleware,
} = require('./serviceSlugMap');
const { buildFaqPageJsonLd } = require('./faqPageJsonLd');

/** Parent category → keyword hints for related-clinic fallback (Shiraz). */
const PARENT_CATEGORY_HINTS = {
  'skin-aesthetic': {
    badge: 'سایر کلینیک‌های معتبر پوست و زیبایی شیراز',
    keywords: ['پوست', 'زیبایی', 'جوانسازی', 'لیزر', 'فیشیال', 'درماتولوژی', 'نور', 'لایت', 'skin', 'laser'],
  },
};

/** Curated copy for known brands / methods — keys MUST be English ASCII. */
const SERVICE_LANDINGS = {
  'deka-laser': {
    label: 'DEKA',
    title: 'مراکز لیزر DEKA در شیراز',
    description:
      'کلینیک‌ها و مراکز زیبایی شیراز که خدمات لیزر با دستگاه‌های DEKA ارائه می‌دهند. برای مشاوره رایگان و انتخاب مرکز مناسب با سلام دکتر در ارتباط باشید.',
  },
  'candela-laser': {
    label: 'CANDELA',
    title: 'مراکز لیزر CANDELA در شیراز',
    description:
      'معرفی مراکز دارای دستگاه کندلا (Candela) برای لیزر موهای زائد و خدمات پوست در شیراز، با امکان مقایسه و درخواست مشاوره.',
  },
  'co2-laser': {
    label: 'لیزر CO2',
    title: 'مراکز لیزر CO2 در شیراز',
    description:
      'فهرست مراکز شیراز که لیزر CO2 برای درمان ضایعات پوستی، خال، زگیل و جوان‌سازی ارائه می‌کنند.',
  },
  'fotona-laser': {
    label: 'لیزر فوتونا',
    title: 'مراکز لیزر فوتونا (Fotona) در شیراز',
    description:
      'مراکز مجهز به لیزر فوتونا برای جوان‌سازی، درمان جای جوش و خدمات پوستی تخصصی در شیراز.',
  },
  qswitch: {
    label: 'لیزر کیوسوئیچ',
    title: 'مراکز لیزر کیوسوئیچ در شیراز',
    description:
      'کلینیک‌های ارائه‌دهنده لیزر کیوسوئیچ برای پاک کردن تتو، لک و درمان‌های پوستی مرتبط در شیراز.',
  },
  'hair-transplant-fit': {
    label: 'کاشت مو FIT',
    title: 'مراکز کاشت مو به روش FIT در شیراز',
    description:
      'معرفی مراکز کاشت مو با روش FIT و میکروگرافت در شیراز برای انتخاب آگاهانه و مشاوره تخصصی.',
  },
  'botox-filler': {
    label: 'بوتاکس و فیلر',
    title: 'مراکز بوتاکس و فیلر در شیراز',
    description:
      'فهرست مراکز معتبر تزریق بوتاکس و فیلر در شیراز با امکان مشاهده پروفایل و درخواست مشاوره.',
  },
  botox: {
    label: 'بوتاکس',
    title: 'بهترین مراکز تزریق بوتاکس در شیراز | قیمت و نوبت‌دهی | سلام دکتر',
    h1: 'بهترین مراکز تزریق بوتاکس در شیراز',
    description:
      'لیست کلینیک‌های تزریق بوتاکس در شیراز. مقایسه مراکز معتبر + مشاوره رایگان با سلام دکتر.',
  },
  'eyebrow-beard-transplant': {
    label: 'کاشت ابرو و ریش',
    title: 'مراکز کاشت ابرو و ریش در شیراز',
    description:
      'مراکز تخصصی کاشت ابرو و ریش در شیراز با معرفی خدمات و امکان تماس برای مشاوره.',
  },
  'rf-virtue-endolift': {
    label: 'RF VIRTUE و اندولیفت',
    title: 'مراکز RF VIRTUE و اندولیفت در شیراز',
    description:
      'کلینیک‌های ارائه‌دهنده لیزر RF VIRTUE و اندولیفت برای لیفت و جوان‌سازی در شیراز.',
  },
  'hifu-doublo-gold': {
    label: 'هایفو دابلو گلد',
    title: 'مراکز هایفو دابلو گلد در شیراز',
    description:
      'معرفی مراکز دارای دستگاه هایفو دابلو گلد برای لیفت غیرجراحی در شیراز.',
  },
  'light-therapy': {
    label: 'نور درمانی',
    title: 'لایت تراپی و نور درمانی در شیراز | بهترین کلینیک‌ها | سلام دکتر',
    description:
      'لیست کلینیک‌های لایت تراپی و نور درمانی در شیراز برای جوانسازی، لک و التهاب پوست. مقایسه مراکز معتبر + مشاوره رایگان با سلام دکتر.',
    parentCategory: 'skin-aesthetic',
    intro:
      'نور درمانی (لایت تراپی) روشی غیرتهاجمی برای بهبود بافت پوست، کاهش التهاب و کمک به درمان برخی لک‌هاست. در شیراز معمولاً در کلینیک‌های پوست و زیبایی انجام می‌شود و انتخاب دستگاه و پروتکل درمانی بر اساس نوع پوست و هدف درمان تعیین می‌گردد.',
  },
};

// Register Persian label slugs + keep curated set in sync.
for (const [slug, meta] of Object.entries(SERVICE_LANDINGS)) {
  CANONICAL_SERVICE_SLUGS.add(slug);
  if (meta && meta.label) registerAlias(persianLabelSlug(meta.label), slug);
}
registerAlias('نور درمانی', 'light-therapy');
registerAlias('نور-درمانی', 'light-therapy');
registerAlias('لایت تراپی', 'light-therapy');

function toAbsoluteAssetPath(src) {
  const raw = String(src || '').trim();
  if (!raw) return '/images/sample-clinic-services.webp';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith('//')) return raw;
  return raw.charAt(0) === '/' ? raw : '/' + raw.replace(/^\/+/, '');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value) {
  return englishSlugFromLabel(value) || decodeSlug(value).slice(0, 80);
}

function normalizeSlug(raw) {
  return resolveCanonicalEnglishSlug(raw);
}

function titleFromSlug(slug) {
  const words = String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.toUpperCase());
  const label = words.join(' ') || slug;
  return {
    label,
    title: `مراکز ${label} در شیراز`,
    description: `فهرست مراکز درمانی و زیبایی شیراز مرتبط با «${label}». برای مشاوره رایگان با سلام دکتر تماس بگیرید.`,
  };
}

function resolveServiceMeta(slug) {
  const key = normalizeSlug(slug);
  if (!key || !isEnglishServiceSlug(key) || !CANONICAL_SERVICE_SLUGS.has(key)) return null;
  const known = SERVICE_LANDINGS[key];
  if (known) return { slug: key, ...known };
  return { slug: key, ...titleFromSlug(key) };
}

function clinicServicesList(clinic, overlayServices) {
  if (Array.isArray(overlayServices) && overlayServices.length) {
    return overlayServices;
  }
  return Array.isArray(clinic.services) ? clinic.services : [];
}

function serviceMatchesSlug(item, slug) {
  const key = normalizeSlug(slug) || decodeSlug(slug);
  if (!key || item == null) return false;
  if (typeof item === 'string') {
    const label = item.trim();
    if (!label || label === 'دارد') return false;
    const itemKey = englishSlugFromLabel(label) || slugify(label);
    if (slugsReferToSameService(itemKey, key)) return true;
    return (
      label.toLowerCase().includes(key.replace(/-/g, ' ')) ||
      key.split('-').every((part) => part && label.toLowerCase().includes(part))
    );
  }
  if (typeof item !== 'object') return false;
  const itemSlug = String(item.slug || '').trim();
  if (itemSlug && slugsReferToSameService(itemSlug, key)) return true;
  const url = String(item.url || '');
  const urlMatch = url.match(/\/services\/([^/?#]+)/i);
  if (urlMatch && slugsReferToSameService(urlMatch[1], key)) return true;
  const label = String(item.label || item.name || '').trim();
  if (!label) return false;
  return slugsReferToSameService(englishSlugFromLabel(label) || slugify(label), key);
}

function serviceItemLabel(item) {
  if (item == null) return '';
  if (typeof item === 'string') {
    const label = item.trim();
    return !label || label === 'دارد' ? '' : label;
  }
  if (typeof item !== 'object') return '';
  return String(item.label || item.name || '').trim();
}

/** Only tags that belong to the current landing slug (never other services). */
function filterServicesForLanding(services, slug) {
  const key = normalizeSlug(slug);
  if (!key || !Array.isArray(services)) return [];
  const seen = new Set();
  const out = [];
  for (const item of services) {
    if (!serviceMatchesSlug(item, key)) continue;
    const label = serviceItemLabel(item);
    if (!label) continue;
    const dedupe = label.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(label);
  }
  return out;
}

function renderServiceTagsHtml(tags) {
  if (!Array.isArray(tags) || !tags.length) return '';
  return (
    `<ul class="premium-clinic-services" aria-label="خدمات مرتبط با این صفحه">` +
    tags
      .map(
        (label) =>
          `<li><span>${escapeHtml(label)}</span></li>`
      )
      .join('') +
    `</ul>`
  );
}

function buildServiceFaqItems(meta) {
  const label = String((meta && meta.label) || 'این خدمت').trim() || 'این خدمت';
  return [
    {
      q: `${label} برای چه مشکلات پوستی مناسب است؟`,
      a: `${label} بسته به نوع دستگاه و پروتکل درمانی می‌تواند در بهبود بافت پوست، کاهش التهاب و کمک به درمان برخی لک‌ها نقش داشته باشد. تشخیص نهایی پس از معاینه پوست توسط پزشک یا متخصص پوست انجام می‌شود.`,
    },
    {
      q: `کدام مراکز ${label} را ارائه می‌دهند؟`,
      a: `در همین صفحه فهرست مراکز مرتبط با «${label}» یا دسته پوست و زیبایی را می‌بینید. برای جزئیات، آدرس و راه‌های ارتباطی روی هر مرکز کلیک کنید یا از دکمه مشاوره رایگان استفاده کنید.`,
    },
    {
      q: `چطور مرکز مناسب برای ${label} را انتخاب کنیم؟`,
      a: `مجوز رسمی، تجربه تیم درمانی، شفافیت هزینه و تطابق دستگاه با نیاز شما را بررسی کنید. کارشناسان سلام دکتر می‌توانند چند گزینه معتبر پیشنهاد دهند.`,
    },
    {
      q: `برای مشاوره درباره ${label} چه کنیم؟`,
      a: `از طریق پشتیبانی سایت با سلام دکتر تماس بگیرید تا بر اساس نیازتان مرکز مناسب معرفی شود.`,
    },
  ];
}

function buildServiceFaqHtml(meta) {
  return buildServiceFaqItems(meta)
    .map(
      (item) =>
        `<details>` +
        `<summary>${escapeHtml(item.q)}</summary>` +
        `<p>${escapeHtml(item.a)}</p>` +
        `</details>`
    )
    .join('');
}

function findClinicsByServiceSlug(slug, deps) {
  const { loadClinicsData, openDb, normalizeServicesMeta } = deps;
  const key = normalizeSlug(slug);
  if (!key) return [];

  const overlayById = new Map();
  const db = openDb();
  try {
    const rows = db
      .prepare(
        'SELECT clinic_id, services_json FROM clinic_profiles WHERE services_json IS NOT NULL'
      )
      .all();
    for (const row of rows) {
      const services = normalizeServicesMeta(row.services_json);
      if (services.length) overlayById.set(Number(row.clinic_id), services);
    }
  } finally {
    db.close();
  }

  const clinics = loadClinicsData();
  const matched = [];
  for (const clinic of clinics) {
    if (!clinic || clinic.id == null) continue;
    const services = clinicServicesList(
      clinic,
      overlayById.get(Number(clinic.id))
    );
    const pageTags = filterServicesForLanding(services, key);
    if (!pageTags.length) continue;
    matched.push({
      id: Number(clinic.id),
      name: clinic.name || clinic.sliderTitle || `مرکز ${clinic.id}`,
      tagline: clinic.sliderTagline || clinic.address || '',
      image: toAbsoluteAssetPath(clinic.image || 'images/sample-clinic-services.webp'),
      address: clinic.address || '',
      link: clinicProfilePath(clinic),
      services: pageTags,
    });
  }

  matched.sort((a, b) => {
    if (a.id === 114) return -1;
    if (b.id === 114) return 1;
    return String(a.name).localeCompare(String(b.name), 'fa');
  });
  return matched;
}

function clinicHaystack(clinic) {
  const parts = [
    clinic.name,
    clinic.sliderTitle,
    clinic.sliderTagline,
    clinic.address,
    clinic.medicalSpecialty,
    clinic.specialty,
  ];
  if (Array.isArray(clinic.services)) {
    for (const s of clinic.services) {
      if (typeof s === 'string') parts.push(s);
      else if (s && typeof s === 'object') {
        parts.push(s.label, s.name, s.slug);
      }
    }
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function findRelatedClinicsByCategory(meta, deps, excludeIds) {
  const category = PARENT_CATEGORY_HINTS[meta && meta.parentCategory];
  if (!category) return { clinics: [], badge: '' };

  const exclude = new Set((excludeIds || []).map(Number));
  const keywords = category.keywords.map((k) => k.toLowerCase());
  const clinics = loadClinicsDataViaDeps(deps);
  const matched = [];

  for (const clinic of clinics) {
    if (!clinic || clinic.id == null || exclude.has(Number(clinic.id))) continue;
    if (!isHubListableClinic({
      ...clinic,
      profileUrl: clinic.link || clinicProfilePath(clinic),
      link: clinic.link || clinicProfilePath(clinic),
    })) continue;
    const haystack = clinicHaystack(clinic);
    if (!keywords.some((kw) => haystack.includes(kw))) continue;
    matched.push({
      id: Number(clinic.id),
      name: clinic.name || clinic.sliderTitle || `مرکز ${clinic.id}`,
      tagline: clinic.sliderTagline || clinic.address || '',
      image: toAbsoluteAssetPath(clinic.image || 'images/sample-clinic-services.webp'),
      address: clinic.address || '',
      link: clinicProfilePath(clinic),
      services: [],
    });
  }

  matched.sort((a, b) => {
    if (a.id === 114) return -1;
    if (b.id === 114) return 1;
    return String(a.name).localeCompare(String(b.name), 'fa');
  });

  return { clinics: sanitizeHubClinicList(matched.slice(0, 4)), badge: category.badge };
}

function loadClinicsDataViaDeps(deps) {
  if (deps && typeof deps.loadClinicsData === 'function') {
    return deps.loadClinicsData();
  }
  return [];
}

function renderIntroHtml(meta) {
  const intro = String((meta && meta.intro) || '').trim();
  if (!intro) return '';
  return `<section class="service-intro-wrap" aria-labelledby="service-intro-heading">` +
    `<h2 id="service-intro-heading" class="service-list-heading">درباره ${escapeHtml(meta.label)}</h2>` +
    `<p class="service-intro-text">${escapeHtml(intro)}</p>` +
    `</section>`;
}

function renderOnboardingCtaHtml() {
  return (
    `<aside class="service-onboard-cta" aria-labelledby="service-onboard-heading">` +
    `<div>` +
    `<h2 id="service-onboard-heading" class="service-onboard-title">پزشک یا مدیر کلینیک هستید؟</h2>` +
    `<p class="service-onboard-text">ثبت اطلاعات در سلام دکتر و معرفی مرکز خود به مراجعان جستجوگر.</p>` +
    `</div>` +
    `<a class="btn btn-main" href="/clinic-promote.html">ثبت اطلاعات در سلام دکتر</a>` +
    `</aside>`
  );
}

function renderRelatedClinicsSection(related, badge) {
  if (!related || !related.length) return '';
  return (
    `<section class="service-related-wrap" aria-labelledby="service-related-heading">` +
    `<span class="service-related-badge">${escapeHtml(badge)}</span>` +
    `<h2 id="service-related-heading" class="service-list-heading">مراکز مرتبط</h2>` +
    renderClinicCards(related) +
    `</section>`
  );
}

function renderClinicCards(clinics, opts) {
  const options = opts || {};
  if (!clinics.length) {
    if (options.suppressEmpty) return '';
    return `<div class="category-empty-wrap"><p class="category-empty">در حال حاضر مرکزی با این خدمت ثبت نشده است. مراکز مرتبط پوست و زیبایی در بخش پایین معرفی شده‌اند.</p></div>`;
  }
  return (
    `<ul class="premium-clinic-stack" role="list">` +
    clinics
      .map((c, index) => {
        const rank = index + 1;
        return (
          `<li class="premium-clinic-item">` +
          `<a class="premium-clinic-row" href="${escapeHtml(c.link)}">` +
          `<div class="premium-clinic-media">` +
          `<img class="premium-clinic-image" src="${escapeHtml(toAbsoluteAssetPath(c.image))}" alt="${escapeHtml(c.name)}" loading="lazy" width="420" height="280">` +
          `<span class="premium-clinic-rank" aria-hidden="true">${rank}</span>` +
          `</div>` +
          `<div class="premium-clinic-body">` +
          `<div class="premium-clinic-heading">` +
          `<h3 class="premium-clinic-name">${escapeHtml(c.name)}</h3>` +
          `</div>` +
          (c.tagline
            ? `<p class="premium-clinic-tagline">${escapeHtml(c.tagline)}</p>`
            : '') +
          (c.address
            ? `<p class="premium-clinic-tagline">${escapeHtml(c.address)}</p>`
            : '') +
          renderServiceTagsHtml(c.services) +
          `<div class="premium-clinic-actions">` +
          `<span class="btn btn-main premium-clinic-book">مشاهده مرکز</span>` +
          `</div>` +
          `</div></a></li>`
        );
      })
      .join('') +
    `</ul>`
  );
}

function loadTemplate(rootDir) {
  const candidates = [
    path.join(rootDir, 'views', 'service-template.html'),
    path.join(rootDir, 'service-template.html'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  }
  throw new Error('service-template.html not found');
}

function renderServicePage(slug, deps) {
  const meta = resolveServiceMeta(slug);
  if (!meta) return null;
  const clinics = findClinicsByServiceSlug(meta.slug, deps);
  const directIds = clinics.map((c) => c.id);
  const related = clinics.length
    ? { clinics: [], badge: '' }
    : findRelatedClinicsByCategory(meta, deps, directIds);
  const template = loadTemplate(deps.rootDir);
  const siteBase = String(deps.siteBase || 'https://salam-doctor.com').replace(/\/+$/, '');
  const canonical = canonicalServiceUrl(meta.slug, siteBase) || `${siteBase}/services/${meta.slug}`;
  const countLabel =
    clinics.length > 0
      ? `${clinics.length} مرکز مرتبط در شیراز`
      : related.clinics.length
        ? 'مراکز مرتبط پوست و زیبایی در شیراز'
        : 'به‌زودی مراکز بیشتری اضافه می‌شوند';

  let seoTitle = meta.title;
  let seoDescription = meta.description;
  let breadcrumbJson = null;
  const faqItems = buildServiceFaqItems(meta);
  let faqJson = buildFaqPageJsonLd(faqItems);
  const curated = SERVICE_LANDINGS[meta.slug];
  let seoH1 = (curated && curated.h1) || meta.title || seoTitle;
  const hasCuratedSeo = Boolean(curated && (curated.title || curated.description));
  if (!hasCuratedSeo) {
    try {
      const seo = require('./seoInfra');
      const built = seo.serviceSeo(meta.label || meta.title);
      seoTitle = built.title;
      seoDescription = built.description;
      seoH1 = built.title;
      breadcrumbJson = seo.serviceBreadcrumbs(meta);
    } catch (_err) {
      /* optional */
    }
  } else {
    seoH1 = curated.h1 || curated.title || seoTitle;
    try {
      const seo = require('./seoInfra');
      breadcrumbJson = seo.serviceBreadcrumbs(meta);
    } catch (_err) {
      /* optional */
    }
  }

  let html = template
    .replace(/\{\{SLUG\}\}/g, escapeHtml(meta.slug))
    .replace(/\{\{LABEL\}\}/g, escapeHtml(meta.label))
    .replace(/\{\{TITLE\}\}/g, escapeHtml(seoH1))
    .replace(/\{\{DESCRIPTION\}\}/g, escapeHtml(seoDescription))
    .replace(/\{\{CANONICAL\}\}/g, escapeHtml(canonical))
    .replace(/\{\{OG_IMAGE\}\}/g, escapeHtml(deps.ogImage))
    .replace(/\{\{COUNT_LABEL\}\}/g, escapeHtml(countLabel))
    .replace(/\{\{CLINIC_COUNT\}\}/g, String(clinics.length))
    .replace(/\{\{CLINICS_HTML\}\}/g, renderClinicCards(clinics, { suppressEmpty: !clinics.length && related.clinics.length }))
    .replace(/\{\{INTRO_HTML\}\}/g, renderIntroHtml(meta))
    .replace(/\{\{RELATED_CLINICS_HTML\}\}/g, renderRelatedClinicsSection(related.clinics, related.badge))
    .replace(/\{\{ONBOARDING_CTA_HTML\}\}/g, renderOnboardingCtaHtml())
    .replace(/\{\{FAQ_HTML\}\}/g, buildServiceFaqHtml(meta))
    .replace(/\{\{HEADER_HTML\}\}/g, deps.headerHtml || '')
    .replace(/\{\{DRAWER_HTML\}\}/g, deps.drawerHtml || '')
    .replace(/\{\{FOOTER_HTML\}\}/g, deps.footerHtml || '');

  const jsonLd = [];
  if (breadcrumbJson) jsonLd.push(breadcrumbJson);
  if (faqJson) jsonLd.push(faqJson);

  try {
    const seo = require('./seoInfra');
    html = seo.injectHeadSeo(html, {
      title: seoTitle,
      description: seoDescription,
      canonical,
      ogImage: deps.ogImage,
      jsonLd,
      skipCanonical: true, // template already injects <link rel="canonical">
    });
  } catch (_err) {
    /* keep template defaults */
  }

  return html;
}

function sendPermanentRedirect(res, location) {
  const dest = String(location || '/');
  res.writeHead(301, { Location: dest });
  res.end();
}

function createServiceLandingHandlers(deps) {
  function handleServicePage(req, res, slug) {
    try {
      if (needsServiceSlugRedirect(slug)) {
        const dest = canonicalServicePath(slug);
        if (dest) {
          sendPermanentRedirect(res, dest);
          return;
        }
      }
      const html = renderServicePage(slug, deps);
      if (!html) {
        deps.sendText(res, 404, 'Service not found');
        return;
      }
      deps.sendHtml(res, 200, html);
    } catch (err) {
      console.error('service landing render:', err);
      deps.sendText(res, 500, 'Internal server error');
    }
  }

  function handleServiceApi(req, res, slug, method) {
    if (needsServiceSlugRedirect(slug)) {
      const dest = `/api/services/${resolveCanonicalEnglishSlug(slug)}`;
      sendPermanentRedirect(res, dest);
      return;
    }
    const meta = resolveServiceMeta(slug);
    if (!meta) {
      deps.sendJson(res, 404, { error: 'Unknown service slug' }, method);
      return;
    }
    const clinics = findClinicsByServiceSlug(meta.slug, deps);
    deps.sendJson(
      res,
      200,
      {
        slug: meta.slug,
        label: meta.label,
        title: meta.title,
        description: meta.description,
        canonical: canonicalServicePath(meta.slug),
        clinics,
      },
      method
    );
  }

  function tryHandle(req, res, pathname, method) {
    if (pathname === '/services' || pathname === '/services/') {
      deps.sendRedirect(res, '/', method);
      return true;
    }

    let m = pathname.match(/^\/services\/([^/]+)$/);
    if (m && (method === 'GET' || method === 'HEAD')) {
      handleServicePage(req, res, m[1]);
      return true;
    }

    m = pathname.match(/^\/api\/services\/([^/]+)$/);
    if (m && (method === 'GET' || method === 'HEAD')) {
      handleServiceApi(req, res, m[1], method);
      return true;
    }

    return false;
  }

  return {
    tryHandle,
    handleServicePage,
    handleServiceApi,
    resolveServiceMeta,
  findClinicsByServiceSlug,
  findRelatedClinicsByCategory,
  SERVICE_LANDINGS,
  };
}

/**
 * Express app: 301 Persian/alias slugs → English, then serve landing.
 */
function createServiceLandingApp(deps) {
  const handlers = createServiceLandingHandlers(deps);
  const app = express();

  app.use(serviceSlugRedirectMiddleware);

  app.get('/services', (_req, res) => res.redirect(301, '/'));
  app.get('/services/', (_req, res) => res.redirect(301, '/'));

  function servePage(req, res) {
    handlers.handleServicePage(req, res, req.params.slug);
  }
  function serveApi(req, res) {
    handlers.handleServiceApi(req, res, req.params.slug, req.method || 'GET');
  }

  app.get('/services/:slug', servePage);
  app.head('/services/:slug', servePage);
  app.get('/api/services/:slug', serveApi);
  app.head('/api/services/:slug', serveApi);

  return app;
}

module.exports = {
  createServiceLandingHandlers,
  createServiceLandingApp,
  resolveServiceMeta,
  findClinicsByServiceSlug,
  findRelatedClinicsByCategory,
  buildServiceFaqItems,
  SERVICE_LANDINGS,
  normalizeSlug,
  slugify,
};
