'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT, 'leads.db');
const INTRO_FILE = path.join(__dirname, 'nahal-profile-intro.html');
const STATIC_FILE = path.join(ROOT, 'clinic-intros', '114.html');
const CLINIC_ID = 114;

const intro = fs.readFileSync(INTRO_FILE, 'utf8').trim();
const updatedAt = new Date().toISOString();

fs.mkdirSync(path.dirname(STATIC_FILE), { recursive: true });
fs.writeFileSync(STATIC_FILE, intro + '\n', 'utf8');

const db = new Database(DB_FILE);
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clinic_profiles (
      clinic_id INTEGER PRIMARY KEY,
      intro TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `);

  db.prepare(`
    INSERT INTO clinic_profiles (clinic_id, intro, updated_at)
    VALUES (@clinic_id, @intro, @updated_at)
    ON CONFLICT(clinic_id) DO UPDATE SET
      intro = excluded.intro,
      updated_at = excluded.updated_at
  `).run({ clinic_id: CLINIC_ID, intro, updated_at: updatedAt });

  const row = db.prepare('SELECT length(intro) AS len, updated_at FROM clinic_profiles WHERE clinic_id = ?').get(CLINIC_ID);
  console.log('Nahal profile (id=114) patched.');
  console.log('  intro length:', row.len);
  console.log('  updated_at:', row.updated_at);
  console.log('  static file:', STATIC_FILE);
} finally {
  db.close();
}
