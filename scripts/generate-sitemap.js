'use strict';

// ==========================================================================
// generate-sitemap.js — build a STRICTLY CANONICAL sitemap.xml.
//
// Fixes GSC "Page with redirect" / canonical-mismatch by guaranteeing every
// <loc> is byte-for-byte the canonical destination, so Googlebot never hits a
// 301. Rules enforced for EVERY url (and asserted before writing):
//   1. Absolute, secure origin only:  https://salam-doctor.com
//   2. No trailing slash (except the homepage "/").
//   3. Lowercase slugs.
//   4. Never www., never http:// — mirrors the nginx 301 canonical exactly.
//
// /shiraz/<service_slug> hub URLs come from hub-slugs.js (ALWAYS listed for
// indexing) merged with any extra slugs found in the DB at generation time.
//
// Usage (host):   node scripts/generate-sitemap.js [--dry-run] [--out=PATH]
// Usage (docker): bash scripts/generate-sitemap-docker.sh [--dry-run]
// ==========================================================================

const fs = require('fs');
const path = require('path');
const { HUB_SLUGS } = require('../hub-slugs');
const { collectStaticArticleUrls } = require('./lib/static-articles-sitemap');
const {
  registerClinics,
  slugForClinic,
  isCleanCanonicalSlug,
  loadSlugFile,
  ensureCache,
} = require('../clinicSlug');
const { canonicalServicePath, isEnglishServiceSlug, resolveCanonicalEnglishSlug } = require('../serviceSlugMap');
const { CITIES } = require('../local-seo-registry');

function getPrisma() {
  try {
    const { PrismaClient } = require('@prisma/client');
    return new PrismaClient();
  } catch (err) {
    console.warn('[sitemap] @prisma/client unavailable:', err.message);
    return null;
  }
}

// Canonical origin — https + non-www. Override with SITE_BASE in Docker/CI
// (docker-compose sets https://salam-doctor.com).
const CANONICAL_ORIGIN = String(process.env.SITE_BASE || 'https://salam-doctor.com').replace(/\/$/, '');

function isSampleClinicSlug(slug) {
  return /^sample-clinic(?:-\d+)?$/i.test(String(slug || '').trim());
}

// Static, hand-curated pages.
// category.html?type=<x> URLs, but category.html's <link rel=canonical> is the
// bare "category.html" (no query) — those query URLs were non-canonical and
// are intentionally dropped here (the dedicated *.html landing pages below are
// the real indexable service pages).
const STATIC_PAGES = [
  { path: '/', priority: '1.0', lastmod: '2026-05-31' },
  { path: '/category.html', priority: '0.6', lastmod: '2026-05-31' },
  { path: '/hair-transplant.html', priority: '0.9', lastmod: '2026-06-13' },
  { path: '/skin-rejuvenation.html', priority: '0.9', lastmod: '2026-06-13' },
  { path: '/laser-hair.html', priority: '0.9', lastmod: '2026-06-13' },
  { path: '/injection.html', priority: '0.9', lastmod: '2026-06-13' },
  { path: '/cosmetic-surgery.html', priority: '0.9', lastmod: '2026-06-13' },
  { path: '/slimming.html', priority: '0.9', lastmod: '2026-06-13' },
  { path: '/eye.html', priority: '0.8', lastmod: '2026-06-13' },
  { path: '/lasik.html', priority: '0.8', lastmod: '2026-06-13' },
  { path: '/femto-lasik.html', priority: '0.8', lastmod: '2026-06-13' },
  { path: '/prk.html', priority: '0.8', lastmod: '2026-06-13' },
  { path: '/products.html', priority: '0.8', lastmod: '2026-06-13' },
  { path: '/about.html', priority: '0.8', lastmod: '2026-06-13' },
  { path: '/contact.html', priority: '0.7', lastmod: '2026-09-08' },
  { path: '/articles.html', priority: '0.7', lastmod: '2026-06-02' },
];

// --------------------------------------------------------------------------
// Canonical URL builder + validator
// --------------------------------------------------------------------------
function canonicalUrl(pathname) {
  let p = String(pathname == null ? '/' : pathname).trim();
  if (!p) p = '/';
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/{2,}/g, '/');          // collapse duplicate slashes
  if (p.length > 1) p = p.replace(/\/+$/, ''); // strip trailing slash (not root)
  return CANONICAL_ORIGIN + p;
}

function serviceHubUrl(slug) {
  return canonicalUrl('/shiraz/' + String(slug || '').trim().toLowerCase());
}

// Hard guarantee: throw rather than ever emit a redirect-prone URL.
function assertCanonical(loc) {
  if (/^http:\/\//i.test(loc)) throw new Error(`insecure protocol: ${loc}`);
  if (/:\/\/www\./i.test(loc)) throw new Error(`www host not allowed: ${loc}`);
  if (loc !== CANONICAL_ORIGIN + '/' && !loc.startsWith(CANONICAL_ORIGIN + '/')) {
    throw new Error(`unexpected origin: ${loc}`);
  }
  const rel = loc.slice(CANONICAL_ORIGIN.length);
  if (rel.length > 1 && rel.endsWith('/')) throw new Error(`trailing slash: ${loc}`);
  if (rel.startsWith('/shiraz/') && rel !== rel.toLowerCase()) {
    throw new Error(`non-lowercase slug: ${loc}`);
  }
  if (/profile\.html/i.test(rel) || /[?&]id=/i.test(rel)) {
    throw new Error(`legacy profile URL not allowed: ${loc}`);
  }
  if (rel.startsWith('/doctor/')) {
    const slug = rel.slice('/doctor/'.length);
    if (!isCleanCanonicalSlug(slug)) {
      throw new Error(`non-canonical doctor slug: ${loc}`);
    }
  }
  return loc;
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
const today = () => new Date().toISOString().slice(0, 10);
function fmtDate(d) {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? today() : t.toISOString().slice(0, 10);
}

function urlEntry({ loc, lastmod, priority, changefreq }) {
  const out = ['  <url>', `    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) out.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) out.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) out.push(`    <priority>${priority}</priority>`);
  out.push('  </url>');
  return out.join('\n');
}

// --------------------------------------------------------------------------
// Collect URLs (static + DB-driven local-hub pages)
// --------------------------------------------------------------------------
async function collectUrls() {
  const urls = [];
  const seen = new Set();
  const add = (loc, lastmod, priority, changefreq) => {
    assertCanonical(loc);
    if (seen.has(loc)) return; // de-dupe
    seen.add(loc);
    urls.push({ loc, lastmod, priority, changefreq });
  };

  for (const p of STATIC_PAGES) add(canonicalUrl(p.path), p.lastmod, p.priority, 'weekly');

  const citySlugs = Object.keys(CITIES || {});
  const highTrafficCities = new Set(['shiraz', 'tehran']);
  const serviceSlugSet = new Set(
    HUB_SLUGS.map((slug) => String(slug || '').trim().toLowerCase()).filter(Boolean)
  );
  const doctorLastmod = today();

  for (const article of collectStaticArticleUrls(path.join(__dirname, '..', 'articles'), {
    lastmodMode: 'mtime',
    origin: CANONICAL_ORIGIN,
  })) {
    add(article.loc, article.lastmod, article.priority, 'weekly');
  }

  const prisma = getPrisma();
  let doctorsFromDb = false;
  try {
    if (prisma) {
      const now = new Date();
      const services = await prisma.service.findMany({
        select: {
          id: true,
          slug: true,
          children: { select: { id: true } },
        },
        orderBy: { slug: 'asc' },
      });
      for (const s of services || []) {
        const slug = String(s.slug || '').trim().toLowerCase();
        if (!slug) continue;
        const canonical = resolveCanonicalEnglishSlug(slug);
        if (canonical && isEnglishServiceSlug(canonical)) serviceSlugSet.add(canonical);
      }

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
          updatedAt: true,
        },
        orderBy: { id: 'asc' },
      });
      registerClinics(clinics);
      for (const c of clinics) {
        const slug = slugForClinic(c);
        if (!isCleanCanonicalSlug(slug) || isSampleClinicSlug(slug)) continue;
        add(
          canonicalUrl(`/doctor/${slug}`),
          fmtDate(c.updatedAt) || doctorLastmod,
          '0.8',
          'weekly'
        );
      }
      doctorsFromDb = clinics.length > 0;

      const activeClinicWhere = {
        contractStatus: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      };
      const serviceBySlug = new Map(
        (services || []).map((row) => [String(row.slug || '').trim().toLowerCase(), row])
      );

      for (const slug of Array.from(serviceSlugSet).sort()) {
        if (!isEnglishServiceSlug(slug)) continue;
        const row = serviceBySlug.get(slug);
        if (!row) continue;
        const serviceIds = [row.id, ...((row.children || []).map((child) => child.id).filter(Boolean))];
        const aggregate = await prisma.clinic.aggregate({
          where: {
            ...activeClinicWhere,
            services: { some: { serviceId: { in: serviceIds } } },
          },
          _count: { id: true },
          _max: { updatedAt: true },
        });
        const activeCount = Number((aggregate && aggregate._count && aggregate._count.id) || 0);
        if (activeCount <= 0) continue;
        const latestUpdate = fmtDate(aggregate && aggregate._max ? aggregate._max.updatedAt : today());

        for (const citySlug of citySlugs) {
          add(
            canonicalUrl(`/${citySlug}/${slug}`),
            latestUpdate,
            '0.9',
            highTrafficCities.has(citySlug) ? 'daily' : 'weekly'
          );
        }

        const servicePath = canonicalServicePath(slug);
        if (servicePath) add(canonicalUrl(servicePath), latestUpdate, '0.8', 'weekly');
      }
    }
  } catch (err) {
    console.warn('[sitemap] Prisma sitemap data skipped:', err.message);
  }

  if (!doctorsFromDb) {
    const byId = loadSlugFile();
    for (const [, slug] of Object.entries(byId || {})) {
      if (!isCleanCanonicalSlug(slug) || isSampleClinicSlug(slug)) continue;
      add(canonicalUrl(`/doctor/${slug}`), doctorLastmod, '0.8', 'weekly');
    }
    if (Object.keys(byId || {}).length) {
      console.warn(
        `[sitemap] Used clinic-slugs.json for doctors (${Object.keys(byId).length} entries).`
      );
    }
  }

  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (_e) {
      /* ignore */
    }
  }

  return urls;
}

function buildXml(urls) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(urlEntry),
    '</urlset>',
    '',
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const outArg = args.find((a) => a.startsWith('--out='));
  const outPath = outArg ? outArg.split('=')[1] : path.join(__dirname, '..', 'sitemap.xml');

  const urls = await collectUrls();
  const hubCount = urls.filter((u) => {
    const rel = u.loc.replace(CANONICAL_ORIGIN, '');
    return /^\/[a-z0-9-]+\/[a-z0-9-]+$/.test(rel) && !rel.startsWith('/doctor/') && !rel.startsWith('/services/');
  }).length;
  const doctorCount = urls.filter((u) => u.loc.includes('/doctor/')).length;
  const xml = buildXml(urls);

  if (dry) {
    process.stdout.write(xml);
    process.stderr.write(
      `\n[dry-run] ${urls.length} URLs (${hubCount} city/service hubs, ${doctorCount} /doctor). Nothing written.\n`
    );
    return;
  }

  if (hubCount === 0) {
    console.warn('WARNING: no city/service hub URLs found — is the DB reachable and seeded with active clinics?');
  }
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`Wrote ${outPath}`);
  console.log(`  ${urls.length} URLs total, ${hubCount} city/service hubs, ${doctorCount} /doctor profiles.`);
  console.log('  Doctors use canonical /doctor/:slug only (no profile.html / transliterations).');
  console.log('  Empty hubs are excluded; hub <lastmod> comes from the newest active clinic update.');
  console.log('  All <loc> validated: https, non-www, no trailing slash, lowercase slugs.');
  console.log('\nIf ArvanCloud caches /sitemap.xml, purge it so Google sees the new file.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Sitemap generation failed:', err);
    process.exitCode = 1;
  });
}

module.exports = { canonicalUrl, serviceHubUrl, assertCanonical, buildXml, STATIC_PAGES, CANONICAL_ORIGIN };
