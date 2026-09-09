'use strict';

// ==========================================================================
// seoRouter — Express app serving programmatic-SEO hub pages.
//   GET /shiraz/:service_slug   e.g. /shiraz/laser, /shiraz/hair-transplant
//
// Mounted from server.js and delegated only the `/shiraz/*` path space, so
// the existing raw-http routes and socket.io keep working untouched.
// ==========================================================================

const path = require('path');
const express = require('express');
const { DirectoryRepository } = require('./DirectoryRepository');

const SITE_BASE = process.env.SITE_BASE || 'https://salam-doctor.ir';
const CITY = 'شیراز';
const PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

// Per-slug SEO overrides (exact titles/descriptions/FAQs for long-tail hubs).
// Loaded defensively so a config error never takes the hub pages down.
let SEO_OVERRIDES = {};
try {
  SEO_OVERRIDES = require('./seo-config');
} catch (err) {
  console.warn('[seo] seo-config.js not loaded, using generated metadata only:', err && err.message);
}

function createSeoApp(options = {}) {
  const repo = options.repository || new DirectoryRepository(options.repoOptions);
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('etag', 'strong');

  // Rendered-HTML micro-cache (keyed by slug). Fast path for repeat crawlers.
  const htmlCache = new Map(); // slug -> { expires, html }

  app.get('/shiraz/:service_slug', async (req, res) => {
    const slug = String(req.params.service_slug || '').trim().toLowerCase();

    // Ignore accidental asset lookups under the namespace.
    if (!slug || /\.[a-z0-9]+$/i.test(slug)) return res.status(404).send('Not found');

    const now = Date.now();
    const hit = htmlCache.get(slug);
    if (hit && hit.expires > now) {
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      return res.type('html').send(hit.html);
    }

    let data;
    try {
      data = await repo.getDirectoryPageData(slug);
    } catch (err) {
      console.error('[seo] repository error for', slug, err && err.message);
      return res.status(503).send('سرویس موقتاً در دسترس نیست');
    }

    if (!data) return res.status(404).send('دسته‌بندی یافت نشد');

    const seo = buildSeo(data);

    res.render('directory', { ...data, seo, siteBase: SITE_BASE }, (err, html) => {
      if (err) {
        console.error('[seo] render error for', slug, err && err.message);
        return res.status(500).send('خطای رندر صفحه');
      }
      htmlCache.set(slug, { expires: Date.now() + PAGE_CACHE_TTL_MS, html });
      res.set('X-Cache', 'MISS');
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      res.type('html').send(html);
    });
  });

  app.clearHtmlCache = () => htmlCache.clear();
  return app;
}

// --------------------------------------------------------------------------
// Build all SEO artefacts (title, meta, canonical, JSON-LD) for a service.
// --------------------------------------------------------------------------
function buildSeo(data) {
  const { service, city, clinics, stats, districts } = data;
  const canonical = `${SITE_BASE}/shiraz/${service.slug}`;
  const count = stats.total;
  const override = SEO_OVERRIDES[service.slug] || {};

  const title = override.title
    || `${service.name} در ${city} | لیست ${count} مرکز برتر + قیمت ۱۴۰۵ | سلام دکتر`;

  const districtNames = districts.slice(0, 4).map((d) => d.name).join('، ');
  const priceBit = service.minPrice
    ? ` قیمت از ${formatToman(service.minPrice)} تومان.`
    : '';
  const description = override.description
    || (`بهترین مراکز ${service.name} در ${city}` +
      (districtNames ? ` (${districtNames})` : '') +
      `؛ ${stats.active} مرکز فعال با تجهیزات اصل و دستگاه‌های تأیید‌شده.${priceBit} رزرو مشاوره رایگان.`);

  // ----- JSON-LD graph -----
  const itemList = {
    '@type': 'ItemList',
    itemListElement: clinics.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': ['MedicalClinic', 'LocalBusiness'],
        name: c.name,
        telephone: c.phone || undefined,
        url: absolute(c.profileUrl),
        address: {
          '@type': 'PostalAddress',
          addressLocality: city,
          addressRegion: 'فارس',
          addressCountry: 'IR',
          streetAddress: c.address || undefined,
          ...(c.district ? { addressArea: c.district.name } : {}),
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: c.rating.value,
          reviewCount: c.rating.count,
          bestRating: 5,
          worstRating: 1,
        },
      },
    })),
  };

  const serviceEntity = {
    '@type': 'MedicalProcedure',
    name: service.name,
    url: canonical,
    // AggregateRating on the service category → golden stars for the hub URL.
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: stats.ratingValue,
      reviewCount: stats.reviewCount,
      bestRating: 5,
      worstRating: 1,
    },
  };

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: SITE_BASE + '/' },
      { '@type': 'ListItem', position: 2, name: city, item: `${SITE_BASE}/shiraz` },
      ...(service.parent
        ? [{ '@type': 'ListItem', position: 3, name: service.parent.name, item: `${SITE_BASE}/shiraz/${service.parent.slug}` }]
        : []),
      { '@type': 'ListItem', position: service.parent ? 4 : 3, name: service.name, item: canonical },
    ],
  };

  const faqEntity = buildFaq(service, city, stats, override.faqs);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [serviceEntity, itemList, breadcrumb, faqEntity],
  };

  const aggregateRatingLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalProcedure',
    name: service.name,
    url: canonical,
    description,
    aggregateRating: serviceEntity.aggregateRating,
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    ...faqEntity,
  };

  const h1Title = override.h1 || `بهترین ${service.name} در ${city}`;

  return {
    title,
    h1Title,
    description,
    canonical,
    ogImage: `${SITE_BASE}/images/hero-collage.png`,
    jsonLd: JSON.stringify(jsonLd),
    aggregateRatingLd: JSON.stringify(aggregateRatingLd),
    faqJsonLd: JSON.stringify(faqJsonLd),
    faq: faqEntity.mainEntity.map((q) => ({ q: q.name, a: q.acceptedAnswer.text })),
  };
}

function buildFaq(service, city, stats, extraFaqs) {
  const priceAnswer = service.minPrice
    ? `هزینه ${service.name} در ${city} از حدود ${formatToman(service.minPrice)} تومان شروع می‌شود و بسته به مرکز، تجهیزات و تعداد جلسات متغیر است.`
    : `هزینه ${service.name} در ${city} بسته به مرکز، تجهیزات و تعداد جلسات متفاوت است؛ برای قیمت دقیق مشاوره رایگان بگیرید.`;

  // Slug-specific FAQs (seo-config.js) come first — they target the exact
  // long-tail intent — followed by the generated evergreen set.
  const custom = Array.isArray(extraFaqs)
    ? extraFaqs
        .filter((f) => f && f.q && f.a)
        .map((f) => ({ name: f.q, text: f.a }))
    : [];

  const qas = [
    ...custom,
    {
      name: `بهترین مرکز ${service.name} در ${city} کدام است؟`,
      text: `در حال حاضر ${stats.total} مرکز ارائه‌دهنده ${service.name} در ${city} در سلام دکتر ثبت شده که ${stats.active} مرکز فعال با تجهیزات تأییدشده هستند. لیست کامل به‌همراه امتیاز و آدرس در همین صفحه آمده است.`,
    },
    { name: `هزینه ${service.name} در ${city} چقدر است؟`, text: priceAnswer },
    {
      name: `چطور از اصل بودن دستگاه‌های ${service.name} مطمئن شویم؟`,
      text: `مراکزی که در سلام دکتر نشان «دستگاه اصل» دارند، مدارک اصالت تجهیزات (مانند Candela، Cynosure، Doublo) آن‌ها بررسی و تأیید شده است.`,
    },
    {
      name: `برای رزرو نوبت ${service.name} چه کنیم؟`,
      text: `کافی است روی دکمه «مشاوره رایگان» مرکز موردنظر کلیک کنید تا کارشناسان سلام دکتر شما را راهنمایی کنند.`,
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

function absolute(url) {
  if (!url) return SITE_BASE;
  return /^https?:\/\//i.test(url) ? url : SITE_BASE + (url.startsWith('/') ? url : '/' + url);
}

function formatToman(n) {
  return Number(n).toLocaleString('fa-IR');
}

module.exports = { createSeoApp, buildSeo };
