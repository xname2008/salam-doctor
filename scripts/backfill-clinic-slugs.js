#!/usr/bin/env node
'use strict';

/**
 * Reset + regenerate clean clinic/doctor slugs (short English brands).
 *
 * Examples:
 *   klynyk-nhal-kasht-mv-fit-v-mykrvgraft  →  nahal-clinic
 *   shiraz-sample-clinic-1-…               →  sample-clinic-1
 *
 * Legacy transliterated slugs + clinic-{id} are recorded for 301 redirects.
 *
 * Usage (from repo root):
 *   node scripts/backfill-clinic-slugs.js
 *   node scripts/backfill-clinic-slugs.js --dry-run
 *   node scripts/backfill-clinic-slugs.js --reset
 */

const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const {
  buildClinicSlug,
  writeSlugArtifacts,
  buildRedirectMap,
  loadSlugFile,
  loadRedirectFile,
  englishNameFromClinic,
  MANUAL_BY_ID,
} = require('../clinicSlug');

const dryRun = process.argv.includes('--dry-run');
const forceReset = process.argv.includes('--reset') || !process.argv.includes('--keep-existing');

function loadCatalog() {
  try {
    const file = path.join(ROOT, 'data.min.js');
    const code = fs.readFileSync(file, 'utf8');
    const sandbox = { clinicsData: [] };
    vm.runInNewContext(code.replace(/^const clinicsData/, 'clinicsData'), sandbox);
    return Array.isArray(sandbox.clinicsData) ? sandbox.clinicsData : [];
  } catch (err) {
    console.warn('catalog:', err.message || err);
    return [];
  }
}

async function loadPrismaClinics() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const rows = await prisma.clinic.findMany({
      include: { services: { include: { service: true } } },
    });
    return { prisma, rows };
  } catch (err) {
    console.warn('prisma skipped:', err.message || err);
    return { prisma: null, rows: [] };
  }
}

function asSlugSource(row) {
  const services = (row.services || [])
    .map((cs) => (cs.service ? cs.service.serviceName : null))
    .filter(Boolean);
  return {
    id: row.id,
    name: row.name,
    englishName: row.englishName || null,
    specialty: services[0] || '',
    services,
    // On --reset, ignore previous long slug so buildClinicSlug regenerates cleanly.
    slug: forceReset ? null : row.slug,
  };
}

async function main() {
  const previousSlugs = loadSlugFile();
  const catalog = loadCatalog();
  const { prisma, rows: prismaRows } = await loadPrismaClinics();

  const byId = new Map();
  for (const c of catalog) {
    if (c && Number.isInteger(c.id)) byId.set(c.id, { ...c });
  }
  for (const row of prismaRows) {
    const existing = byId.get(row.id) || {};
    byId.set(row.id, { ...existing, ...asSlugSource(row) });
  }

  // Apply known englishName overrides into the working set.
  for (const [idStr, meta] of Object.entries(MANUAL_BY_ID)) {
    const id = Number(idStr);
    const cur = byId.get(id) || { id };
    byId.set(id, {
      ...cur,
      id,
      englishName: cur.englishName || meta.englishName,
      slug: forceReset ? meta.slug : cur.slug || meta.slug,
    });
  }

  const used = new Set();
  const slugs = new Map();
  const sorted = [...byId.values()].sort((a, b) => a.id - b.id);
  for (const clinic of sorted) {
    const slug = buildClinicSlug(
      forceReset ? { ...clinic, slug: MANUAL_BY_ID[clinic.id]?.slug || null } : clinic,
      used
    );
    used.add(slug);
    slugs.set(clinic.id, slug);
    const en = englishNameFromClinic(clinic) || '';
    console.log(
      `${dryRun ? '[dry] ' : ''}${clinic.id}\t${slug}` +
        `\t${clinic.name || clinic.sliderTitle || ''}` +
        (en ? `\t[${en}]` : '')
    );
  }

  const redirects = buildRedirectMap(previousSlugs, slugs);
  // Keep any prior redirects that still point at known ids.
  for (const [legacy, target] of Object.entries(loadRedirectFile())) {
    if (redirects[legacy] != null) continue;
    const id = Number(target);
    if (Number.isInteger(id) && slugs.has(id)) redirects[legacy] = id;
  }

  console.log(`Redirects to record: ${Object.keys(redirects).length}`);

  if (dryRun) {
    if (prisma) await prisma.$disconnect().catch(() => {});
    console.log(`Would write ${slugs.size} slugs`);
    return;
  }

  writeSlugArtifacts(slugs, redirects);

  if (prisma) {
    try {
      for (const [id, slug] of slugs) {
        const data = { slug };
        const en = englishNameFromClinic(byId.get(id));
        if (en) data.englishName = en;
        await prisma.clinic.updateMany({ where: { id }, data });
      }
      console.log(`Updated Prisma rows where id matched (${slugs.size} attempted)`);
    } catch (err) {
      console.warn('Prisma update failed (run migration first):', err.message || err);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(
    `Wrote data/clinic-slugs.json, data/clinic-slug-redirects.json, assets/js/clinic-slugs.js (${slugs.size} clinics)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
