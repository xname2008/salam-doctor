/**
 * Per-category slider slides + Top Clinics (up to 10) (SQLite / leads.db).
 * Category ids match category.html?type= slugs: hair, skin, laser, …
 */
'use strict';

let clinicProfilePath;
try {
  ({ clinicProfilePath } = require('./clinicSlug'));
} catch (_err) {
  clinicProfilePath = function clinicProfilePathFallback(clinicOrId) {
    const id =
      clinicOrId && typeof clinicOrId === 'object'
        ? Number(clinicOrId.id != null ? clinicOrId.id : clinicOrId.clinic_id)
        : Number(clinicOrId);
    return Number.isInteger(id) && id > 0 ? `/doctor/clinic-${id}` : '/';
  };
}

const TOP_CLINICS_LIMIT = 10;

const CATEGORY_DEFS = [
  { id: 'hair', label: 'کاشت مو و ابرو', labelEn: 'Hair' },
  { id: 'skin', label: 'جوانسازی و پوست', labelEn: 'Skin' },
  { id: 'laser', label: 'لیزر موهای زائد', labelEn: 'Laser' },
  { id: 'injection', label: 'تزریقات زیبایی', labelEn: 'Injection' },
  { id: 'surgery', label: 'جراحی زیبایی', labelEn: 'Surgery' },
  { id: 'slimming', label: 'لاغری و پیکرتراشی', labelEn: 'Slimming' },
  { id: 'lasik', label: 'لیزیک', labelEn: 'LASIK' },
  { id: 'femto-lasik', label: 'فمتولیزیک', labelEn: 'Femto-LASIK' },
  { id: 'prk', label: 'پی‌آر‌کی', labelEn: 'PRK' },
  { id: 'products', label: 'محصولات زیبایی', labelEn: 'Products' },
  { id: 'pharmacy', label: 'داروخانه', labelEn: 'Pharmacy' },
];

const CATEGORY_IDS = new Set(CATEGORY_DEFS.map((c) => c.id));

function normalizeCategoryId(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase();
  return CATEGORY_IDS.has(id) ? id : null;
}

function ensureCategoryTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS category_sliders (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      image TEXT NOT NULL,
      title TEXT,
      link TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

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

    CREATE INDEX IF NOT EXISTS idx_category_sliders_cat
      ON category_sliders (category_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_category_top_cat
      ON category_top_clinics (category_id, rank);
  `);
}

function publicSlideRow(row) {
  return {
    id: row.id,
    image: row.image,
    title: row.title || null,
    link: row.link || null,
    sort_order: row.sort_order,
  };
}

function pickKeyServices(clinic, limit) {
  const max = Number.isInteger(limit) && limit > 0 ? limit : 4;
  if (!clinic || !Array.isArray(clinic.services)) return [];
  return clinic.services
    .map((s) => {
      if (typeof s === 'string') return s.trim();
      if (s && typeof s === 'object') {
        return String(s.label || s.name || '').trim();
      }
      return '';
    })
    .filter((s) => s && s !== 'دارد')
    .slice(0, max);
}

  function enrichTopClinic(row, catalogById) {
  const clinic = catalogById.get(Number(row.clinic_id)) || null;
  const clinicId = Number(row.clinic_id);
  const name =
    (row.name && String(row.name).trim()) ||
    (clinic && (clinic.sliderTitle || clinic.name)) ||
    `مرکز ${row.clinic_id}`;
  const tagline =
    (row.tagline && String(row.tagline).trim()) ||
    (clinic && clinic.sliderTagline) ||
    null;
  // Catalog is source of truth for sample images; keep Nahal's dedicated hero.
  const image =
    clinicId === 114
      ? (row.image && String(row.image).trim()) ||
        (clinic && clinic.image) ||
        'clinics/114/Hero.webp'
      : (clinic && clinic.image) ||
        (row.image && String(row.image).trim()) ||
        'images/sample-clinic-services.webp';
  const link = clinicProfilePath(row.clinic_id);
  return {
    id: row.id,
    category_id: row.category_id,
    clinic_id: clinicId,
    rank: Number(row.rank),
    name,
    tagline,
    image,
    link,
    badge: row.badge || null,
    services: pickKeyServices(clinic, 4),
    clicks: row.clicks || 0,
    active: row.active ? 1 : 0,
  };
}

function buildCatalogMap(loadClinicsData) {
  const map = new Map();
  for (const c of loadClinicsData()) {
    if (c && c.id != null) map.set(Number(c.id), c);
  }
  return map;
}

function createCategoryMonetizeHandlers(deps) {
  const {
    openDb,
    sendJson,
    readJsonBody,
    uniqueId,
    trimOrNull,
    nowIso,
    getSearchParams,
    sendRedirect,
    normalizeFeaturedLink,
    loadClinicsData,
  } = deps;

  function handleListCategories(_req, res, method) {
    sendJson(res, 200, CATEGORY_DEFS, method);
  }

  function handleGetSlider(categoryId, res, method, { admin }) {
    const cat = normalizeCategoryId(categoryId);
    if (!cat) {
      sendJson(res, 404, { error: 'Unknown category' }, method);
      return;
    }
    const db = openDb();
    try {
      const sql = admin
        ? `SELECT * FROM category_sliders WHERE category_id = ? ORDER BY sort_order ASC, created_at ASC`
        : `SELECT * FROM category_sliders WHERE category_id = ? AND active = 1 ORDER BY sort_order ASC, created_at ASC`;
      const rows = db.prepare(sql).all(cat);
      const payload = admin
        ? rows
        : rows.map(publicSlideRow);
      sendJson(res, 200, payload, method);
    } catch (err) {
      console.error('category slider GET:', err);
      sendJson(res, 500, { error: 'Failed to read slider' }, method);
    } finally {
      db.close();
    }
  }

  function handleGetTop5(categoryId, res, method, { admin }) {
    const cat = normalizeCategoryId(categoryId);
    if (!cat) {
      sendJson(res, 404, { error: 'Unknown category' }, method);
      return;
    }
    const db = openDb();
    try {
      const sql = admin
        ? `SELECT * FROM category_top_clinics WHERE category_id = ? ORDER BY rank ASC LIMIT ?`
        : `SELECT * FROM category_top_clinics WHERE category_id = ? AND active = 1 ORDER BY rank ASC LIMIT ?`;
      const rows = db.prepare(sql).all(cat, TOP_CLINICS_LIMIT);
      const catalog = buildCatalogMap(loadClinicsData);
      const enriched = rows.map((row) => enrichTopClinic(row, catalog));
      const payload = admin
        ? enriched
        : enriched.map(({ clicks, active, ...pub }) => pub);
      sendJson(res, 200, payload, method);
    } catch (err) {
      console.error('category top5 GET:', err);
      sendJson(res, 500, { error: 'Failed to read top5' }, method);
    } finally {
      db.close();
    }
  }

  function handleTop5Click(categoryId, req, res) {
    const method = req.method || 'GET';
    const cat = normalizeCategoryId(categoryId);
    const params = getSearchParams(req.url);
    const rawId = params.get('id');
    const noRedirect =
      params.get('noredirect') === '1' ||
      params.get('track') === '1' ||
      method === 'POST';
    const id = (() => {
      const s = trimOrNull(rawId);
      if (!s) return null;
      const lower = s.toLowerCase();
      if (lower === 'undefined' || lower === 'null' || lower === 'nan') return null;
      return s;
    })();
    if (!cat || !id) {
      if (noRedirect) {
        res.writeHead(204, { 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
      sendRedirect(res, '/', method);
      return;
    }
    let db;
    try {
      db = openDb();
      const row = db
        .prepare(
          'SELECT id, link, clinic_id FROM category_top_clinics WHERE id = ? AND category_id = ?'
        )
        .get(id, cat);
      if (row) {
        db.prepare('UPDATE category_top_clinics SET clicks = clicks + 1 WHERE id = ?').run(id);
        if (noRedirect) {
          res.writeHead(204, {
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          });
          res.end();
          return;
        }
        const dest = clinicProfilePath(row.clinic_id);
        sendRedirect(res, dest, method);
        return;
      }
      if (noRedirect) {
        res.writeHead(204, { 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
      sendRedirect(res, '/', method);
    } catch (err) {
      console.error('category top5 click:', err);
      if (!res.headersSent) {
        if (noRedirect) {
          res.writeHead(204, { 'Cache-Control': 'no-store' });
          res.end();
        } else {
          sendRedirect(res, '/', method);
        }
      }
    } finally {
      if (db) db.close();
    }
  }

  async function handlePutSlider(categoryId, req, res) {
    const cat = normalizeCategoryId(categoryId);
    if (!cat) {
      sendJson(res, 404, { error: 'Unknown category' });
      return;
    }
    const data = await readJsonBody(req, res);
    if (!data) return;
    const slides = Array.isArray(data.slides) ? data.slides : null;
    if (!slides) {
      sendJson(res, 400, { error: 'Body must include slides: []' });
      return;
    }

    const db = openDb();
    try {
      const tx = db.transaction(() => {
        db.prepare('DELETE FROM category_sliders WHERE category_id = ?').run(cat);
        const insert = db.prepare(`
          INSERT INTO category_sliders (
            id, category_id, image, title, link, sort_order, active, created_at
          ) VALUES (
            @id, @category_id, @image, @title, @link, @sort_order, @active, @created_at
          )
        `);
        slides.forEach((slide, index) => {
          const image = trimOrNull(slide.image);
          if (!image) return;
          insert.run({
            id: trimOrNull(slide.id) || uniqueId(),
            category_id: cat,
            image,
            title: trimOrNull(slide.title),
            link: trimOrNull(slide.link),
            sort_order:
              Number.isFinite(Number(slide.sort_order)) ? Number(slide.sort_order) : index,
            active: slide.active === 0 || slide.active === false ? 0 : 1,
            created_at: nowIso(),
          });
        });
      });
      tx();
      const rows = db
        .prepare(
          'SELECT * FROM category_sliders WHERE category_id = ? ORDER BY sort_order ASC, created_at ASC'
        )
        .all(cat);
      sendJson(res, 200, { success: true, slides: rows });
    } catch (err) {
      console.error('category slider PUT:', err);
      sendJson(res, 500, { error: 'Failed to save slider' });
    } finally {
      db.close();
    }
  }

  async function handlePostSlide(categoryId, req, res) {
    const cat = normalizeCategoryId(categoryId);
    if (!cat) {
      sendJson(res, 404, { error: 'Unknown category' });
      return;
    }
    const data = await readJsonBody(req, res);
    if (!data) return;
    const image = trimOrNull(data.image);
    if (!image) {
      sendJson(res, 400, { error: 'Missing required field: image' });
      return;
    }
    const db = openDb();
    try {
      const maxRow = db
        .prepare(
          'SELECT MAX(sort_order) AS m FROM category_sliders WHERE category_id = ?'
        )
        .get(cat);
      const sortOrder =
        Number.isFinite(Number(data.sort_order))
          ? Number(data.sort_order)
          : (maxRow && maxRow.m != null ? Number(maxRow.m) + 1 : 0);
      const id = trimOrNull(data.id) || uniqueId();
      db.prepare(`
        INSERT INTO category_sliders (
          id, category_id, image, title, link, sort_order, active, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        cat,
        image,
        trimOrNull(data.title),
        trimOrNull(data.link),
        sortOrder,
        data.active === 0 || data.active === false ? 0 : 1,
        nowIso()
      );
      const row = db.prepare('SELECT * FROM category_sliders WHERE id = ?').get(id);
      sendJson(res, 200, { success: true, slide: row });
    } catch (err) {
      console.error('category slider POST:', err);
      sendJson(res, 500, { error: 'Failed to add slide' });
    } finally {
      db.close();
    }
  }

  function handleDeleteSlide(categoryId, req, res) {
    const cat = normalizeCategoryId(categoryId);
    const id = trimOrNull(getSearchParams(req.url).get('id'));
    if (!cat) {
      sendJson(res, 404, { error: 'Unknown category' });
      return;
    }
    if (!id) {
      sendJson(res, 400, { error: 'Missing id' });
      return;
    }
    const db = openDb();
    try {
      const result = db
        .prepare('DELETE FROM category_sliders WHERE id = ? AND category_id = ?')
        .run(id, cat);
      if (!result.changes) {
        sendJson(res, 404, { error: 'Slide not found' });
        return;
      }
      sendJson(res, 200, { success: true });
    } catch (err) {
      console.error('category slider DELETE:', err);
      sendJson(res, 500, { error: 'Failed to delete slide' });
    } finally {
      db.close();
    }
  }

  async function handlePutTop5(categoryId, req, res) {
    const cat = normalizeCategoryId(categoryId);
    if (!cat) {
      sendJson(res, 404, { error: 'Unknown category' });
      return;
    }
    const data = await readJsonBody(req, res);
    if (!data) return;
    const clinics = Array.isArray(data.clinics) ? data.clinics : null;
    if (!clinics) {
      sendJson(res, 400, { error: 'Body must include clinics: []' });
      return;
    }
    if (clinics.length > TOP_CLINICS_LIMIT) {
      sendJson(res, 400, {
        error: `At most ${TOP_CLINICS_LIMIT} clinics allowed per category`,
      });
      return;
    }

    const catalog = buildCatalogMap(loadClinicsData);
    const ranks = new Set();
    const normalized = [];
    for (const item of clinics) {
      const clinicId = Number(item.clinic_id);
      const rank = Number(item.rank);
      if (!Number.isInteger(clinicId) || clinicId <= 0) {
        sendJson(res, 400, { error: 'Invalid clinic_id' });
        return;
      }
      if (!Number.isInteger(rank) || rank < 1 || rank > TOP_CLINICS_LIMIT) {
        sendJson(res, 400, {
          error: `rank must be an integer from 1 to ${TOP_CLINICS_LIMIT}`,
        });
        return;
      }
      if (ranks.has(rank)) {
        sendJson(res, 400, { error: `Duplicate rank: ${rank}` });
        return;
      }
      ranks.add(rank);
      if (!catalog.has(clinicId)) {
        sendJson(res, 400, { error: `Unknown clinic_id: ${clinicId}` });
        return;
      }
      normalized.push({
        clinic_id: clinicId,
        rank,
        name: trimOrNull(item.name),
        tagline: trimOrNull(item.tagline),
        image: trimOrNull(item.image),
        link:
          normalizeFeaturedLink(item.link) ||
          clinicProfilePath(clinicId),
        badge: trimOrNull(item.badge),
        active: item.active === 0 || item.active === false ? 0 : 1,
      });
    }

    const db = openDb();
    try {
      const existingClicks = new Map();
      for (const row of db
        .prepare('SELECT clinic_id, clicks FROM category_top_clinics WHERE category_id = ?')
        .all(cat)) {
        existingClicks.set(Number(row.clinic_id), row.clicks || 0);
      }

      const tx = db.transaction(() => {
        db.prepare('DELETE FROM category_top_clinics WHERE category_id = ?').run(cat);
        const insert = db.prepare(`
          INSERT INTO category_top_clinics (
            id, category_id, clinic_id, rank, name, tagline, image, link, badge,
            active, clicks, created_at
          ) VALUES (
            @id, @category_id, @clinic_id, @rank, @name, @tagline, @image, @link, @badge,
            @active, @clicks, @created_at
          )
        `);
        for (const item of normalized) {
          insert.run({
            id: uniqueId(),
            category_id: cat,
            clinic_id: item.clinic_id,
            rank: item.rank,
            name: item.name,
            tagline: item.tagline,
            image: item.image,
            link: item.link,
            badge: item.badge,
            active: item.active,
            clicks: existingClicks.get(item.clinic_id) || 0,
            created_at: nowIso(),
          });
        }
      });
      tx();

      const rows = db
        .prepare(
          'SELECT * FROM category_top_clinics WHERE category_id = ? ORDER BY rank ASC'
        )
        .all(cat)
        .map((row) => enrichTopClinic(row, catalog));
      sendJson(res, 200, { success: true, clinics: rows });
    } catch (err) {
      console.error('category top5 PUT:', err);
      sendJson(res, 500, { error: 'Failed to save top5' });
    } finally {
      db.close();
    }
  }

  /**
   * Route helper: match /api/categories/:id/(slider|top5)[/click]
   * and /api/admin/categories/:id/(slider|top5)
   */
  async function tryHandle(req, res, pathname, method) {
    let m = pathname.match(/^\/api\/categories\/([^/]+)\/(slider|top5)(?:\/(click))?$/);
    if (m) {
      const categoryId = m[1];
      const resource = m[2];
      const action = m[3] || null;

      if (resource === 'slider' && (method === 'GET' || method === 'HEAD') && !action) {
        handleGetSlider(categoryId, res, method, { admin: false });
        return true;
      }
      if (resource === 'top5' && (method === 'GET' || method === 'HEAD') && !action) {
        handleGetTop5(categoryId, res, method, { admin: false });
        return true;
      }
      if (resource === 'top5' && action === 'click' && (method === 'GET' || method === 'HEAD')) {
        handleTop5Click(categoryId, req, res);
        return true;
      }
      return false;
    }

    if (pathname === '/api/admin/categories' && method === 'GET') {
      handleListCategories(req, res, method);
      return true;
    }

    m = pathname.match(/^\/api\/admin\/categories\/([^/]+)\/(slider|top5)$/);
    if (!m) return false;

    const categoryId = m[1];
    const resource = m[2];

    if (resource === 'slider') {
      if (method === 'GET') {
        handleGetSlider(categoryId, res, method, { admin: true });
        return true;
      }
      if (method === 'PUT') {
        await handlePutSlider(categoryId, req, res);
        return true;
      }
      if (method === 'POST') {
        await handlePostSlide(categoryId, req, res);
        return true;
      }
      if (method === 'DELETE') {
        handleDeleteSlide(categoryId, req, res);
        return true;
      }
    }

    if (resource === 'top5') {
      if (method === 'GET') {
        handleGetTop5(categoryId, res, method, { admin: true });
        return true;
      }
      if (method === 'PUT') {
        await handlePutTop5(categoryId, req, res);
        return true;
      }
    }

    return false;
  }

  return { tryHandle, CATEGORY_DEFS, ensureCategoryTables, normalizeCategoryId };
}

module.exports = {
  CATEGORY_DEFS,
  CATEGORY_IDS,
  normalizeCategoryId,
  ensureCategoryTables,
  createCategoryMonetizeHandlers,
};
