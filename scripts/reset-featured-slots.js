#!/usr/bin/env node
/**
 * Reset featured clinics to the real contracted clinic only (Nahal).
 *
 * On the server, node_modules is often Mac-built — use Docker instead:
 *   bash scripts/reset-featured-slots-docker.sh
 *
 * Or after `npm rebuild better-sqlite3` on Linux:
 *   node scripts/reset-featured-slots.js
 */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'leads.db');

const SLOTS = [
  {
    rank: 1,
    id: 'nahal-clinic-featured',
    name: 'کلینیک نهال',
    tagline: 'کلینیک کاشت مو،پوست،لیزر و زیبایی',
    image: 'clinics/114/Hero.webp',
    link: '/doctor/nahal-clinic',
    badge: 'ویژه',
  },
];

const slotIds = SLOTS.map((s) => s.id);
const now = new Date().toISOString();

const db = new Database(DB_PATH);
try {
  const deactivate = db.prepare(`
    UPDATE featured_clinics SET active = 0
    WHERE rank BETWEEN 1 AND 5 AND id NOT IN (${slotIds.map(() => '?').join(', ')})
  `);
  const deactivated = deactivate.run(...slotIds).changes;

  const update = db.prepare(`
    UPDATE featured_clinics SET
      rank = @rank, name = @name, tagline = @tagline, image = @image,
      link = @link, badge = @badge, active = 1
    WHERE id = @id
  `);
  const insert = db.prepare(`
    INSERT INTO featured_clinics (id, rank, name, tagline, image, link, badge, active, clicks, created_at)
    VALUES (@id, @rank, @name, @tagline, @image, @link, @badge, 1, 0, @created_at)
  `);

  let updated = 0;
  let inserted = 0;
  for (const slot of SLOTS) {
    const row = { ...slot, created_at: now };
    const result = update.run(row);
    if (result.changes) updated += 1;
    else {
      insert.run(row);
      inserted += 1;
    }
  }

  // Deactivate any remaining fixture / non-Nahal featured rows.
  const fixtureOff = db
    .prepare(
      `UPDATE featured_clinics SET active = 0
       WHERE active = 1 AND id != 'nahal-clinic-featured'
         AND (link LIKE '%/doctor/%' AND link NOT LIKE '%/doctor/nahal-clinic%')`
    )
    .run().changes;

  console.log(
    JSON.stringify({ deactivated, updated, inserted, fixtureOff, slots: SLOTS.length }, null, 2)
  );
} finally {
  db.close();
}
