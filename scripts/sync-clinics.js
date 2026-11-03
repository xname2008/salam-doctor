#!/usr/bin/env node
'use strict';

/**
 * clinic:sync — validate real/active clinics and sync /doctor/{slug} into sitemap.xml
 *
 * Safe onboarding helper: never invents clinics, never promotes sample/fixture/retired
 * rows, and refuses to write a pages sitemap that would drop hubs.
 *
 * Usage:
 *   npm run clinic:sync
 *   node scripts/sync-clinics.js --dry-run
 *   node scripts/sync-clinics.js --skip-audit
 */

const fs = require('fs');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITE = 'https://salam-doctor.com';
const DEFAULT_HERO = '/assets/images/defaults/clinic-default.webp';

const {
  loadClinicsData,
  normalizeCatalogServices,
} = require('../catalogClinicSync');
const {
  registerClinics,
  slugForClinic,
  isCleanCanonicalSlug,
  loadSlugFile,
} = require('../clinicSlug');
const {
  isRealClinic,
  isRetiredFixtureId,
  isSampleClinicSlug,
  PLACEHOLDER_NAME_RE,
  toPositiveInt,
  clinicDisplayName,
} = require('../realClinics');
const { HUB_SLUGS } = require('../hub-slugs');
const { resolveClinicCardImages } = require('../hubClinicSanitize');

const HUB_SET = new Set(HUB_SLUGS);
const BANNED_META_RE = /sample-clinic|fixture|آزمایشی|تومان/i;
const PERSIAN_RE = /[\u0600-\u06FF]{2,}/;
const DOCTOR_URL_BLOCK_RE =
  /\s*<url>\s*<loc>https:\/\/salam-doctor\.com\/doctor\/[^<]+<\/loc>[\s\S]*?<\/url>/gi;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = { dryRun: false, skipAudit: false, help: false };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--skip-audit') args.skipAudit = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  process.stdout.write(`sync-clinics.js — validate real clinics + sync /doctor/* into sitemap.xml

Options:
  --dry-run       Validate and print planned sitemap doctor URLs; do not write
  --skip-audit    Skip the trailing npm run seo:audit
  -h, --help      Show this help

Exit codes:
  0  all validations + sitemap sync (+ audit) passed
  1  validation/sitemap/audit failure
`);
}

function publicFsPath(webPath) {
  const rel = String(webPath || '')
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '');
  return rel ? path.join(ROOT, rel) : '';
}

function heroExists(webPath) {
  const abs = publicFsPath(webPath);
  return Boolean(abs && fs.existsSync(abs) && fs.statSync(abs).isFile());
}

function collectBannedHits(clinic) {
  const chunks = [
    clinic.name,
    clinic.sliderTitle,
    clinic.slug,
    clinic.address,
    clinic.fullAddress,
    clinic.englishName,
    clinic.biography,
    clinic.intro,
  ];
  if (Array.isArray(clinic.services)) {
    for (const s of clinic.services) {
      if (!s) continue;
      if (typeof s === 'string') chunks.push(s);
      else chunks.push(s.label, s.slug, s.name);
    }
  }
  if (Array.isArray(clinic.faqs)) {
    for (const f of clinic.faqs) {
      if (!f) continue;
      chunks.push(f.q, f.a, f.question, f.answer, f.name, f.text);
    }
  }
  if (clinic.faq && typeof clinic.faq === 'object') {
    chunks.push(JSON.stringify(clinic.faq));
  }
  const hits = [];
  for (const raw of chunks) {
    const text = String(raw || '');
    if (!text) continue;
    if (BANNED_META_RE.test(text)) hits.push(text.slice(0, 80));
  }
  return hits;
}

function mappedHubSlugs(clinic) {
  const hubs = new Set();
  for (const slug of normalizeCatalogServices(clinic)) {
    if (HUB_SET.has(slug)) hubs.add(slug);
  }
  // Prisma / shaped rows may already carry hub service slugs.
  const raw = Array.isArray(clinic.services) ? clinic.services : [];
  for (const item of raw) {
    const slug =
      typeof item === 'string'
        ? item.trim().toLowerCase()
        : String((item && (item.slug || item.service_slug)) || '')
            .trim()
            .toLowerCase();
    if (slug && HUB_SET.has(slug)) hubs.add(slug);
  }
  if (Array.isArray(clinic.hubSlugs)) {
    for (const slug of clinic.hubSlugs) {
      const key = String(slug || '')
        .trim()
        .toLowerCase();
      if (key && HUB_SET.has(key)) hubs.add(key);
    }
  }
  return [...hubs];
}

function loadPrismaActiveClinics() {
  // Prefer querying inside the backend container (DB hostname only resolves there).
  try {
    const script = `
      (async () => {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        try {
          const now = new Date();
          const rows = await prisma.clinic.findMany({
            where: {
              contractStatus: 'ACTIVE',
              OR: [{ endDate: null }, { endDate: { gte: now } }],
            },
            select: {
              id: true,
              name: true,
              slug: true,
              englishName: true,
              fullAddress: true,
              biography: true,
              contractStatus: true,
              updatedAt: true,
              services: { select: { service: { select: { slug: true } } } },
            },
            orderBy: { id: 'asc' },
          });
          const shaped = rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            englishName: row.englishName,
            address: row.fullAddress,
            fullAddress: row.fullAddress,
            biography: row.biography,
            contractStatus: row.contractStatus,
            updatedAt: row.updatedAt,
            hubSlugs: (row.services || [])
              .map((link) => link && link.service && link.service.slug)
              .filter(Boolean),
            source: 'prisma',
          }));
          process.stdout.write(JSON.stringify(shaped));
        } finally {
          await prisma.$disconnect().catch(() => {});
        }
      })().catch((err) => {
        console.error(err && err.message ? err.message : err);
        process.exit(1);
      });
    `;
    const out = execFileSync(
      'docker',
      ['exec', '-i', 'salam-doctor-backend', 'node', '-e', script],
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
    ).trim();
    if (!out) return [];
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(
      '[clinic:sync] Prisma ACTIVE list unavailable:',
      err && err.message ? err.message.split('\n')[0] : err
    );
    return [];
  }
}

function mergeClinicRecords(prismaRows, catalogRows) {
  const byId = new Map();

  for (const row of catalogRows || []) {
    const id = toPositiveInt(row && row.id);
    if (id == null) continue;
    byId.set(id, {
      ...row,
      id,
      source: 'catalog',
    });
  }

  for (const row of prismaRows || []) {
    const id = toPositiveInt(row && row.id);
    if (id == null) continue;
    const prev = byId.get(id) || {};
    byId.set(id, {
      ...prev,
      ...row,
      id,
      name: row.name || prev.name || prev.sliderTitle,
      address: row.address || row.fullAddress || prev.address || prev.fullAddress,
      fullAddress: row.fullAddress || row.address || prev.fullAddress || prev.address,
      services: prev.services || row.services,
      hubSlugs: row.hubSlugs || prev.hubSlugs,
      image: prev.image || row.image,
      source: prev.source === 'catalog' ? 'catalog+prisma' : 'prisma',
    });
  }

  // Slug-file only ids (no catalog/prisma row) are ignored — not enough to onboard.
  return [...byId.values()];
}

/**
 * Decide whether a clinic is in scope for public onboarding validation.
 * Retired fixtures / sample slugs are skipped (not errors).
 */
function isOnboardingCandidate(clinic) {
  if (!clinic || typeof clinic !== 'object') return false;
  if (isRetiredFixtureId(clinic)) return false;
  const slug = String(clinic.slug || slugForClinic(clinic) || '')
    .trim()
    .toLowerCase();
  if (isSampleClinicSlug(slug)) return false;
  if (clinic.contractStatus === 'ACTIVE') return true;
  return isRealClinic(clinic);
}

function validateClinic(clinic, seenIds, seenSlugs) {
  const errors = [];
  const id = toPositiveInt(clinic.id);
  if (id == null) errors.push('missing unique numeric id');
  else if (seenIds.has(id)) errors.push(`duplicate id ${id}`);
  else seenIds.add(id);

  const slug = String(slugForClinic(clinic) || clinic.slug || '')
    .trim()
    .toLowerCase();
  if (!slug) errors.push('missing slug');
  else if (/\s/.test(slug) || /\.html$/i.test(slug) || slug.includes('.')) {
    errors.push(`slug not URL-safe: ${slug}`);
  } else if (!isCleanCanonicalSlug(slug) || isSampleClinicSlug(slug)) {
    errors.push(`slug not clean canonical: ${slug}`);
  } else if (seenSlugs.has(slug)) {
    errors.push(`duplicate slug ${slug}`);
  } else {
    seenSlugs.add(slug);
  }

  const name = clinicDisplayName(clinic);
  if (!name) errors.push('missing Persian name');
  else if (PLACEHOLDER_NAME_RE.test(name)) errors.push(`placeholder name: ${name}`);
  else if (!PERSIAN_RE.test(name)) errors.push(`name is not Persian: ${name}`);

  const address = String(clinic.address || clinic.fullAddress || '').trim();
  if (!address) errors.push('missing Shiraz address');
  else if (!/شیراز/.test(address)) errors.push(`address must include شیراز: ${address}`);

  const images = resolveClinicCardImages(clinic);
  const preferred = `/clinics/${id}/Hero.webp`;
  let heroImage = images.heroImage || preferred;
  if (heroExists(preferred)) {
    heroImage = preferred;
  } else if (heroExists(images.heroImage)) {
    heroImage = images.heroImage;
  } else if (heroExists(DEFAULT_HERO)) {
    heroImage = DEFAULT_HERO;
  } else {
    errors.push(`hero image missing (expected ${preferred} or ${DEFAULT_HERO})`);
  }

  const hubs = mappedHubSlugs(clinic);
  if (!hubs.length) {
    errors.push('no mapped /shiraz/{hub} service');
  }

  const banned = collectBannedHits({ ...clinic, slug, address, name });
  if (banned.length) {
    errors.push(`banned placeholder/metadata: ${banned[0]}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    id,
    slug,
    name,
    address,
    heroImage,
    hubs,
  };
}

function doctorUrlEntry(slug, lastmod) {
  return [
    '  <url>',
    `    <loc>${SITE}/doctor/${slug}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>0.6</priority>',
    '  </url>',
  ].join('\n');
}

function mergeDoctorsIntoSitemap(existingXml, doctorBlocks) {
  const xml = String(existingXml || '');
  if (!xml.includes('<urlset')) {
    throw new Error('sitemap.xml missing <urlset> — refusing to overwrite pages sitemap');
  }
  // Guardrail: never wipe hub inventory when syncing doctors.
  const hubCount = (xml.match(/\/shiraz\//g) || []).length;
  if (hubCount < 20) {
    throw new Error(
      `sitemap.xml looks truncated (${hubCount} /shiraz refs) — refuse doctor sync`
    );
  }

  const cleaned = xml.replace(DOCTOR_URL_BLOCK_RE, '');
  const insertAt = cleaned.lastIndexOf('</urlset>');
  if (insertAt === -1) throw new Error('sitemap.xml missing </urlset>');

  const block = doctorBlocks.length ? `${doctorBlocks.join('\n')}\n` : '';
  return `${cleaned.slice(0, insertAt)}${block}${cleaned.slice(insertAt)}`;
}

function runSeoAudit() {
  console.log('\n[clinic:sync] running npm run seo:audit …');
  const result = spawnSync('npm', ['run', 'seo:audit'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`seo:audit failed with exit ${result.status}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  console.log('=== clinic:sync ===');

  const catalog = loadClinicsData();
  const prismaRows = loadPrismaActiveClinics();
  const merged = mergeClinicRecords(prismaRows, catalog);
  registerClinics(merged);

  // Ensure slug map is visible for slugForClinic fallbacks.
  const slugFile = loadSlugFile() || {};
  for (const [id, slug] of Object.entries(slugFile)) {
    const n = toPositiveInt(id);
    if (n == null) continue;
    const row = merged.find((c) => c.id === n);
    if (row && !row.slug) row.slug = slug;
  }

  const candidates = merged.filter(isOnboardingCandidate);
  const skipped = merged.length - candidates.length;
  console.log(
    `[clinic:sync] sources: catalog=${catalog.length} prismaActive=${prismaRows.length} merged=${merged.length} candidates=${candidates.length} skipped=${skipped}`
  );

  if (!candidates.length) {
    throw new Error('no active/real clinics found to validate');
  }

  const seenIds = new Set();
  const seenSlugs = new Set();
  const validated = [];
  const failures = [];

  for (const clinic of candidates) {
    const result = validateClinic(clinic, seenIds, seenSlugs);
    if (result.ok) {
      validated.push(result);
      console.log(
        `PASS id=${result.id} slug=${result.slug} hubs=${result.hubs.length} hero=${result.heroImage}`
      );
    } else {
      failures.push({ id: clinic.id, errors: result.errors });
      console.log(`FAIL id=${clinic.id}: ${result.errors.join('; ')}`);
    }
  }

  if (failures.length) {
    throw new Error(`${failures.length} clinic(s) failed validation`);
  }

  validated.sort((a, b) => a.slug.localeCompare(b.slug));
  const lastmod = today();
  const doctorBlocks = validated.map((c) => doctorUrlEntry(c.slug, lastmod));

  const existing = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const nextXml = mergeDoctorsIntoSitemap(existing, doctorBlocks);

  if (args.dryRun) {
    console.log('\n[dry-run] planned doctor sitemap entries:');
    for (const c of validated) {
      console.log(`  ${SITE}/doctor/${c.slug}  lastmod=${lastmod}`);
    }
    console.log('[dry-run] sitemap.xml not written');
  } else {
    fs.writeFileSync(SITEMAP_PATH, nextXml, 'utf8');
    console.log(
      `\nUpdated ${path.relative(ROOT, SITEMAP_PATH)} with ${validated.length} doctor URL(s) (lastmod=${lastmod})`
    );
  }

  if (!args.skipAudit && !args.dryRun) {
    runSeoAudit();
  } else if (args.dryRun) {
    console.log('[dry-run] skipped seo:audit');
  } else {
    console.log('[clinic:sync] skipped seo:audit (--skip-audit)');
  }

  console.log('\nclinic:sync OK');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('clinic:sync failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  });
}

module.exports = {
  validateClinic,
  mergeDoctorsIntoSitemap,
  mappedHubSlugs,
  collectBannedHits,
  isOnboardingCandidate,
};
