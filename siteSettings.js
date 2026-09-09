/**
 * Central site phone / contact settings (support + sales).
 */
'use strict';

const DEFAULTS = {
  support_phone: '09007000462',
  support_phone_display: '۰۹۰۰۷۰۰۰۴۶۲',
  sales_phone: '09007000462',
  sales_phone_display: '۰۹۰۰۷۰۰۰۴۶۲',
};

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function toFaDigits(value) {
  return String(value == null ? '' : value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

function toEnDigits(value) {
  return String(value == null ? '' : value)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizePhone(raw) {
  let digits = toEnDigits(raw).replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('+98')) digits = '0' + digits.slice(3);
  if (digits.startsWith('98') && digits.length >= 12) digits = '0' + digits.slice(2);
  if (digits.startsWith('9') && digits.length === 10) digits = '0' + digits;
  if (!/^09\d{9}$/.test(digits)) return null;
  return digits;
}

function toTelHref(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return 'tel:+989007000462';
  return 'tel:+98' + normalized.slice(1);
}

function displayPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return DEFAULTS.support_phone_display;
  return toFaDigits(normalized);
}

function ensureSiteSettingsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
  `);
  insert.run('support_phone', DEFAULTS.support_phone, now);
  insert.run('sales_phone', DEFAULTS.sales_phone, now);
}

function readSettings(db) {
  ensureSiteSettingsTable(db);
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const map = {};
  for (const row of rows) map[row.key] = row.value;
  const support = normalizePhone(map.support_phone) || DEFAULTS.support_phone;
  const sales = normalizePhone(map.sales_phone) || DEFAULTS.sales_phone;
  return {
    support_phone: support,
    support_phone_display: displayPhone(support),
    support_tel: toTelHref(support),
    sales_phone: sales,
    sales_phone_display: displayPhone(sales),
    sales_tel: toTelHref(sales),
  };
}

function writeSettings(db, payload) {
  ensureSiteSettingsTable(db);
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO site_settings (key, value, updated_at) VALUES (@key, @value, @updated_at)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const support = normalizePhone(payload.support_phone);
  const sales = normalizePhone(payload.sales_phone);
  if (!support) {
    const err = new Error('support_phone must be a valid Iranian mobile (09xxxxxxxxx)');
    err.statusCode = 400;
    throw err;
  }
  if (!sales) {
    const err = new Error('sales_phone must be a valid Iranian mobile (09xxxxxxxxx)');
    err.statusCode = 400;
    throw err;
  }
  const tx = db.transaction(() => {
    upsert.run({ key: 'support_phone', value: support, updated_at: now });
    upsert.run({ key: 'sales_phone', value: sales, updated_at: now });
  });
  tx();
  return readSettings(db);
}

function createSiteSettingsHandlers(deps) {
  const { openDb, sendJson, readJsonBody } = deps;

  function handleGetPublic(res, method) {
    const db = openDb();
    try {
      sendJson(res, 200, readSettings(db), method);
    } catch (err) {
      console.error('site settings get:', err);
      sendJson(res, 500, { error: 'Failed to load site settings' }, method);
    } finally {
      db.close();
    }
  }

  function handleGetAdmin(res, method) {
    handleGetPublic(res, method);
  }

  async function handlePutAdmin(req, res) {
    const data = await readJsonBody(req);
    const db = openDb();
    try {
      const saved = writeSettings(db, data || {});
      sendJson(res, 200, saved);
    } catch (err) {
      const status = err.statusCode || 500;
      sendJson(res, status, { error: err.message || 'Failed to save site settings' });
    } finally {
      db.close();
    }
  }

  function tryHandle(req, res, pathname, method) {
    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/site-settings') {
      handleGetPublic(res, method);
      return true;
    }
    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/admin/site-settings') {
      handleGetAdmin(res, method);
      return true;
    }
    if (method === 'PUT' && pathname === '/api/admin/site-settings') {
      handlePutAdmin(req, res);
      return true;
    }
    return false;
  }

  return { tryHandle, readSettings, ensureSiteSettingsTable };
}

module.exports = {
  createSiteSettingsHandlers,
  ensureSiteSettingsTable,
  readSettings,
  writeSettings,
  DEFAULTS,
  toTelHref,
  displayPhone,
  normalizePhone,
};
