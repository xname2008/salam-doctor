#!/usr/bin/env node
/**
 * Seed per-category Top clinics with the real contracted clinic only (Nahal).
 *
 *   node scripts/seed-category-top10.js
 *
 * On server with Mac-built better-sqlite3, use Docker:
 *   docker compose exec backend node scripts/seed-category-top10.js
 */
'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'leads.db');

const CATEGORIES = [
  'hair',
  'skin',
  'laser',
  'injection',
  'surgery',
  'slimming',
  'lasik',
  'femto-lasik',
  'prk',
];

/** Only the real contracted clinic. */
const CLINIC_IDS = [114];
const NAHAL_LINK = '/doctor/nahal-clinic';

function loadCatalog() {
  const code = fs.readFileSync(path.join(ROOT, 'data.min.js'), 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(`${code}\nthis.out = clinicsData;`, ctx);
  const map = new Map();
  for (const c of ctx.out || []) {
    if (c && c.id != null) map.set(Number(c.id), c);
  }
  return map;
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const catalog = loadCatalog();
const db = new Database(DB_PATH);
const now = new Date().toISOString();

const existingClicks = new Map();
try {
  for (const row of db
    .prepare('SELECT clinic_id, clicks FROM category_top_clinics')
    .all()) {
    existingClicks.set(Number(row.clinic_id), Number(row.clicks) || 0);
  }
} catch (_err) {
  /* table may be empty */
}

const tx = db.transaction(() => {
  for (const categoryId of CATEGORIES) {
    db.prepare('DELETE FROM category_top_clinics WHERE category_id = ?').run(
      categoryId
    );

    const insert = db.prepare(`
      INSERT INTO category_top_clinics (
        id, category_id, clinic_id, rank, name, tagline, image, link, badge,
        active, clicks, created_at
      ) VALUES (
        @id, @category_id, @clinic_id, @rank, @name, @tagline, @image, @link, @badge,
        1, @clicks, @created_at
      )
    `);

    CLINIC_IDS.forEach((clinicId, index) => {
      const clinic = catalog.get(clinicId) || {};
      const rank = index + 1;
      insert.run({
        id: uniqueId(`cat-${categoryId}-r${rank}`),
        category_id: categoryId,
        clinic_id: clinicId,
        rank,
        name: clinic.sliderTitle || clinic.name || 'کلینیک نهال',
        tagline: clinic.sliderTagline || 'کلینیک کاشت مو،پوست،لیزر و زیبایی',
        image: clinic.image || 'clinics/114/Hero.webp',
        link: NAHAL_LINK,
        badge: 'ویژه',
        clicks: existingClicks.get(clinicId) || 0,
        created_at: now,
      });
    });
  }
});

try {
  tx();
  console.log(`Seeded Top clinics for ${CATEGORIES.length} categories in ${DB_PATH}`);
  for (const categoryId of CATEGORIES) {
    const rows = db
      .prepare(
        'SELECT rank, clinic_id, name FROM category_top_clinics WHERE category_id = ? ORDER BY rank'
      )
      .all(categoryId);
    console.log(`\n[${categoryId}] ${rows.length} clinics:`);
    for (const row of rows) {
      console.log(`  ${row.rank}. ${row.name} (#${row.clinic_id})`);
    }
  }
} finally {
  db.close();
}
