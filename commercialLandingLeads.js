'use strict';

const crypto = require('crypto');

const IR_MOBILE_RE = /^09\d{9}$/;
const MAX_NAME = 120;
const MAX_SERVICE = 200;
const MAX_DESC = 2000;

function nowIso() {
  return new Date().toISOString();
}

function uniqueId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function normalizePersianDigits(value) {
  return String(value || '')
    .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
}

function normalizePhone(raw) {
  let phone = normalizePersianDigits(raw).replace(/[^\d+]/g, '');
  if (phone.startsWith('+')) phone = phone.slice(1);
  if (phone.startsWith('0098')) phone = phone.slice(4);
  else if (phone.startsWith('98') && phone.length >= 12) phone = phone.slice(2);
  if (phone.startsWith('9') && phone.length === 10) phone = '0' + phone;
  return phone;
}

function pickUtm(data) {
  const src = data && typeof data.utm === 'object' ? data.utm : data;
  if (!src || typeof src !== 'object') return {};
  const out = {};
  for (const key of [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
  ]) {
    const val = src[key];
    if (typeof val === 'string' && val.trim()) out[key] = val.trim().slice(0, 255);
  }
  return out;
}

/**
 * Validate landing lead payload.
 * @returns {{ ok: true, lead: object } | { ok: false, status: number, error: string, fields?: object }}
 */
function validateLandingLead(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, status: 400, error: 'Invalid JSON body' };
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const service = typeof data.service === 'string' ? data.service.trim() : '';
  const desc = typeof data.desc === 'string' ? data.desc.trim() : '';
  const phone = normalizePhone(data.phone);
  const utm = pickUtm(data);
  const clinicId = data.clinicId != null ? Number(data.clinicId) : null;
  const packageSlug =
    typeof data.packageSlug === 'string' ? data.packageSlug.trim().slice(0, 80) : null;
  const landingPath =
    typeof data.landingPath === 'string' ? data.landingPath.trim().slice(0, 255) : null;

  const fields = {};

  if (!name) fields.name = 'required';
  else if (name.length > MAX_NAME) fields.name = 'too_long';

  if (!service) fields.service = 'required';
  else if (service.length > MAX_SERVICE) fields.service = 'too_long';

  if (!phone) fields.phone = 'required';
  else if (!IR_MOBILE_RE.test(phone)) fields.phone = 'invalid_format';

  if (desc.length > MAX_DESC) fields.desc = 'too_long';

  if (Object.keys(fields).length) {
    return {
      ok: false,
      status: 422,
      error: 'Validation failed',
      fields,
    };
  }

  return {
    ok: true,
    lead: {
      id: uniqueId(),
      timestamp: nowIso(),
      name,
      phone,
      service,
      desc: desc || null,
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      utm_term: utm.utm_term || null,
      utm_content: utm.utm_content || null,
      clinic_id: Number.isFinite(clinicId) ? clinicId : null,
      landing_path: landingPath,
      package_slug: packageSlug,
    },
  };
}

/**
 * Persist lead into SQLite leads.db (with optional UTM columns).
 */
function insertLandingLead(db, lead) {
  const cols = db.prepare('PRAGMA table_info(leads)').all().map((c) => c.name);
  const hasUtm = cols.includes('utm_source');

  if (hasUtm) {
    const hasSyncCols = cols.includes('is_synced');
    if (hasSyncCols) {
      db.prepare(
        `INSERT INTO leads (
          id, timestamp, name, phone, service, desc,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          clinic_id, landing_path, package_slug, is_synced, is_confirmed
        ) VALUES (
          @id, @timestamp, @name, @phone, @service, @desc,
          @utm_source, @utm_medium, @utm_campaign, @utm_term, @utm_content,
          @clinic_id, @landing_path, @package_slug, 0, 1
        )`
      ).run(lead);
    } else {
      db.prepare(
        `INSERT INTO leads (
          id, timestamp, name, phone, service, desc,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          clinic_id, landing_path, package_slug
        ) VALUES (
          @id, @timestamp, @name, @phone, @service, @desc,
          @utm_source, @utm_medium, @utm_campaign, @utm_term, @utm_content,
          @clinic_id, @landing_path, @package_slug
        )`
      ).run(lead);
    }
  } else {
    const meta = {
      clinic_id: lead.clinic_id,
      landing_path: lead.landing_path,
      package_slug: lead.package_slug,
      utm: {
        utm_source: lead.utm_source,
        utm_medium: lead.utm_medium,
        utm_campaign: lead.utm_campaign,
        utm_term: lead.utm_term,
        utm_content: lead.utm_content,
      },
    };
    const descWithMeta = lead.desc
      ? `${lead.desc}\n---\n${JSON.stringify(meta)}`
      : JSON.stringify(meta);
    db.prepare('INSERT INTO leads VALUES (@id, @timestamp, @name, @phone, @service, @desc)').run({
      id: lead.id,
      timestamp: lead.timestamp,
      name: lead.name,
      phone: lead.phone,
      service: lead.service,
      desc: descWithMeta,
    });
  }
}

function ensureLeadsTrackingColumns(db) {
  const cols = new Set(db.prepare('PRAGMA table_info(leads)').all().map((c) => c.name));
  const migrations = [
    ['utm_source', 'TEXT'],
    ['utm_medium', 'TEXT'],
    ['utm_campaign', 'TEXT'],
    ['utm_term', 'TEXT'],
    ['utm_content', 'TEXT'],
    ['clinic_id', 'INTEGER'],
    ['landing_path', 'TEXT'],
    ['package_slug', 'TEXT'],
    ['is_synced', 'INTEGER NOT NULL DEFAULT 0'],
    ['is_confirmed', 'INTEGER NOT NULL DEFAULT 1'],
    ['sync_error', 'TEXT'],
    ['synced_at', 'TEXT'],
  ];
  for (const [col, type] of migrations) {
    if (!cols.has(col)) db.exec(`ALTER TABLE leads ADD COLUMN ${col} ${type}`);
  }
}

module.exports = {
  validateLandingLead,
  insertLandingLead,
  ensureLeadsTrackingColumns,
  normalizePhone,
  IR_MOBILE_RE,
};
