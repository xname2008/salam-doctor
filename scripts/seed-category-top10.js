#!/usr/bin/env node
/**
 * Seed per-category Top 10 clinics: Nahal (#1) + sample clinics (#2–#10).
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

/** Rank 1 = Nahal, ranks 2–10 = samples with real images where possible */
const CLINIC_IDS = [114, 101, 104, 105, 115, 106, 107, 108, 112, 103];

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
const missing = CLINIC_IDS.filter((id) => !catalog.has(id));
if (missing.length) {
  console.error('Missing clinic ids in catalog:', missing.join(', '));
  process.exit(1);
}

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS category_top_clinics (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    clinic_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    name TEXT,
    tagline TEXT,
    image TEXT,
    link TEXT,
    badge TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    clicks INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_category_top_cat
    ON category_top_clinics (category_id, rank);
`);

const now = new Date().toISOString();

const tx = db.transaction(() => {
  for (const categoryId of CATEGORIES) {
    const existingClicks = new Map();
    for (const row of db
      .prepare(
        'SELECT clinic_id, clicks FROM category_top_clinics WHERE category_id = ?'
      )
      .all(categoryId)) {
      existingClicks.set(Number(row.clinic_id), row.clicks || 0);
    }

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
      const clinic = catalog.get(clinicId);
      const rank = index + 1;
      insert.run({
        id: uniqueId(`cat-${categoryId}-r${rank}`),
        category_id: categoryId,
        clinic_id: clinicId,
        rank,
        name: clinic.sliderTitle || clinic.name || null,
        tagline: clinic.sliderTagline || null,
        image: clinicId === 114 ? (clinic.image || null) : (clinic.image || 'images/sample-clinic-services.webp'),
        link: `/doctor/clinic-${clinicId}`,
        badge: clinicId === 114 ? 'ویژه' : null,
        clicks: existingClicks.get(clinicId) || 0,
        created_at: now,
      });
    });
  }
});

try {
  tx();
  console.log(`Seeded Top 10 for ${CATEGORIES.length} categories in ${DB_PATH}`);
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
