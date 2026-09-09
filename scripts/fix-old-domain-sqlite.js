'use strict';

// Rewrites hardcoded old .ir domain -> new .com domain in the actual
// ad-banner and homepage-slider tables (SQLite leads.db), which is where
// this data really lives — NOT in the Postgres/Prisma database.
//
// Run inside the backend container (leads.db is mounted at /app/leads.db):
//   docker cp scripts/fix-old-domain-sqlite.js salam-doctor-backend:/tmp/fix-old-domain-sqlite.js
//   docker exec -it salam-doctor-backend node /tmp/fix-old-domain-sqlite.js

const Database = require('better-sqlite3');

const DB_FILE = process.env.LEADS_DB_PATH || '/app/leads.db';
const OLD_DOMAIN = 'salam-doctor.ir';
const NEW_DOMAIN = 'salam-doctor.com';

const TARGETS = [
  { table: 'ads', columns: ['link', 'image', 'image_mobile'] },
  { table: 'featured_clinics', columns: ['link', 'image'] },
];

const db = new Database(DB_FILE);

console.log(`Scanning ${DB_FILE} for "${OLD_DOMAIN}" in ad/slider columns...\n`);

let totalChanged = 0;

for (const { table, columns } of TARGETS) {
  const existingCols = new Set(
    db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  );

  for (const col of columns) {
    if (!existingCols.has(col)) continue;

    const before = db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} LIKE '%' || ? || '%'`)
      .get(OLD_DOMAIN).n;

    if (before === 0) {
      console.log(`  ${table}.${col}: no matches`);
      continue;
    }

    const info = db
      .prepare(`UPDATE ${table} SET ${col} = REPLACE(${col}, ?, ?) WHERE ${col} LIKE '%' || ? || '%'`)
      .run(OLD_DOMAIN, NEW_DOMAIN, OLD_DOMAIN);

    console.log(`  ${table}.${col}: fixed ${info.changes} row(s)`);
    totalChanged += info.changes;
  }
}

console.log(`\nTotal rows updated: ${totalChanged}`);

// Verify nothing was missed.
let remaining = 0;
for (const { table, columns } of TARGETS) {
  const existingCols = new Set(
    db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  );
  for (const col of columns) {
    if (!existingCols.has(col)) continue;
    remaining += db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} LIKE '%' || ? || '%'`)
      .get(OLD_DOMAIN).n;
  }
}
console.log(
  remaining === 0
    ? 'Verification: no remaining references to the old domain.'
    : `WARNING: ${remaining} reference(s) to the old domain still remain.`
);

db.close();
