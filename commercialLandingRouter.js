'use strict';

// ==========================================================================
// commercialLandingRouter — Express sub-app for commercial package landings.
//   GET  /lp/:packageSlug
//   GET  /lp/:clinicId/:packageSlug
//   GET  /ads/:packageSlug              (Google Ads entry alias)
//   GET  /api/landing/skag              (SKAG copy JSON for frontend)
//   POST /api/landing/leads             (appointment / lead capture → leads.db)
// ==========================================================================

const path = require('path');
const express = require('express');
const { getPackage, normalizePackageSlug } = require('./commercial-landing-config');
const { resolveSkagCopy, parseUtmFromRequest } = require('./commercialLandingSkag');
const { validateLandingLead, insertLandingLead } = require('./commercialLandingLeads');

const SITE_BASE = process.env.SITE_BASE || 'https://salam-doctor.com';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toAbsoluteAsset(siteBase, src) {
  const raw = String(src || '').trim();
  if (!raw) return `${siteBase}/images/sample-clinic-services.webp`;
  if (/^(https?:|data:)/i.test(raw)) return raw;
  return siteBase + (raw.startsWith('/') ? raw : `/${raw}`);
}

function findClinicById(clinicId, deps) {
  const id = Number(clinicId);
  if (!Number.isFinite(id)) return null;
  const clinics = deps.loadClinicsData();
  const clinic = clinics.find((c) => Number(c.id) === id);
  if (!clinic) return null;

  let phone = clinic.phone || '';
  let address = clinic.address || clinic.sliderTagline || '';
  const db = deps.openDb();
  try {
    const row = db
      .prepare(
        'SELECT contact_info, address FROM clinic_profiles WHERE clinic_id = ?'
      )
      .get(id);
    if (row) {
      if (row.address) address = row.address;
      if (row.contact_info) {
        try {
          const contact = JSON.parse(row.contact_info);
          if (contact.phone) phone = contact.phone;
        } catch (_err) {
          /* ignore */
        }
      }
    }
  } finally {
    db.close();
  }

  return {
    id,
    name: clinic.name || clinic.sliderTitle || `مرکز ${id}`,
    phone,
    address,
    image: toAbsoluteAsset(deps.siteBase, clinic.image),
    whatsapp: null,
  };
}

function buildLandingContext(pkg, clinic, req, deps) {
  const displayName = clinic.name.startsWith('کلینیک')
    ? clinic.name
    : `کلینیک ${clinic.name}`;
  const defaultH1 = `${displayName} — مرجع تخصصی ${pkg.label} در ${pkg.city}`;
  const skag = resolveSkagCopy(req.query, {
    clinicName: clinic.name,
    city: pkg.city,
    defaultH1,
    defaultCtaPrimary: `رزرو ${pkg.label}`,
    defaultCtaSecondary: 'مشاوره رایگان',
  });
  const { utm } = parseUtmFromRequest(req.query);
  const landingPath = req.baseLandingPath || req.path;

  let jsonLd = null;
  try {
    const seo = require('./seoInfra');
    jsonLd = seo.medicalClinicSchema({
      id: clinic.id,
      name: clinic.name,
      phone: clinic.phone,
      address: clinic.address,
      image: clinic.image,
      rating: null,
    });
  } catch (_err) {
    jsonLd = null;
  }

  return {
    packageSlug: pkg.slug,
    packageLabel: pkg.label,
    service: pkg.service,
    clinicId: clinic.id,
    clinicName: clinic.name,
    displayName,
    city: pkg.city,
    phone: clinic.phone,
    whatsappUrl: clinic.whatsapp,
    address: clinic.address,
    heroImage: clinic.image,
    subheadline: pkg.subheadline,
    trustBadges: pkg.trustBadges,
    pricingPackages: pkg.pricingPackages,
    pricingFootnote:
      'قیمت‌ها تقریبی و پس از معاینه حضوری نهایی می‌شوند. مالیات و داروهای مصرفی در صورت نیاز جداگانه اعلام می‌شود.',
    h1: skag.h1,
    ctaPrimary: skag.ctaPrimary,
    ctaSecondary: skag.ctaSecondary,
    defaultH1,
    skag,
    utm,
    landingPath,
    canonical: `${deps.siteBase}${landingPath}`,
    siteBase: deps.siteBase,
    jsonLd,
    skagJson: JSON.stringify({
      h1: skag.h1,
      ctaPrimary: skag.ctaPrimary,
      ctaSecondary: skag.ctaSecondary,
      keyword: skag.keyword,
      presetKey: skag.presetKey,
      utm,
      clinicId: clinic.id,
      packageSlug: pkg.slug,
    }),
  };
}

function createCommercialLandingApp(options = {}) {
  const deps = {
    rootDir: options.rootDir || __dirname,
    siteBase: options.siteBase || SITE_BASE,
    openDb: options.openDb,
    loadClinicsData: options.loadClinicsData,
  };

  if (!deps.openDb || !deps.loadClinicsData) {
    throw new Error('commercialLandingRouter requires openDb and loadClinicsData');
  }

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(deps.rootDir, 'views'));
  app.set('etag', 'strong');
  app.use(express.json({ limit: '32kb' }));

  function renderLanding(req, res, pkg, clinicId) {
    const clinic = findClinicById(clinicId || pkg.defaultClinicId, deps);
    if (!clinic) {
      return res.status(404).send('کلینیک یافت نشد');
    }

    const ctx = buildLandingContext(pkg, clinic, req, deps);
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.render('commercial-landing', ctx, (err, html) => {
      if (err) {
        console.error('[landing] render error:', err && err.message);
        return res.status(500).send('خطای رندر صفحه');
      }
      res.type('html').send(html);
    });
  }

  // Google Ads alias → same landing renderer
  app.get('/ads/:package_slug', (req, res) => {
    const pkg = getPackage(req.params.package_slug);
    if (!pkg) return res.status(404).send('پکیج یافت نشد');
    req.baseLandingPath = `/ads/${pkg.slug}`;
    req.query = Object.assign({ utm_source: 'google', utm_medium: 'cpc' }, req.query);
    renderLanding(req, res, pkg, pkg.defaultClinicId);
  });

  app.get('/lp/:package_slug', (req, res) => {
    const pkg = getPackage(req.params.package_slug);
    if (!pkg) return res.status(404).send('پکیج یافت نشد');
    req.baseLandingPath = `/lp/${pkg.slug}`;
    renderLanding(req, res, pkg, pkg.defaultClinicId);
  });

  app.get('/lp/:clinic_id/:package_slug', (req, res) => {
    const pkg = getPackage(req.params.package_slug);
    if (!pkg) return res.status(404).send('پکیج یافت نشد');
    const clinicId = Number(req.params.clinic_id);
    if (!Number.isFinite(clinicId)) return res.status(400).send('شناسه کلینیک نامعتبر است');
    req.baseLandingPath = `/lp/${clinicId}/${pkg.slug}`;
    renderLanding(req, res, pkg, clinicId);
  });

  // SKAG JSON for vanilla JS / A/B tests without full page reload
  app.get('/api/landing/skag', (req, res) => {
    const pkg = getPackage(req.query.package || req.query.packageSlug);
    const clinicId = Number(req.query.clinicId || (pkg && pkg.defaultClinicId));
    if (!pkg || !Number.isFinite(clinicId)) {
      return res.status(400).json({ error: 'package and clinicId required' });
    }
    const clinic = findClinicById(clinicId, deps);
    if (!clinic) return res.status(404).json({ error: 'clinic_not_found' });

    const ctx = buildLandingContext(pkg, clinic, req, deps);
    res.json({
      h1: ctx.h1,
      ctaPrimary: ctx.ctaPrimary,
      ctaSecondary: ctx.ctaSecondary,
      keyword: ctx.skag.keyword,
      presetKey: ctx.skag.presetKey,
      utm: ctx.utm,
      clinicId: clinic.id,
      packageSlug: pkg.slug,
      service: pkg.service,
    });
  });

  app.post('/api/landing/leads', (req, res) => {
    const result = validateLandingLead(req.body);
    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        fields: result.fields || undefined,
      });
    }

    const db = deps.openDb();
    try {
      insertLandingLead(db, result.lead);
      return res.status(201).json({
        success: true,
        id: result.lead.id,
        message: 'درخواست شما ثبت شد. به‌زودی با شما تماس می‌گیریم.',
      });
    } catch (err) {
      console.error('[landing] lead insert failed:', err && err.message);
      return res.status(500).json({ error: 'Failed to save lead' });
    } finally {
      db.close();
    }
  });

  app.get('/api/landing/packages', (_req, res) => {
    const { listPackages } = require('./commercial-landing-config');
    res.json(
      listPackages().map((p) => ({
        slug: p.slug,
        label: p.label,
        service: p.service,
        defaultClinicId: p.defaultClinicId,
        path: `/lp/${p.slug}`,
        adsPath: `/ads/${p.slug}`,
      }))
    );
  });

  return app;
}

module.exports = {
  createCommercialLandingApp,
  findClinicById,
  buildLandingContext,
  escapeHtml,
  normalizePackageSlug,
};
