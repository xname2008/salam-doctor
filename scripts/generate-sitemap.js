'use strict';

// ==========================================================================
// generate-sitemap.js — build pages-only sitemap.xml (NO articles).
//
// Architecture:
//   sitemap.xml          → homepage, static hubs, /shiraz/*, doctors
//   sitemap-articles.xml → articles only (see update-sitemap-articles.js)
//
// Every <loc> is https://salam-doctor.com, no trailing slash, no /services/*
// redirects, no noindex pages.
//
// Usage:  node scripts/generate-sitemap.js [--dry-run] [--out=PATH]
// Docker: bash scripts/generate-sitemap-docker.sh [--dry-run]
// ==========================================================================

const fs = require('fs');
const path = require('path');
const { HUB_SLUGS, PARENT_SLUGS, hubPriority } = require('../hub-slugs');
const {
  registerClinics,
  slugForClinic,
  isCleanCanonicalSlug,
  loadSlugFile,
} = require('../clinicSlug');

function getPrisma() {
  try {
    const { PrismaClient } = require('@prisma/client');
    return new PrismaClient();
  } catch (err) {
    console.warn('[sitemap] @prisma/client unavailable:', err.message);
    return null;
  }
}

const CANONICAL_ORIGIN = String(process.env.SITE_BASE || 'https://salam-doctor.com').replace(
  /\/$/,
  ''
);

/** Hubs that 301 elsewhere — never list. */
const SITEMAP_EXCLUDED_HUB_SLUGS = new Set([
  'body-contouring', // → /shiraz/slimming
  'light-therapy', // → /shiraz/skin-rejuvenation
  'dental-implant', // → /shiraz/dentistry
  'dental-veneer', // → /shiraz/dentistry
  'orthodontics', // → /shiraz/dentistry
  'co2-laser', // → /shiraz/co2-fractional-laser
]);

/**
 * Extra /shiraz/* slugs required in the pages sitemap but not always in HUB_SLUGS.
 */
const SITEMAP_EXTRA_HUB_SLUGS = [];

function isSampleClinicSlug(slug) {
  return /^sample-clinic(?:-\d+)?$/i.test(String(slug || '').trim());
}

/** Pages-only allowlist (static + utility). Sorted for stable diffs. */
const STATIC_PAGES = [
  { path: '/', priority: '1.0', lastmod: '2026-05-31', changefreq: 'daily' },
  { path: '/about.html', priority: '0.6', lastmod: '2026-06-13', changefreq: 'monthly' },
  { path: '/articles.html', priority: '0.7', lastmod: '2026-06-02', changefreq: 'weekly' },
  { path: '/faq.html', priority: '0.5', lastmod: '2026-06-13', changefreq: 'monthly' },
  { path: '/contact.html', priority: '0.6', lastmod: '2026-09-08', changefreq: 'monthly' },
  { path: '/clinic-promote.html', priority: '0.7', lastmod: '2026-09-10', changefreq: 'weekly' },
  { path: '/category.html', priority: '0.6', lastmod: '2026-05-31', changefreq: 'weekly' },
  { path: '/products.html', priority: '0.6', lastmod: '2026-06-13', changefreq: 'weekly' },
  { path: '/shiraz', priority: '0.9', lastmod: '2026-09-10', changefreq: 'daily' },
  // products/eye remain utility .html (pharmacy → /shiraz/pharmacy)
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? today() : t.toISOString().slice(0, 10);
}

function canonicalUrl(pathname) {
  let p = String(pathname == null ? '/' : pathname).trim();
  if (!p) p = '/';
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return CANONICAL_ORIGIN + p;
}

function assertCanonical(loc) {
  if (/^http:\/\//i.test(loc)) throw new Error(`insecure protocol: ${loc}`);
  if (/:\/\/www\./i.test(loc)) throw new Error(`www host not allowed: ${loc}`);
  if (/salam-doctor\.ir/i.test(loc)) throw new Error(`.ir domain not allowed: ${loc}`);
  if (loc !== CANONICAL_ORIGIN + '/' && !loc.startsWith(CANONICAL_ORIGIN + '/')) {
    throw new Error(`unexpected origin: ${loc}`);
  }
  const rel = loc.slice(CANONICAL_ORIGIN.length);
  if (rel.length > 1 && rel.endsWith('/')) throw new Error(`trailing slash: ${loc}`);
  if (rel.startsWith('/articles/')) {
    throw new Error(`articles belong in sitemap-articles.xml: ${loc}`);
  }
  if (rel.startsWith('/services/')) {
    throw new Error(`/services/* never in pages sitemap: ${loc}`);
  }
  if (
    rel === '/laser-hair.html' ||
    rel === '/cosmetic-surgery.html' ||
    rel === '/hair-transplant.html' ||
    rel === '/skin-rejuvenation.html' ||
    rel === '/injection.html' ||
    rel === '/slimming.html' ||
    rel === '/rhinoplasty.html' ||
    rel === '/lasik.html' ||
    rel === '/femto-lasik.html' ||
    rel === '/prk.html' ||
    rel === '/pharmacy.html' ||
    rel === '/shiraz/co2-laser' ||
    rel === '/index.html' ||
    rel === '/search'
  ) {
    throw new Error(`excluded path: ${loc}`);
  }
  if (rel.startsWith('/doctor/')) {
    const slug = rel.slice('/doctor/'.length);
    if (!isCleanCanonicalSlug(slug) || /^\d+$/.test(slug)) {
      throw new Error(`non-canonical doctor slug: ${loc}`);
    }
  }
  return loc;
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod, priority, changefreq }) {
  const out = ['  <url>', `    <loc>${xmlEscape(loc)}</loc>`];
  if (lastmod) out.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) out.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) out.push(`    <priority>${priority}</priority>`);
  out.push('  </url>');
  return out.join('\n');
}

function sitemapHubSlugs() {
  const set = new Set(
    [...HUB_SLUGS, ...SITEMAP_EXTRA_HUB_SLUGS]
      .map((s) => String(s || '').trim().toLowerCase())
      .filter(Boolean)
  );
  for (const excluded of SITEMAP_EXCLUDED_HUB_SLUGS) set.delete(excluded);
  return Array.from(set).sort();
}

async function collectUrls() {
  const urls = [];
  const seen = new Set();
  const add = (loc, lastmod, priority, changefreq) => {
    assertCanonical(loc);
    if (seen.has(loc)) return;
    seen.add(loc);
    urls.push({ loc, lastmod: lastmod || today(), priority, changefreq });
  };

  for (const p of STATIC_PAGES) {
    add(canonicalUrl(p.path), p.lastmod, p.priority, p.changefreq || 'weekly');
  }

  const hubLastmod = today();
  for (const slug of sitemapHubSlugs()) {
    const priority = PARENT_SLUGS.has(slug) ? '0.7' : hubPriority(slug) || '0.8';
    add(canonicalUrl(`/shiraz/${slug}`), hubLastmod, priority, 'weekly');
  }

  // Doctors — Prisma ACTIVE first, then clinic-slugs.json fallback.
  const prisma = getPrisma();
  let doctorsFromDb = false;
  try {
    if (prisma) {
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
          updatedAt: true,
        },
        orderBy: { id: 'asc' },
      });
      registerClinics(clinics);
      for (const c of clinics) {
        const slug = slugForClinic(c);
        if (!isCleanCanonicalSlug(slug) || isSampleClinicSlug(slug)) continue;
        add(canonicalUrl(`/doctor/${slug}`), fmtDate(c.updatedAt), '0.6', 'weekly');
      }
      doctorsFromDb = clinics.length > 0;
    }
  } catch (err) {
    console.warn('[sitemap] Prisma doctor list skipped:', err.message);
  }

  if (!doctorsFromDb) {
    const byId = loadSlugFile();
    for (const [, slug] of Object.entries(byId || {})) {
      if (!isCleanCanonicalSlug(slug) || isSampleClinicSlug(slug)) continue;
      add(canonicalUrl(`/doctor/${slug}`), today(), '0.6', 'weekly');
    }
  }

  // Always ensure flagship clinic is present.
  add(canonicalUrl('/doctor/nahal-clinic'), '2026-09-03', '0.6', 'weekly');

  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (_e) {
      /* ignore */
    }
  }

  urls.sort((a, b) => a.loc.localeCompare(b.loc));
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
  const hubCount = urls.filter((u) => u.loc.includes('/shiraz/')).length;
  const doctorCount = urls.filter((u) => u.loc.includes('/doctor/')).length;
  const articleCount = urls.filter((u) => u.loc.includes('/articles/')).length;
  const xml = buildXml(urls);

  if (articleCount > 0) {
    throw new Error('BUG: pages sitemap must not contain article URLs');
  }
  if (hubCount < 30) {
    console.warn(`WARNING: only ${hubCount} /shiraz/* hubs — expected ~32+`);
  }

  if (dry) {
    process.stdout.write(xml);
    process.stderr.write(
      `\n[dry-run] ${urls.length} page URLs (${hubCount} hubs, ${doctorCount} doctors). Nothing written.\n`
    );
    return;
  }

  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`Wrote ${outPath}`);
  console.log(`  ${urls.length} page URLs (${hubCount} /shiraz hubs, ${doctorCount} doctors).`);
  console.log('  Articles belong in sitemap-articles.xml — not included here.');
  console.log('  Excluded: /services/*, dual-hub .html losers, redirect hubs, /search.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Sitemap generation failed:', err);
    process.exitCode = 1;
  });
}

module.exports = {
  canonicalUrl,
  assertCanonical,
  buildXml,
  collectUrls,
  STATIC_PAGES,
  SITEMAP_EXCLUDED_HUB_SLUGS,
  sitemapHubSlugs,
  CANONICAL_ORIGIN,
};
