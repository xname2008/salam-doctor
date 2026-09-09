'use strict';

// Comprehensive scan + fix for "salam-doctor.ir" across EVERY text column in
// EVERY table of leads.db (SQLite) — not just ads/featured_clinics. Covers
// rich-text/body fields like articles.body_html and clinic_profiles.intro
// where an inline <a href="..."> could still point at the old domain.
//
// Run inside the backend container (leads.db is mounted at /app/leads.db):
//   docker cp scripts/scan-fix-old-domain-sqlite.js salam-doctor-backend:/app/tmp-scan.js
//   docker exec salam-doctor-backend node /app/tmp-scan.js
//   docker exec salam-doctor-backend rm -f /app/tmp-scan.js

const Database = require('better-sqlite3');

const DB_FILE = process.env.LEADS_DB_PATH || '/app/leads.db';
const OLD_DOMAIN = 'salam-doctor.ir';
const NEW_DOMAIN = 'salam-doctor.com';

const db = new Database(DB_FILE);

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((r) => r.name);

console.log(`Scanning ${DB_FILE} — ${tables.length} table(s) for "${OLD_DOMAIN}"...\n`);

let totalChanged = 0;
const hits = [];

for (const table of tables) {
  const cols = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .filter((c) => /TEXT|CHAR|CLOB/i.test(c.type || 'TEXT')); // TEXT-affinity columns only

  for (const { name: col } of cols) {
    let before;
    try {
      before = db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} LIKE '%' || ? || '%'`)
        .get(OLD_DOMAIN).n;
    } catch (_err) {
      continue; // skip columns that error on LIKE (shouldn't happen for TEXT affinity)
    }
    if (before > 0) hits.push({ table, col, before });
  }
}

if (!hits.length) {
  console.log('No references to the old domain found in any text column.');
} else {
  console.log('Found references:');
  for (const h of hits) console.log(`  ${h.table}.${h.col}: ${h.before} row(s)`);
  console.log('');

  for (const { table, col } of hits) {
    const info = db
      .prepare(`UPDATE ${table} SET ${col} = REPLACE(${col}, ?, ?) WHERE ${col} LIKE '%' || ? || '%'`)
      .run(OLD_DOMAIN, NEW_DOMAIN, OLD_DOMAIN);
    console.log(`  Fixed ${table}.${col}: ${info.changes} row(s)`);
    totalChanged += info.changes;
  }
  console.log(`\nTotal rows updated: ${totalChanged}`);
}

// Verify.
let remaining = 0;
for (const table of tables) {
  const cols = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .filter((c) => /TEXT|CHAR|CLOB/i.test(c.type || 'TEXT'));
  for (const { name: col } of cols) {
    try {
      remaining += db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} LIKE '%' || ? || '%'`)
        .get(OLD_DOMAIN).n;
    } catch (_err) {
      /* ignore */
    }
  }
}
console.log(
  remaining === 0
    ? 'Verification: no remaining references to the old domain anywhere in leads.db.'
    : `WARNING: ${remaining} reference(s) to the old domain still remain.`
);

db.close();
