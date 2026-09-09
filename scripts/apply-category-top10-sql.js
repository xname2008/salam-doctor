#!/usr/bin/env node
/**
 * Apply scripts/seed-category-top10.sql using better-sqlite3.
 * Used by seed-category-top10-docker.sh inside the backend image.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');
const dbPath = process.env.DB_PATH || path.join(root, 'leads.db');
const sqlPath =
  process.env.SEED_SQL || path.join(__dirname, 'seed-category-top10.sql');

const sql = fs.readFileSync(sqlPath, 'utf8');
const db = new Database(dbPath);
try {
  db.exec(sql);
  const rows = db
    .prepare(
      'SELECT category_id, COUNT(*) AS n FROM category_top_clinics GROUP BY category_id ORDER BY category_id'
    )
    .all();
  console.log('Seeded Top 10 category clinics in', dbPath);
  for (const row of rows) console.log(`  ${row.category_id}: ${row.n}`);
} finally {
  db.close();
}
