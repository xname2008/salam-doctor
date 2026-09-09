'use strict';

/**
 * Rewrite legacy profile.html?id= links in SQLite to canonical /doctor/:slug.
 *
 *   node scripts/rewrite-legacy-profile-links.js
 *   node scripts/rewrite-legacy-profile-links.js --dry-run
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { clinicProfilePath, loadSlugFile, ensureCache } = require('../clinicSlug');

const ROOT = path.join(__dirname, '..');
const DB_FILE = process.env.LEADS_DB_PATH || path.join(ROOT, 'leads.db');
const dryRun = process.argv.includes('--dry-run');

function rewriteLink(link) {
  if (link == null) return null;
  const raw = String(link).trim();
  if (!raw) return null;

  const stripped = raw.replace(/^https?:\/\/[^/]+/i, '');
  const m = stripped.match(/profile\.html\?(?:[^#]*&)?(?:id|clinic_id)=(\d+)/i);
  if (m) {
    return clinicProfilePath(Number(m[1]));
  }

  // Fix missing leading slash on doctor paths
  if (/^doctor\//i.test(stripped)) {
    return '/' + stripped.replace(/^\/+/, '');
  }
  if (/^\/doctor\//i.test(stripped)) {
    return stripped.split('?')[0];
  }

  return null; // unchanged
}

function main() {
  ensureCache();
  if (!fs.existsSync(DB_FILE)) {
    console.error('DB not found:', DB_FILE);
    process.exit(1);
  }

  const db = new Database(DB_FILE);
  const tables = [
    { table: 'featured_clinics', col: 'link' },
    { table: 'ads', col: 'link' },
    { table: 'category_sliders', col: 'link' },
    { table: 'category_top_clinics', col: 'link' },
  ];

  let updated = 0;
  const tx = db.transaction(() => {
    for (const { table, col } of tables) {
      const exists = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(table);
      if (!exists) continue;

      const rows = db.prepare(`SELECT rowid AS rid, ${col} AS link FROM ${table}`).all();
      const stmt = db.prepare(`UPDATE ${table} SET ${col} = ? WHERE rowid = ?`);
      for (const row of rows) {
        const next = rewriteLink(row.link);
        if (!next || next === row.link) continue;
        console.log(`[${table}]`, row.link, '→', next);
        if (!dryRun) stmt.run(next, row.rid);
        updated += 1;
      }
    }
  });

  tx();
  db.close();
  console.log(
    dryRun
      ? `Dry-run: ${updated} link(s) would be updated. Slugs loaded: ${Object.keys(loadSlugFile()).length}`
      : `Updated ${updated} link(s) to /doctor/:slug`
  );
}

main();
