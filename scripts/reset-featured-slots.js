#!/usr/bin/env node
/**
 * Reset the top-5 featured clinics to canonical /doctor/:slug links.
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
  { rank: 1, id: 'nahal-clinic-featured', name: 'کلینیک نهال', tagline: 'کلینیک کاشت مو،پوست،لیزر و زیبایی', image: 'clinics/114/Hero.webp', link: '/doctor/nahal-clinic', badge: 'ویژه' },
  { rank: 2, id: 'featured-slot-2', name: 'Shiraz Sample Clinic 1', tagline: 'کلینیک تخصصی پوست و مو', image: 'images/sample-clinic-services.webp', link: '/doctor/sample-clinic-1', badge: null },
  { rank: 3, id: 'featured-slot-3', name: 'Shiraz Sample Clinic 4', tagline: 'کلینیک زیبایی و کاشت مو', image: 'images/sample-clinic-services.webp', link: '/doctor/sample-clinic-4', badge: null },
  { rank: 4, id: 'featured-slot-4', name: 'Shiraz Sample Clinic 5', tagline: 'کلینیک زیبایی و کاشت مو', image: 'images/sample-clinic-services.webp', link: '/doctor/sample-clinic-5', badge: null },
  { rank: 5, id: 'featured-slot-5', name: 'Shiraz Sample Clinic 14', tagline: 'کلینیک کاشت مو،پوست،لیزر و زیبایی', image: 'images/sample-clinic-services.webp', link: '/doctor/sample-clinic-14', badge: null },
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
    INSERT INTO featured_clinics (
      id, rank, name, tagline, phone, address, image, link, badge,
      active, starts_at, ends_at, clicks, created_at
    ) VALUES (
      @id, @rank, @name, @tagline, '', '', @image, @link, @badge,
      1, NULL, NULL, 0, @created_at
    )
  `);

  for (const slot of SLOTS) {
    const exists = db.prepare('SELECT id FROM featured_clinics WHERE id = ?').get(slot.id);
    const payload = { ...slot, created_at: now };
    if (exists) update.run(payload);
    else insert.run(payload);
  }

  const active = db.prepare(`
    SELECT rank, id, name, link FROM featured_clinics
    WHERE active = 1 AND rank BETWEEN 1 AND 5
    ORDER BY rank
  `).all();

  console.log('Deactivated non-canonical rows:', deactivated);
  console.log('Active top-5 featured clinics:');
  for (const row of active) {
    console.log(`  ${row.rank}. ${row.name} → ${row.link} (${row.id})`);
  }
} finally {
  db.close();
}
