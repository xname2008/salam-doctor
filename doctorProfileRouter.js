'use strict';

/**
 * Express app for SEO doctor profile URLs.
 *
 *   GET /doctor/:slug              serve profile (or 301 to canonical)
 *   GET /profile.html?id=:id       301 → /doctor/:slug
 *
 * IMPORTANT: Mount this router BEFORE any express.static / wildcard / 404
 * handlers so extensionless /doctor/:slug paths are never intercepted.
 */

const express = require('express');
const {
  idFromSlug,
  slugForClinic,
  isCanonicalSlug,
  ensureCache,
  canonicalDoctorPath,
} = require('./clinicSlug');

function parseLegacyId(req) {
  const raw = String((req.query && (req.query.id || req.query.clinic_id)) || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === 'undefined' || lower === 'null' || lower === 'nan') return null;
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function decodeSlugParam(raw) {
  const value = String(raw == null ? '' : raw).trim();
  if (!value) return '';
  try {
    return decodeURIComponent(value).trim();
  } catch (_err) {
    return value;
  }
}

function normalizeSlugKey(raw) {
  return decodeSlugParam(raw).toLowerCase();
}

function redirect301(res, location) {
  return res.redirect(301, location);
}

/**
 * Resolve clinic id: JSON/redirect cache, then case-insensitive DB slug lookup.
 */
async function resolveClinicIdFromSlug(slug, findClinicIdBySlug) {
  ensureCache();
  const key = normalizeSlugKey(slug);
  if (!key) return { id: null, source: null, key };

  const fromCache = idFromSlug(key);
  if (fromCache) return { id: fromCache, source: 'cache', key };

  if (typeof findClinicIdBySlug === 'function') {
    try {
      const fromDb = await findClinicIdBySlug(key);
      if (Number.isInteger(fromDb) && fromDb > 0) {
        return { id: fromDb, source: 'db', key };
      }
    } catch (err) {
      console.warn('[Doctor Route] DB slug lookup error:', (err && err.message) || err);
    }
  }

  return { id: null, source: null, key };
}

function createDoctorProfileApp(handlers) {
  const { serveProfileById, loadClinicById, findClinicIdBySlug } = handlers || {};
  const app = express();
  const router = express.Router();

  app.disable('x-powered-by');

  function legacyProfileRedirectMiddleware(req, res) {
    ensureCache();
    const id = parseLegacyId(req);
    if (!id) {
      redirect301(res, '/');
      return;
    }
    const clinic = typeof loadClinicById === 'function' ? loadClinicById(id) : null;
    const doctorSlug = slugForClinic(clinic || { id });
    if (!doctorSlug) {
      redirect301(res, '/');
      return;
    }
    return redirect301(res, `/doctor/${doctorSlug}`);
  }

  /**
   * GET /doctor/:slug — must be registered before static / wildcard handlers.
   */
  async function doctorSlugHandler(req, res) {
    // Explicit decode as required (Express may already decode; safe + idempotent for ASCII).
    let slug;
    try {
      slug = decodeURIComponent(req.params.slug || '').trim();
    } catch (_err) {
      slug = String(req.params.slug || '').trim();
    }

    if (!slug) {
      redirect301(res, '/');
      return;
    }

    if (slug.startsWith('sample-clinic')) {
      return redirect301(res, '/shiraz');
    }

    const resolved = await resolveClinicIdFromSlug(slug, findClinicIdBySlug);
    const id = resolved.id;

    if (!id) {
      console.error(`[Doctor Route] Slug not found: ${req.params.slug}`);
      res.status(404).type('text/plain; charset=utf-8').send('Profile not found');
      return;
    }

    const clinic = typeof loadClinicById === 'function' ? loadClinicById(id) : null;
    const doctor = {
      id,
      slug: slugForClinic(clinic || { id }),
      name: clinic && (clinic.name || clinic.sliderTitle),
      clinic: clinic || null,
    };

    if (!doctor.slug) {
      console.error(`[Doctor Route] Slug not found: ${req.params.slug}`);
      res.status(404).type('text/plain; charset=utf-8').send('Profile not found');
      return;
    }

    // Legacy / non-canonical → single-hop 301 to clean slug
    if (!isCanonicalSlug(doctor, slug)) {
      return redirect301(res, `/doctor/${doctor.slug}`);
    }

    // Found — render profile template with doctor data
    serveProfileById(req, res, id, doctor);
  }

  // Register dynamic routes on the router BEFORE any catch-alls.
  router.get('/profile.html', legacyProfileRedirectMiddleware);
  router.head('/profile.html', legacyProfileRedirectMiddleware);
  router.get('/profiles.html', legacyProfileRedirectMiddleware);
  router.head('/profiles.html', legacyProfileRedirectMiddleware);

  router.get(['/doctor', '/doctor/'], (req, res) => res.redirect(301, '/'));
  router.head(['/doctor', '/doctor/'], (req, res) => res.redirect(301, '/'));

  router.get('/doctor/:slug', (req, res, next) => {
    Promise.resolve(doctorSlugHandler(req, res)).catch(next);
  });
  router.head('/doctor/:slug', (req, res, next) => {
    Promise.resolve(doctorSlugHandler(req, res)).catch(next);
  });

  // Catch-all under /doctor only AFTER :slug — never serves static files here.
  router.use('/doctor', (req, res) => {
    console.error(`[Doctor Route] Slug not found: ${req.path || req.url}`);
    res.status(404).type('text/plain; charset=utf-8').send('Profile not found');
  });

  app.use(router);

  // Do NOT mount express.static on this app — parent http server handles /assets/
  // after /doctor/ so extensionless doctor routes are never intercepted.

  app.legacyProfileRedirect = function legacyProfileRedirect(req, res, next) {
    const path = String((req.path || req.url || '').split('?')[0]);
    if (path === '/profile.html' || path === '/profiles.html') {
      legacyProfileRedirectMiddleware(req, res);
      return;
    }
    next();
  };

  return app;
}

module.exports = {
  createDoctorProfileApp,
  decodeSlugParam,
  normalizeSlugKey,
  resolveClinicIdFromSlug,
  redirect301,
  canonicalDoctorPath,
};
