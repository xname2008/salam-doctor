'use strict';

/**
 * HTML sitemap — crawlable hierarchical index of cities, services, and clinics.
 *   GET /sitemap
 *   GET /html-sitemap  (alias)
 */

const path = require('path');
const express = require('express');
const { CITIES, localHubPath } = require('./local-seo-registry');
const { HUB_SLUGS, PARENT_SLUGS } = require('./hub-slugs');
const { hubLabelFa } = require('./hub-labels');
const clinicSlug = require('./clinicSlug');

const SITE_BASE = process.env.SITE_BASE || 'https://salam-doctor.com';
const PAGE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Popular city–service combinations for the global footer (internal linking).
 */
const POPULAR_CITY_SERVICE_LINKS = Object.freeze([
  { href: '/shiraz/hair-transplant', label: 'کاشت مو در شیراز' },
  { href: '/shiraz/botox', label: 'تزریق بوتاکس در شیراز' },
  { href: '/shiraz/laser-hair-removal', label: 'لیزر موهای زائد در شیراز' },
  { href: '/shiraz/fillers', label: 'تزریق فیلر در شیراز' },
  { href: '/shiraz/skin-rejuvenation', label: 'جوانسازی پوست در شیراز' },
  { href: '/shiraz/cosmetic-surgery', label: 'جراحی زیبایی در شیراز' },
  { href: '/tehran/hair-transplant', label: 'کاشت مو در تهران' },
  { href: '/tehran/laser-hair-removal', label: 'لیزر موهای زائد در تهران' },
]);

const STATIC_PAGES = Object.freeze([
  { href: '/', label: 'صفحه اصلی' },
  { href: '/articles.html', label: 'مقالات آموزشی' },
  { href: '/faq.html', label: 'سوالات متداول' },
  { href: '/about.html', label: 'درباره ما' },
  { href: '/category.html', label: 'دسته‌بندی خدمات' },
  { href: '/hair-transplant.html', label: 'کاشت مو' },
  { href: '/laser-hair.html', label: 'لیزر موهای زائد' },
  { href: '/skin-rejuvenation.html', label: 'جوانسازی پوست' },
  { href: '/injection.html', label: 'تزریقات زیبایی' },
  { href: '/search', label: 'جستجو' },
]);

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadServicesFromPrisma() {
  let prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    if (!prisma.service || typeof prisma.service.findMany !== 'function') {
      return null;
    }
    const rows = await prisma.service.findMany({
      select: {
        id: true,
        slug: true,
        serviceName: true,
        parentId: true,
        parent: { select: { slug: true, serviceName: true } },
      },
      orderBy: { serviceName: 'asc' },
    });
    return rows
      .filter((r) => r && r.slug)
      .map((r) => ({
        slug: String(r.slug).toLowerCase(),
        name: hubLabelFa(String(r.slug).toLowerCase(), r.serviceName),
        parentSlug: r.parent && r.parent.slug ? String(r.parent.slug).toLowerCase() : null,
        isParent: PARENT_SLUGS.has(String(r.slug).toLowerCase()),
      }));
  } catch (err) {
    console.warn('[html-sitemap] prisma services skipped:', (err && err.message) || err);
    return null;
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (_e) {
        /* ignore */
      }
    }
  }
}

function servicesFromHubSlugs() {
  return HUB_SLUGS.map((slug) => ({
    slug,
    name: hubLabelFa(slug),
    parentSlug: null,
    isParent: PARENT_SLUGS.has(slug),
  }));
}

async function loadActiveClinicsFromPrisma() {
  let prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    if (!prisma.clinic || typeof prisma.clinic.findMany !== 'function') {
      return [];
    }
    const now = new Date();
    const clinics = await prisma.clinic.findMany({
      where: {
        contractStatus: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      select: {
        id: true,
        slug: true,
        englishName: true,
        name: true,
        endDate: true,
        contractStatus: true,
      },
      orderBy: { name: 'asc' },
    });
    try {
      clinicSlug.registerClinics(clinics);
    } catch (_err) {
      /* optional */
    }
    const out = [];
    for (const c of clinics) {
      const doctorSlug = clinicSlug.slugForClinic(c);
      if (!clinicSlug.isCleanCanonicalSlug(doctorSlug)) continue;
      out.push({
        id: c.id,
        name: c.name || `کلینیک ${c.id}`,
        slug: doctorSlug,
        href: `/doctor/${doctorSlug}`,
      });
    }
    return out;
  } catch (err) {
    console.warn('[html-sitemap] prisma clinics skipped:', (err && err.message) || err);
    return [];
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (_e) {
        /* ignore */
      }
    }
  }
}

/**
 * Assemble sitemap page data (cities × services + clinics + static).
 */
async function loadHtmlSitemapData() {
  const cities = Object.values(CITIES).map((c) => ({
    slug: c.slug,
    nameFa: c.nameFa,
    regionFa: c.regionFa,
  }));

  let services = await loadServicesFromPrisma();
  if (!services || !services.length) {
    services = servicesFromHubSlugs();
  } else {
    // Ensure every hub slug appears even if missing from DB
    const seen = new Set(services.map((s) => s.slug));
    for (const slug of HUB_SLUGS) {
      if (!seen.has(slug)) {
        services.push({
          slug,
          name: hubLabelFa(slug),
          parentSlug: null,
          isParent: PARENT_SLUGS.has(slug),
        });
      }
    }
    services.sort((a, b) => String(a.name).localeCompare(String(b.name), 'fa'));
  }

  const majorServices = services.filter((s) => !s.isParent);
  const parentServices = services.filter((s) => s.isParent);

  const cityServiceGroups = cities.map((city) => ({
    city,
    links: majorServices.map((svc) => ({
      href: localHubPath(city.slug, svc.slug),
      label: `${svc.name} در ${city.nameFa}`,
      serviceSlug: svc.slug,
      serviceName: svc.name,
    })),
  }));

  const clinics = await loadActiveClinicsFromPrisma();

  return {
    siteBase: SITE_BASE,
    cities,
    services,
    majorServices,
    parentServices,
    cityServiceGroups,
    clinics,
    staticPages: STATIC_PAGES,
    popularLinks: POPULAR_CITY_SERVICE_LINKS,
    generatedAt: new Date().toISOString(),
  };
}

function createHtmlSitemapApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.disable('x-powered-by');

  let cache = { expires: 0, html: null };

  async function renderSitemap(req, res) {
    const now = Date.now();
    if (cache.html && cache.expires > now) {
      res.set('X-Cache', 'HIT');
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      return res.type('html').send(cache.html);
    }

    let data;
    try {
      data = await loadHtmlSitemapData();
    } catch (err) {
      console.error('[html-sitemap] load failed:', (err && err.message) || err);
      return res.status(503).type('text').send('نقشه سایت موقتاً در دسترس نیست');
    }

    res.render(
      'html-sitemap',
      {
        ...data,
        escapeHtml,
        title: 'نقشه سایت | سلام دکتر',
        description:
          'فهرست کامل شهرها، تخصص‌ها و کلینیک‌های فعال در سلام دکتر برای دسترسی سریع و ایندکس بهتر.',
        canonical: `${SITE_BASE}/sitemap`,
      },
      (err, html) => {
        if (err) {
          console.error('[html-sitemap] render error:', (err && err.message) || err);
          return res.status(500).type('text').send('خطای رندر نقشه سایت');
        }
        cache = { expires: Date.now() + PAGE_CACHE_TTL_MS, html };
        res.set('X-Cache', 'MISS');
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        res.type('html').send(html);
      }
    );
  }

  app.get('/sitemap', (req, res, next) => {
    Promise.resolve(renderSitemap(req, res)).catch(next);
  });
  app.head('/sitemap', (req, res, next) => {
    Promise.resolve(renderSitemap(req, res)).catch(next);
  });
  app.get('/html-sitemap', (req, res) => {
    res.redirect(301, '/sitemap');
  });
  app.head('/html-sitemap', (req, res) => {
    res.redirect(301, '/sitemap');
  });

  return app;
}

/** Footer fragment: popular city–service links (plain HTML for FOOTER_HTML). */
function popularCityServiceFooterHtml() {
  return POPULAR_CITY_SERVICE_LINKS.map(
    (l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`
  ).join('\n          ');
}

module.exports = {
  SITE_BASE,
  HUB_LABELS_FA,
  POPULAR_CITY_SERVICE_LINKS,
  STATIC_PAGES,
  loadHtmlSitemapData,
  createHtmlSitemapApp,
  popularCityServiceFooterHtml,
  hubLabelFa,
};
