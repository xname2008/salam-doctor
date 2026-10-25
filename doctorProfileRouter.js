'use strict';

/**
 * Express app for SEO doctor profile URLs.
 *
 *   GET /doctor/:slug              200 real clinic | 410 retired fixture | 404 unknown
 *   GET /profile.html?id=:id       one-hop 301 to /doctor/:slug (real) or /shiraz (retired)
 *                                  or 404 for unknown ids
 *
 * Mount BEFORE any express.static / wildcard / 404 handlers.
 */

const express = require('express');
const {
  idFromSlug,
  slugForClinic,
  isCanonicalSlug,
  ensureCache,
  canonicalDoctorPath,
} = require('./clinicSlug');
const {
  isRealClinic,
  isRetiredFixtureId,
  isSampleClinicSlug,
  toPositiveInt,
} = require('./realClinics');

function parseLegacyId(req) {
  const raw = String((req.query && (req.query.id || req.query.clinic_id)) || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === 'undefined' || lower === 'null' || lower === 'nan') return null;
  return toPositiveInt(raw);
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

function sendDoctorStatusPage(res, statusCode, titleFa) {
  const code = statusCode === 410 ? 410 : 404;
  const title = titleFa || (code === 410 ? 'پروفایل حذف شده' : 'پروفایل یافت نشد');
  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${title} | سلام دکتر</title>
</head>
<body>
  <main style="font-family:sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.8">
    <h1>${title}</h1>
    <p>این آدرس مربوط به یک مرکز فعال در سلام دکتر نیست.</p>
    <p><a href="/shiraz">بازگشت به راهنمای مراکز شیراز</a> · <a href="/">صفحه اصلی</a></p>
  </main>
</body>
</html>`;
  res
    .status(code)
    .set({
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'public, max-age=300',
    })
    .send(html);
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
      sendDoctorStatusPage(res, 404);
      return;
    }

    if (isRetiredFixtureId(id)) {
      redirect301(res, '/shiraz');
      return;
    }

    const clinic = typeof loadClinicById === 'function' ? loadClinicById(id) : null;
    if (!isRealClinic(clinic || { id })) {
      sendDoctorStatusPage(res, 404);
      return;
    }

    const doctorSlug = slugForClinic(clinic || { id });
    if (!doctorSlug || isSampleClinicSlug(doctorSlug) || /^clinic-\d+$/i.test(doctorSlug)) {
      sendDoctorStatusPage(res, 404);
      return;
    }
    return redirect301(res, `/doctor/${doctorSlug}`);
  }

  async function doctorSlugHandler(req, res) {
    let slug;
    try {
      slug = decodeURIComponent(req.params.slug || '').trim();
    } catch (_err) {
      slug = String(req.params.slug || '').trim();
    }

    if (!slug) {
      sendDoctorStatusPage(res, 404);
      return;
    }

    if (isSampleClinicSlug(slug)) {
      sendDoctorStatusPage(res, 410, 'پروفایل حذف شده');
      return;
    }

    const resolved = await resolveClinicIdFromSlug(slug, findClinicIdBySlug);
    const id = resolved.id;

    if (!id) {
      console.error(`[Doctor Route] Slug not found: ${req.params.slug}`);
      sendDoctorStatusPage(res, 404);
      return;
    }

    if (isRetiredFixtureId(id)) {
      sendDoctorStatusPage(res, 410, 'پروفایل حذف شده');
      return;
    }

    const clinic = typeof loadClinicById === 'function' ? loadClinicById(id) : null;
    if (!isRealClinic(clinic || { id })) {
      sendDoctorStatusPage(res, 404);
      return;
    }

    const doctorSlug = slugForClinic(clinic || { id });
    if (!doctorSlug || isSampleClinicSlug(doctorSlug)) {
      sendDoctorStatusPage(res, 404);
      return;
    }

    const doctor = {
      id,
      slug: doctorSlug,
      name: clinic && (clinic.name || clinic.sliderTitle),
      clinic: clinic || null,
    };

    if (!isCanonicalSlug(doctor, slug)) {
      return redirect301(res, `/doctor/${doctor.slug}`);
    }

    serveProfileById(req, res, id, doctor);
  }

  router.get('/profile.html', legacyProfileRedirectMiddleware);
  router.head('/profile.html', legacyProfileRedirectMiddleware);
  router.get('/profiles.html', legacyProfileRedirectMiddleware);
  router.head('/profiles.html', legacyProfileRedirectMiddleware);
  router.get('/profile', legacyProfileRedirectMiddleware);
  router.head('/profile', legacyProfileRedirectMiddleware);
  router.get('/profiles', legacyProfileRedirectMiddleware);
  router.head('/profiles', legacyProfileRedirectMiddleware);

  router.get(['/doctor', '/doctor/'], (req, res) => res.redirect(301, '/'));
  router.head(['/doctor', '/doctor/'], (req, res) => res.redirect(301, '/'));

  router.get('/doctor/:slug', (req, res, next) => {
    Promise.resolve(doctorSlugHandler(req, res)).catch(next);
  });
  router.head('/doctor/:slug', (req, res, next) => {
    Promise.resolve(doctorSlugHandler(req, res)).catch(next);
  });

  router.use('/doctor', (req, res) => {
    console.error(`[Doctor Route] Slug not found: ${req.path || req.url}`);
    sendDoctorStatusPage(res, 404);
  });

  app.use(router);

  app.legacyProfileRedirect = function legacyProfileRedirect(req, res, next) {
    const path = String((req.path || req.url || '').split('?')[0]);
    if (path === '/profile.html' || path === '/profiles.html' || path === '/profile' || path === '/profiles') {
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
  sendDoctorStatusPage,
};
