#!/usr/bin/env node
'use strict';

/**
 * Sync catalog clinics (data.min.js) into PostgreSQL for Shiraz hub pages.
 *
 * Usage:
 *   node prisma/sync-catalog-clinics.js              # sync Nahal (id 114) as ACTIVE
 *   node prisma/sync-catalog-clinics.js --id=114
 *   node prisma/sync-catalog-clinics.js --all        # sync every catalog clinic (EXPIRED)
 *   node prisma/sync-catalog-clinics.js --dry-run
 */

const path = require('path');
const Database = require('better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const {
  loadClinicsData,
  syncCatalogClinicToPostgres,
} = require('../catalogClinicSync');
const { SERVICE_CATALOG, LONGTAIL_SERVICES } = require('./seed-mock-clinics');

async function ensureHubServices(prisma) {
  for (const group of SERVICE_CATALOG) {
    const parent = await prisma.service.upsert({
      where: { slug: group.parent.slug },
      update: { serviceName: group.parent.serviceName },
      create: group.parent,
    });
    for (const child of group.children) {
      await prisma.service.upsert({
        where: { slug: child.slug },
        update: {
          serviceName: child.serviceName,
          basePrice: child.basePrice,
          parentId: parent.id,
        },
        create: { ...child, parentId: parent.id },
      });
    }
  }
  for (const lt of LONGTAIL_SERVICES) {
    const parent = await prisma.service.findUnique({ where: { slug: lt.parentSlug } });
    await prisma.service.upsert({
      where: { slug: lt.slug },
      update: {
        serviceName: lt.serviceName,
        basePrice: lt.basePrice,
        parentId: parent ? parent.id : null,
      },
      create: {
        slug: lt.slug,
        serviceName: lt.serviceName,
        basePrice: lt.basePrice,
        parentId: parent ? parent.id : null,
      },
    });
  }
}

const ROOT = path.join(__dirname, '..');
const DEFAULT_ACTIVE_IDS = [114];

function parseArgs(argv) {
  const opts = { dryRun: false, all: false, ids: DEFAULT_ACTIVE_IDS.slice() };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--all') opts.all = true;
    else if (arg.startsWith('--id=')) {
      const id = Number.parseInt(arg.slice(5), 10);
      if (Number.isInteger(id)) opts.ids = [id];
    }
  }
  if (opts.all) {
    opts.ids = loadClinicsData()
      .filter((c) => c && Number.isInteger(c.id))
      .map((c) => c.id);
  }
  return opts;
}

function loadProfile(clinicId) {
  const dbPath = path.join(ROOT, 'leads.db');
  try {
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT * FROM clinic_profiles WHERE clinic_id = ?').get(clinicId);
    db.close();
    return row || null;
  } catch (_err) {
    return null;
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  const prisma = new PrismaClient();

  try {
    if (!opts.dryRun) {
      console.log('Ensuring hub service catalog…');
      await ensureHubServices(prisma);
    }

    for (const id of opts.ids) {
      const profile = loadProfile(id);
      const contractStatus = DEFAULT_ACTIVE_IDS.includes(id) ? 'ACTIVE' : 'EXPIRED';

      console.log(
        `${opts.dryRun ? '[dry] ' : ''}sync clinic #${id} → ${contractStatus}`
      );
      if (opts.dryRun) continue;

      const result = await syncCatalogClinicToPostgres(prisma, id, {
        profile,
        contractStatus,
      });
      console.log(
        `  ✓ ${result.clinic.name} (${result.clinic.slug}) services: ${result.serviceSlugs.join(', ')}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
