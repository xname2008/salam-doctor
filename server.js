'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');
const sanitizeHtml = require('sanitize-html');
const {
  ensureCategoryTables,
  createCategoryMonetizeHandlers,
} = require('./categoryMonetize');
const {
  createServiceLandingHandlers,
  createServiceLandingApp,
  SERVICE_LANDINGS,
} = require('./serviceLanding');
const {
  englishSlugFromLabel,
  resolveCanonicalEnglishSlug,
  isEnglishServiceSlug,
  canonicalServicePath,
} = require('./serviceSlugMap');
const {
  createSeoInfraHandlers,
  injectHeadSeo,
  clinicSeo,
  resolveClinicLocalSeoModifiers,
  buildMedicalEntityJsonLd,
  buildClinicBreadcrumbPayload,
} = require('./seoInfra');
const {
  buildFaqPageJsonLd,
  clinicProfileFaqs,
  faqAccordionHtml,
  defaultClinicProfileFaqs,
} = require('./faqPageJsonLd');
const { GTM_HEAD_HTML, GTM_BODY_HTML } = require('./scripts/gtm-snippets');
const { formatPersianJalaliDate } = require('./persianDate');
const {
  listStaticArticles,
  isStaticArticleId,
  getStaticArticleById,
  saveStaticArticle,
} = require('./staticArticles');
const {
  scanArticleCatalog,
  writeGeneratedCatalogJs,
} = require('./articleCatalog');

const ARTICLES_DIR = path.join(__dirname, 'articles');
const ARTICLES_CATALOG_JS = path.join(__dirname, 'assets/js/articles-catalog.generated.js');

function refreshArticlesCatalog() {
  try {
    const entries = scanArticleCatalog(ARTICLES_DIR, { syncHtml: false });
    writeGeneratedCatalogJs(entries, ARTICLES_CATALOG_JS);
  } catch (err) {
    console.error('[articles] catalog refresh failed:', err && err.message);
  }
}

let createBlogArticleHandlers = null;
try {
  createBlogArticleHandlers = require('./blogArticles').createBlogArticleHandlers;
} catch (err) {
  console.warn('[blog] disabled:', (err && err.message) || err);
}

let createBlogSiloHandlers = null;
try {
  createBlogSiloHandlers = require('./blogSiloApi').createBlogSiloHandlers;
} catch (err) {
  console.warn('[blog-silo] disabled:', (err && err.message) || err);
}

let createUploadApp = null;
try {
  createUploadApp = require('./uploadApp').createUploadApp;
} catch (err) {
  console.warn('[upload] module unavailable (install multer?):', (err && err.message) || err);
}

let createSiteSettingsHandlers = null;
let ensureSiteSettingsTable = null;
try {
  const siteSettingsMod = require('./siteSettings');
  createSiteSettingsHandlers = siteSettingsMod.createSiteSettingsHandlers;
  ensureSiteSettingsTable = siteSettingsMod.ensureSiteSettingsTable;
} catch (err) {
  console.warn('[site-settings] disabled:', (err && err.message) || err);
}

let createHeroSlidesHandlers = null;
try {
  createHeroSlidesHandlers = require('./heroSlides').createHeroSlidesHandlers;
} catch (err) {
  console.warn('[hero-slides] disabled:', (err && err.message) || err);
}

let createDirectoryAdminHandlers = null;
try {
  createDirectoryAdminHandlers = require('./directoryAdmin').createDirectoryAdminHandlers;
} catch (err) {
  console.warn('[directory-admin] disabled:', (err && err.message) || err);
}

let HUB_SLUGS = [];
try {
  HUB_SLUGS = require('./hub-slugs').HUB_SLUGS || [];
} catch (_err) {
  HUB_SLUGS = [];
}

let CITIES = {};
try {
  CITIES = require('./local-seo-registry').CITIES || {};
} catch (_err) {
  CITIES = {};
}

// Programmatic-SEO hub pages (/shiraz/:service_slug) run on a small Express
// sub-app. Loaded defensively so the core server still boots if `express`
// or the Prisma client haven't been installed/generated yet.
let seoApp = null;
let isLocalHubPath = () => false;
try {
  seoApp = require('./seoRouter').createSeoApp();
  isLocalHubPath = require('./local-seo-registry').isLocalHubPath;
} catch (err) {
  console.warn('[seo] SEO hub routes disabled:', (err && err.message) || err);
}

// SEO-optimised blog template (views/article.ejs: TOC + FAQ schema + hub CTA).
let articleTemplate = null;
try {
  articleTemplate = require('./articleTemplate');
} catch (err) {
  console.warn('[articles] EJS article template disabled:', (err && err.message) || err);
}

// Site search (/search?q=) — required for WebSite SearchAction / Sitelinks searchbox.
let searchApp = null;
try {
  searchApp = require('./searchRouter').createSearchApp();
} catch (err) {
  console.warn('[search] Site search disabled:', (err && err.message) || err);
}

// HTML sitemap (/sitemap) — crawlable city × service × clinic index.
let htmlSitemapApp = null;
try {
  htmlSitemapApp = require('./htmlSitemap').createHtmlSitemapApp();
} catch (err) {
  console.warn('[html-sitemap] HTML sitemap disabled:', (err && err.message) || err);
}

let commercialLandingApp = null;
let doctorApp = null;

let leadSyncWorker = null;
try {
  leadSyncWorker = require('./syncWorker');
} catch (err) {
  console.warn('[lead-sync] worker module unavailable:', (err && err.message) || err);
}

let createDoctorProfileApp = null;
let clinicSlug = null;
try {
  ({ createDoctorProfileApp } = require('./doctorProfileRouter'));
  clinicSlug = require('./clinicSlug');
} catch (err) {
  console.warn('[profiles] slug modules unavailable:', (err && err.message) || err);
  createDoctorProfileApp = null;
  clinicSlug = {
    registerClinics() {},
    clinicProfilePath(id) {
      const n = typeof id === 'object' && id ? id.id : id;
      return Number.isInteger(n) && n > 0 ? `/doctor/clinic-${n}` : '/';
    },
    slugForClinic(id) {
      const n = typeof id === 'object' && id ? id.id : id;
      return Number.isInteger(n) && n > 0 ? `clinic-${n}` : null;
    },
    idFromSlug(slug) {
      const m = String(slug || '')
        .trim()
        .toLowerCase()
        .match(/^clinic-(\d+)$/);
      return m ? Number(m[1]) : null;
    },
    ensureCache() {},
  };
}
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'leads.db');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

const AD_SLOTS = new Set(['home', 'category', 'profile', 'global']);
const SITE_BASE = 'https://salam-doctor.com';
const DEFAULT_OG_IMAGE = SITE_BASE + '/images/hero-collage.png';

const HEADER_HTML = `<header class="topbar">
  <div class="container topbar-row">
    <a href="/" class="brand" aria-label="سلام دکتر — صفحه اصلی">
      <span class="logo logo-heart-beat" aria-hidden="true">
        <img src="/images/logo-heart.svg" alt="لوگو سلام دکتر" width="40" height="40"
             onerror="this.onerror=null;this.src='/images/logo-heart.svg'">
      </span>
      <span class="brand-name">سلام دکتر</span>
    </a>
    <nav class="menu">
      <div class="dropdown">
        <a href="#">پوست و مو
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <div class="dropdown-content">
          <a href="/shiraz/hair-transplant">کاشت مو و ابرو</a>
          <a href="/shiraz/skin-rejuvenation">پوست و جوانسازی</a>
          <a href="/shiraz/injectables">تزریقات زیبایی</a>
        </div>
      </div>
      <div class="dropdown">
        <a href="#">لیزر و جراحی
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <div class="dropdown-content">
          <a href="/shiraz/laser-hair-removal">لیزر موهای زائد</a>
          <a href="/shiraz/cosmetic-surgery">جراحی زیبایی</a>
        </div>
      </div>
      <div class="dropdown">
        <a href="#">تناسب اندام
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <div class="dropdown-content">
          <a href="/slimming.html">لاغری و پیکرتراشی</a>
        </div>
      </div>
      <a href="/lasik.html">لیزیک</a>
      <a href="/femto-lasik.html">فمتولیزیک</a>
      <a href="/prk.html">PRK</a>
      <a href="/articles.html">مقالات</a>
      <a href="/products.html">محصولات زیبایی</a>
      <a href="/pharmacy.html">داروخانه</a>
      <a href="/faq.html">سوالات متداول</a>
      <a href="/about.html">درباره ما</a>
    </nav>
    <button id="nav-hamburger" class="nav-hamburger" aria-label="منو" aria-expanded="false" aria-controls="mobile-drawer">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>`;

const DRAWER_HTML = `<div id="drawer-overlay" class="drawer-overlay" hidden></div>
<nav id="mobile-drawer" class="mobile-drawer" aria-hidden="true">
  <div class="drawer-head">
    <span class="drawer-title"><span class="logo logo-heart-beat drawer-logo" aria-hidden="true"><img src="/images/logo-heart.svg" alt="" width="30" height="30" onerror="this.onerror=null;this.src='/images/logo-heart.svg'"></span>سلام دکتر</span>
    <button id="drawer-close" class="drawer-close" aria-label="بستن">&times;</button>
  </div>
  <div class="drawer-body">
    <a href="/">خانه</a>
    <a href="/shiraz/hair-transplant">کاشت مو و ابرو</a>
    <a href="/shiraz/skin-rejuvenation">پوست و جوانسازی</a>
    <a href="/shiraz/injectables">تزریقات زیبایی</a>
    <a href="/shiraz/laser-hair-removal">لیزر موهای زائد</a>
    <a href="/shiraz/cosmetic-surgery">جراحی زیبایی</a>
    <a href="/slimming.html">لاغری و پیکرتراشی</a>
    <a href="/lasik.html">لیزیک</a>
    <a href="/femto-lasik.html">فمتولیزیک</a>
    <a href="/prk.html">PRK</a>
    <a href="/products.html">محصولات زیبایی</a>
    <a href="/pharmacy.html">داروخانه</a>
    <a href="/faq.html">سوالات متداول</a>
      <a href="/articles.html">مقالات</a>
    <a href="/about.html">درباره ما</a>
    <a href="tel:+989007000462" class="drawer-cta" dir="ltr" data-site-phone="support">پشتیبانی سایت: ۰۹۰۰۷۰۰۰۴۶۲</a>
  </div>
</nav>`;

const FOOTER_HTML = `<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        <h4>سلام دکتر</h4>
        <div class="footer-links">
          <a href="tel:+989007000462" dir="ltr" data-site-phone="support">پشتیبانی سایت: ۰۹۰۰۷۰۰۰۴۶۲</a>
          <span>شیراز، روبروی پاسارگاد شرقی، جنب نگین عدالت</span>
          <span>info@salamdoctor.ir</span>
        </div>
      </div>
      <div class="footer-col">
        <h4>خدمات پرکاربرد</h4>
        <div class="footer-links">
          <a href="/shiraz/hair-transplant">کاشت مو در شیراز</a>
          <a href="/shiraz/botox">تزریق بوتاکس در شیراز</a>
          <a href="/shiraz/laser-hair-removal">لیزر موهای زائد در شیراز</a>
          <a href="/shiraz/fillers">تزریق فیلر در شیراز</a>
          <a href="/shiraz/skin-rejuvenation">جوانسازی پوست در شیراز</a>
          <a href="/shiraz/cosmetic-surgery">جراحی زیبایی در شیراز</a>
          <a href="/shiraz/breast-surgery">جراحی سینه در شیراز</a>
          <a href="/shiraz/dermatology">پوست و مو در شیراز</a>
          <a href="/tehran/hair-transplant">کاشت مو در تهران</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>راهنمای بیماران</h4>
        <div class="footer-links">
          <a href="/articles.html">مقالات آموزشی</a>
          <a href="/faq.html">سوالات متداول</a>
          <a href="/about.html">درباره ما</a>
          <a href="/sitemap">نقشه سایت</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>مقالات جدید</h4>
        <div class="footer-links">
          <a href="/articles/laser-hair-removal-comparison.html">مقایسه لیزر کاندلا و الکساندرایت</a>
          <a href="/articles/fit-hair-transplant-cost.html">هزینه و مراقبت کاشت مو FIT</a>
          <a href="/articles.html">همه مقالات</a>
        </div>
      </div>
    </div>
    <div class="footer-note">© 2026 سلام دکتر. تمامی حقوق محفوظ است.</div>
  </div>
</footer>`;

const ARTICLE_STYLES = `
.article-page{ background:#fff; }
.article-breadcrumb{ width:min(760px,92%); margin:0 auto; padding:18px 0 0;
  font-size:.85rem; color:var(--muted); display:flex; gap:8px; flex-wrap:wrap; }
.article-breadcrumb a:hover{ color:var(--blue); }
.article-breadcrumb .current{ color:var(--text); font-weight:700; }
article{ width:min(760px,92%); margin:0 auto; padding:18px 0 40px; }
article h1{ font-size:clamp(1.6rem,4vw,2.3rem); line-height:1.5; margin-bottom:12px; }
.article-meta{ display:flex; gap:14px; flex-wrap:wrap; color:var(--muted);
  font-size:.85rem; margin-bottom:18px; padding-bottom:18px;
  border-bottom:1px solid var(--line); }
.article-cover{ margin:0 0 22px; }
.article-cover img{ width:100%; border-radius:16px; display:block; }
article h2{ font-size:1.4rem; margin:28px 0 10px; }
article h3{ font-size:1.18rem; margin:22px 0 8px; }
article p{ color:#28384f; line-height:2; margin:0 0 16px; }
article ul, article ol{ color:#28384f; line-height:2; padding-right:22px; margin:0 0 16px; }
article blockquote{ border-right:4px solid var(--blue); background:var(--mint);
  margin:18px 0; padding:12px 16px; border-radius:0 10px 10px 0; color:#28384f; }
article figure{ margin:18px 0; } article figure img{ width:100%; border-radius:12px; }
article figcaption{ text-align:center; color:var(--muted); font-size:.82rem; margin-top:6px; }
.article-share{ display:flex; gap:10px; flex-wrap:wrap; margin:24px auto 0; width:min(760px,92%); }
.article-share .btn{ font-size:.88rem; }
.article-back{ display:inline-block; margin-top:20px; font-weight:700; color:var(--blue); }
.article-notfound{ text-align:center; padding:48px 20px 60px; }
.article-notfound h1{ font-size:1.6rem; margin-bottom:12px; }
.article-notfound p{ color:var(--muted); margin-bottom:20px; }
`;

const chatSessions = new Map();

function openDb() {
  const db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      desc TEXT
    );

    CREATE TABLE IF NOT EXISTS featured_clinics (
      id TEXT PRIMARY KEY,
      rank INTEGER NOT NULL,
      name TEXT NOT NULL,
      tagline TEXT,
      phone TEXT,
      address TEXT,
      image TEXT,
      link TEXT,
      badge TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      starts_at TEXT,
      ends_at TEXT,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY,
      slot TEXT NOT NULL,
      title TEXT,
      image TEXT NOT NULL,
      image_mobile TEXT,
      link TEXT NOT NULL,
      weight INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      starts_at TEXT,
      ends_at TEXT,
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      cover_image TEXT,
      body_html TEXT NOT NULL,
      category TEXT,
      author TEXT DEFAULT 'تیم سلام دکتر',
      status TEXT NOT NULL DEFAULT 'draft',
      views INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      hub_url TEXT,
      hub_keyword TEXT
    );

    CREATE TABLE IF NOT EXISTS clinic_profiles (
      clinic_id INTEGER PRIMARY KEY,
      intro TEXT NOT NULL DEFAULT '',
      contact_info TEXT,
      address TEXT,
      latitude REAL,
      longitude REAL,
      services_json TEXT,
      dept1_title TEXT,
      dept1_phone TEXT,
      dept1_whatsapp TEXT,
      dept2_title TEXT,
      dept2_phone TEXT,
      dept2_whatsapp TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  ensureCategoryTables(db);

  // Migration: hub override columns for pre-existing articles tables
  // (CREATE TABLE IF NOT EXISTS does not add columns to existing tables).
  const articleCols = db.prepare('PRAGMA table_info(articles)').all().map((c) => c.name);
  if (!articleCols.includes('hub_url')) db.exec('ALTER TABLE articles ADD COLUMN hub_url TEXT');
  if (!articleCols.includes('hub_keyword')) db.exec('ALTER TABLE articles ADD COLUMN hub_keyword TEXT');

  // Migration: responsive ad images (desktop + mobile)
  const adCols = db.prepare('PRAGMA table_info(ads)').all().map((c) => c.name);
  if (!adCols.includes('image_mobile')) {
    db.exec('ALTER TABLE ads ADD COLUMN image_mobile TEXT');
  }

  // Migration: clinic contact / map / structured services overlay
  const clinicProfileCols = db
    .prepare('PRAGMA table_info(clinic_profiles)')
    .all()
    .map((c) => c.name);
  if (!clinicProfileCols.includes('contact_info')) {
    db.exec('ALTER TABLE clinic_profiles ADD COLUMN contact_info TEXT');
  }
  if (!clinicProfileCols.includes('latitude')) {
    db.exec('ALTER TABLE clinic_profiles ADD COLUMN latitude REAL');
  }
  if (!clinicProfileCols.includes('longitude')) {
    db.exec('ALTER TABLE clinic_profiles ADD COLUMN longitude REAL');
  }
  if (!clinicProfileCols.includes('services_json')) {
    db.exec('ALTER TABLE clinic_profiles ADD COLUMN services_json TEXT');
  }
  if (!clinicProfileCols.includes('address')) {
    db.exec('ALTER TABLE clinic_profiles ADD COLUMN address TEXT');
  }
  [
    'dept1_title',
    'dept1_phone',
    'dept1_whatsapp',
    'dept2_title',
    'dept2_phone',
    'dept2_whatsapp',
  ].forEach(function (col) {
    if (!clinicProfileCols.includes(col)) {
      db.exec('ALTER TABLE clinic_profiles ADD COLUMN ' + col + ' TEXT');
    }
  });

  if (typeof ensureSiteSettingsTable === 'function') {
    try {
      ensureSiteSettingsTable(db);
    } catch (err) {
      console.warn('[site-settings] table init failed:', (err && err.message) || err);
    }
  }

  try {
    const { ensureLeadsTrackingColumns } = require('./commercialLandingLeads');
    ensureLeadsTrackingColumns(db);
  } catch (err) {
    console.warn('[leads] column migration skipped:', (err && err.message) || err);
  }

  return db;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function setNoindexHeaders(res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

function sendJson(res, statusCode, payload, method, opts) {
  setCorsHeaders(res);
  if ((opts && opts.noindex) || res.__adminNoindex) setNoindexHeaders(res);
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  };
  res.writeHead(statusCode, headers);
  if (method !== 'HEAD') res.end(body);
  else res.end();
}

function sendText(res, statusCode, message, opts) {
  setCorsHeaders(res);
  if (opts && opts.noindex) setNoindexHeaders(res);
  const body = String(message);
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  });
  res.end(body);
}

function sendNotFound(res, message) {
  sendText(res, 404, message || 'Not Found', { noindex: true });
}

function sendHtml(res, statusCode, html) {
  const body = String(html);
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  });
  res.end(body);
}

function sendRedirect(res, location, method, statusCode) {
  setCorsHeaders(res);
  const dest = normalizeRedirectPath(location);
  const code = Number(statusCode) === 301 ? 301 : Number(statusCode) === 308 ? 308 : 302;
  if (method === 'HEAD') {
    res.writeHead(code, { Location: dest });
    res.end();
    return;
  }
  res.writeHead(code, { Location: dest });
  res.end();
}

/** Permanent redirect helper for doctor/profile SEO URLs (always 301). */
function sendPermanentRedirect(res, location, method) {
  sendRedirect(res, location, method, 301);
}

function normalizeFeaturedLink(link) {
  if (link == null) return null;
  let s = String(link).trim();
  if (!s) return null;
  if (/\/api\/featured\/click/i.test(s)) {
    return null;
  }
  // Keep absolute external URLs as-is (ads may point off-site).
  if (/^https?:\/\//i.test(s) && !/salam-doctor\.(com|ir)/i.test(s)) {
    return s;
  }
  s = s.replace(/^https?:\/\/[^/]+/i, '');
  const legacy = s.match(/profile\.html\?(?:[^#]*&)?(?:id|clinic_id)=(\d+)/i);
  if (legacy) {
    return clinicSlug.clinicProfilePath(Number(legacy[1]));
  }
  // Canonicalize /doctor/:slug (always leading slash for valid hrefs).
  if (/^\/?doctor\//i.test(s)) {
    const pathOnly = s.split('?')[0].replace(/^\/+/, '');
    return '/' + pathOnly;
  }
  if (s.startsWith('/')) return s;
  return '/' + s.replace(/^\//, '');
}

function normalizeRedirectPath(link) {
  const normalized = normalizeFeaturedLink(link);
  if (!normalized) return '/';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return '/' + normalized.replace(/^\//, '');
}

function uniqueId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function trimOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

/** Valid tracking / query id, or null (never run DB with missing/placeholder ids). */
function validQueryId(value) {
  const id = trimOrNull(value);
  if (!id) return null;
  const lower = id.toLowerCase();
  if (lower === 'undefined' || lower === 'null' || lower === 'nan') return null;
  return id;
}

function getPathname(url) {
  const raw = String(url || '/').split('?')[0].split('#')[0];
  let path = raw.startsWith('/') ? raw : '/' + raw;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

const STATIC_ASSET_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json; charset=utf-8',
};

function tryServeStaticAsset(req, res, pathname, method) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  // Never intercept extensionless SEO routes (/doctor/:slug, /services/:slug, hubs).
  if (
    pathname.startsWith('/doctor/') ||
    pathname.startsWith('/services/') ||
    pathname === '/profile.html' ||
    pathname === '/profiles.html'
  ) {
    return false;
  }
  if (!pathname.startsWith('/assets/')) return false;

  const rel = pathname.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, rel);
  const assetsRoot = path.resolve(ROOT, 'assets');
  if (!filePath.startsWith(assetsRoot + path.sep) && filePath !== assetsRoot) {
    sendText(res, 403, 'Forbidden');
    return true;
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (_err) {
    sendNotFound(res);
    return true;
  }
  if (!stat.isFile()) {
    sendNotFound(res);
    return true;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = STATIC_ASSET_TYPES[ext] || 'application/octet-stream';
  setCorsHeaders(res);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=86400',
  });
  if (method === 'HEAD') {
    res.end();
    return true;
  }
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const MAP_TILE_CACHE = new Map();
const MAP_TILE_CACHE_MAX = 800;
const MAP_TILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function mapTileUpstreamUrls(z, x, y) {
  return [
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
    `https://b.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
    `https://tile.openstreetmap.de/${z}/${x}/${y}.png`,
    `https://a.tile.openstreetmap.fr/hot/${z}/${x}/${y}.png`,
  ];
}

async function fetchMapTileBuffer(z, x, y) {
  const key = `${z}/${x}/${y}`;
  const cached = MAP_TILE_CACHE.get(key);
  if (cached && Date.now() - cached.at < MAP_TILE_TTL_MS) {
    return cached.buf;
  }

  for (const url of mapTileUpstreamUrls(z, x, y)) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'SalamDoctor/1.0 (+https://salam-doctor.com)' },
        signal: AbortSignal.timeout(9000),
      });
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      if (!buf.length || buf.length < 120) continue;
      MAP_TILE_CACHE.set(key, { buf, at: Date.now() });
      if (MAP_TILE_CACHE.size > MAP_TILE_CACHE_MAX) {
        const oldest = MAP_TILE_CACHE.keys().next().value;
        if (oldest) MAP_TILE_CACHE.delete(oldest);
      }
      return buf;
    } catch (_err) {
      /* try next provider */
    }
  }
  return null;
}

async function handleMapTileProxy(req, res, pathname, method) {
  const match = pathname.match(/^\/api\/map-tiles\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if (!match) return false;

  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  if (!Number.isFinite(z) || z < 0 || z > 19 || !Number.isFinite(x) || !Number.isFinite(y)) {
    sendText(res, 400, 'Invalid tile coordinates');
    return true;
  }

  const buf = await fetchMapTileBuffer(z, x, y);
  if (!buf) {
    sendText(res, 502, 'Map tile unavailable');
    return true;
  }

  setCorsHeaders(res);
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': buf.length,
    'Cache-Control': 'public, max-age=604800, immutable',
  });
  if (method === 'HEAD') {
    res.end();
    return true;
  }
  res.end(buf);
  return true;
}

async function handleClinicStaticMap(req, res, reqUrl, method) {
  const params = getSearchParams(reqUrl);
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    sendText(res, 400, 'lat and lng required');
    return true;
  }

  const width = Math.min(1200, Math.max(200, Number(params.get('w')) || 800));
  const height = Math.min(600, Math.max(120, Number(params.get('h')) || 300));
  const zoom = Math.min(18, Math.max(10, Number(params.get('zoom')) || 15));
  const cacheKey = `static:${lat}:${lng}:${width}:${height}:${zoom}`;
  const cached = MAP_TILE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < MAP_TILE_TTL_MS) {
    setCorsHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': cached.buf.length,
      'Cache-Control': 'public, max-age=604800',
    });
    if (method === 'HEAD') res.end();
    else res.end(cached.buf);
    return true;
  }

  const marker = `${lat},${lng},red`;
  const upstream = [
    `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=${marker}`,
    `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&size=${width},${height}&z=${zoom}&l=map&pt=${lng},${lat},pm2rdm`,
  ];

  for (const url of upstream) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'SalamDoctor/1.0 (+https://salam-doctor.com)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!resp.ok) continue;
      const buf = Buffer.from(await resp.arrayBuffer());
      if (!buf.length || buf.length < 200) continue;
      MAP_TILE_CACHE.set(cacheKey, { buf, at: Date.now() });
      setCorsHeaders(res);
      res.writeHead(200, {
        'Content-Type': resp.headers.get('content-type') || 'image/png',
        'Content-Length': buf.length,
        'Cache-Control': 'public, max-age=604800',
      });
      if (method === 'HEAD') res.end();
      else res.end(buf);
      return true;
    } catch (_err) {
      /* try next */
    }
  }

  sendText(res, 502, 'Static map unavailable');
  return true;
}

function getSearchParams(url) {
  try {
    return new URL(String(url || '/'), 'http://localhost').searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function readRequestBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const maxSize = limit || 1024 * 64;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function isLive(row) {
  if (!row || !row.active) return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.ends_at && Date.parse(row.ends_at) < now) return false;
  return true;
}

function weightedPick(rows) {
  const pool = rows.filter(isLive);
  if (!pool.length) return null;
  let total = 0;
  for (const r of pool) total += Math.max(1, r.weight || 1);
  let roll = Math.random() * total;
  for (const r of pool) {
    roll -= Math.max(1, r.weight || 1);
    if (roll <= 0) return r;
  }
  return pool[pool.length - 1];
}

function normalizeAdImagePath(image) {
  const raw = trimOrNull(image);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return raw;
  if (
    raw.startsWith('images/') ||
    raw.startsWith('uploads/') ||
    raw.startsWith('clinics/')
  ) {
    return raw;
  }
  return 'images/' + raw.replace(/^\/+/, '');
}

function repairAdImagePaths(db) {
  const rows = db.prepare('SELECT id, image, image_mobile FROM ads').all();
  for (const row of rows) {
    const fixedDesktop = normalizeAdImagePath(row.image);
    if (fixedDesktop && fixedDesktop !== row.image) {
      db.prepare('UPDATE ads SET image = ? WHERE id = ?').run(fixedDesktop, row.id);
    }
    if (row.image_mobile) {
      const fixedMobile = normalizeAdImagePath(row.image_mobile);
      if (fixedMobile && fixedMobile !== row.image_mobile) {
        db.prepare('UPDATE ads SET image_mobile = ? WHERE id = ?').run(
          fixedMobile,
          row.id
        );
      }
    }
  }
}

function resolveAdImages(row) {
  const desktop =
    normalizeAdImagePath(row.image) ||
    normalizeAdImagePath(row.desktopImageUrl) ||
    null;
  const mobile =
    normalizeAdImagePath(row.image_mobile) ||
    normalizeAdImagePath(row.mobileImageUrl) ||
    desktop;
  return { desktop, mobile };
}

function parseActive(value) {
  if (value === 0 || value === false || value === '0') return 0;
  return 1;
}

function parseRank(value) {
  const rank = Number.parseInt(String(value), 10);
  if (!Number.isInteger(rank) || rank < 1 || rank > 5) return null;
  return rank;
}

function parseWeight(value) {
  const weight = Number.parseInt(String(value == null ? 1 : value), 10);
  if (!Number.isInteger(weight) || weight < 1) return 1;
  return weight;
}

async function readJsonBody(req, res, limit) {
  let body;
  try {
    body = await readRequestBody(req, limit);
  } catch (err) {
    if (err.message === 'payload_too_large') {
      sendJson(res, 413, { error: 'Payload too large' });
      return null;
    }
    sendJson(res, 400, { error: 'Invalid request body' });
    return null;
  }

  try {
    return JSON.parse(body || '{}');
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON' });
    return null;
  }
}

function makeSlug(input) {
  return String(input || '')
    .trim()
    .replace(/[\u200c\s]+/g, '-')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-|\-$/g, '')
    .slice(0, 80) || ('article-' + Date.now());
}

function uniqueSlug(db, slug, id) {
  const base = slug;
  let candidate = slug;
  let n = 2;
  while (true) {
    const row = db.prepare('SELECT id FROM articles WHERE slug = ?').get(candidate);
    if (!row || row.id === id) return candidate;
    candidate = base + '-' + n++;
  }
}

function cleanBody(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'u',
      'a', 'blockquote', 'br', 'img', 'figure', 'figcaption'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'loading'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'nofollow noopener', target: '_blank' }),
      img: sanitizeHtml.simpleTransform('img', { loading: 'lazy' }),
    },
  });
}

function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function imageExtension(type) {
  if (type === 'jpeg') return '.jpg';
  if (type === 'png') return '.png';
  if (type === 'webp') return '.webp';
  return null;
}

function ensureUploadsDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function parseArticleSlugFromPath(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length).replace(/\/+$/, '');
  if (!raw || raw.includes('/')) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function escapeHtmlAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function syncClinicContactToPostgres(clinicId, phone, address, deptFields, contactFields) {
  if (!process.env.DATABASE_URL) return;
  const id = Number.parseInt(String(clinicId || ''), 10);
  if (!Number.isInteger(id) || id < 1) return;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const data = {};
    if (trimOrNull(phone)) data.phone = trimOrNull(phone);
    if (trimOrNull(address)) data.fullAddress = trimOrNull(address);
    const dept = deptFields || {};
    if (Object.prototype.hasOwnProperty.call(dept, 'dept1_title')) {
      data.dept1Title = trimOrNull(dept.dept1_title);
    }
    if (Object.prototype.hasOwnProperty.call(dept, 'dept1_phone')) {
      data.dept1Phone = trimOrNull(dept.dept1_phone);
    }
    if (Object.prototype.hasOwnProperty.call(dept, 'dept1_whatsapp')) {
      data.dept1Whatsapp = trimOrNull(dept.dept1_whatsapp);
    }
    if (Object.prototype.hasOwnProperty.call(dept, 'dept2_title')) {
      data.dept2Title = trimOrNull(dept.dept2_title);
    }
    if (Object.prototype.hasOwnProperty.call(dept, 'dept2_phone')) {
      data.dept2Phone = trimOrNull(dept.dept2_phone);
    }
    if (Object.prototype.hasOwnProperty.call(dept, 'dept2_whatsapp')) {
      data.dept2Whatsapp = trimOrNull(dept.dept2_whatsapp);
    }
    const contact = contactFields || {};
    if (Object.prototype.hasOwnProperty.call(contact, 'rubika_title')) {
      data.rubikaTitle = trimOrNull(contact.rubika_title);
    }
    if (Object.prototype.hasOwnProperty.call(contact, 'rubika_link')) {
      data.rubikaLink = trimOrNull(contact.rubika_link);
    }
    if (Object.prototype.hasOwnProperty.call(contact, 'bale_title')) {
      data.baleTitle = trimOrNull(contact.bale_title);
    }
    if (Object.prototype.hasOwnProperty.call(contact, 'bale_link')) {
      data.baleLink = trimOrNull(contact.bale_link);
    }
    if (!Object.keys(data).length) return;
    await prisma.clinic.updateMany({ where: { id }, data });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

function formatPersianDate(iso) {
  return formatPersianJalaliDate(iso);
}

function toPersianDigits(value) {
  return String(value).replace(/[0-9]/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}

function absoluteImageUrl(imagePath) {
  if (!imagePath) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  return SITE_BASE + (imagePath.startsWith('/') ? imagePath : '/' + imagePath);
}

function articlePublicUrl(slug) {
  return SITE_BASE + '/article/' + encodeURIComponent(slug);
}

function serveArticlesHubPage(res, method) {
  try {
    let html = fs.readFileSync(path.join(ROOT, 'articles.html'), 'utf8');
    const robotsMeta = '<meta name="robots" content="index, follow">';
    if (!/<meta\s+name=["']robots["']/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${robotsMeta}`);
    } else {
      html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, robotsMeta);
    }
    const canonical = `${SITE_BASE}/article`;
    html = html.replace(
      /<link\s+rel=["']canonical["'][^>]*>/i,
      `<link rel="canonical" href="${escapeHtmlAttr(canonical)}">`
    );
    html = html.replace(
      /<meta\s+property=["']og:url["'][^>]*>/i,
      `<meta property="og:url" content="${escapeHtmlAttr(canonical)}">`
    );
    if (method === 'HEAD') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end();
      return;
    }
    sendHtml(res, 200, html);
  } catch (err) {
    console.error('Failed to serve article hub:', err);
    sendText(res, 500, 'Internal server error');
  }
}

function sitemapLastmod(iso) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return String(iso).slice(0, 10);
}

function sendXml(res, statusCode, xml, method) {
  const body = String(xml);
  const headers = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  };
  res.writeHead(statusCode, headers);
  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
}

function renderArticlePage(article) {
  const slug = article.slug || '';
  const title = article.title || '';
  const summary = article.summary || '';
  const author = article.author || 'تیم سلام دکتر';
  const canonical = articlePublicUrl(slug);
  const ogImage = absoluteImageUrl(article.cover_image);
  const publishedLabel = formatPersianDate(article.published_at);
  const viewsLabel = toPersianDigits(article.views || 0);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: summary || undefined,
    image: article.cover_image ? ogImage : undefined,
    author: { '@type': 'Organization', name: author },
    publisher: {
      '@type': 'Organization',
      name: 'سلام دکتر',
      logo: { '@type': 'ImageObject', url: SITE_BASE + '/images/logo-heart.svg' },
    },
    datePublished: article.published_at || undefined,
    dateModified: article.updated_at || article.published_at || undefined,
    mainEntityOfPage: canonical,
  };

  const coverHtml = article.cover_image
    ? `<figure class="article-cover"><img src="${escapeHtmlAttr(article.cover_image)}" alt="${escapeHtmlAttr(title)}" loading="eager"></figure>`
    : '';

  return [
    '<!DOCTYPE html>',
    '<html lang="fa" dir="rtl">',
    '<head>',
    GTM_HEAD_HTML,
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapeHtmlAttr(title)} | سلام دکتر</title>`,
    summary ? `<meta name="description" content="${escapeHtmlAttr(summary)}">` : '',
    '<meta name="robots" content="index, follow">',
    `<link rel="canonical" href="${escapeHtmlAttr(canonical)}">`,
    '<link rel="icon" type="image/svg+xml" href="/images/logo-heart.svg?v=5">',
    '<link rel="apple-touch-icon" href="/images/logo-heart.svg?v=5">',
    '<meta name="theme-color" content="#1294e0">',
    '<meta property="og:type" content="article">',
    `<meta property="og:title" content="${escapeHtmlAttr(title)}">`,
    summary ? `<meta property="og:description" content="${escapeHtmlAttr(summary)}">` : '',
    `<meta property="og:url" content="${escapeHtmlAttr(canonical)}">`,
    `<meta property="og:image" content="${escapeHtmlAttr(ogImage)}">`,
    '<meta property="og:locale" content="fa_IR">',
    '<meta property="og:site_name" content="سلام دکتر">',
    '<link rel="stylesheet" href="/assets/css/shared.css?v=20260801a">',
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
    `<style>${ARTICLE_STYLES}</style>`,
    '</head>',
    '<body>',
    GTM_BODY_HTML,
    HEADER_HTML,
    DRAWER_HTML,
    '<main class="article-page">',
    '<nav class="article-breadcrumb" aria-label="مسیر صفحه">',
    '<a href="/">خانه</a>',
    '<span aria-hidden="true">›</span>',
    '<a href="/articles.html">مقالات</a>',
    '<span aria-hidden="true">›</span>',
    `<span class="current">${escapeHtmlAttr(title)}</span>`,
    '</nav>',
    '<article>',
    `<h1>${escapeHtmlAttr(title)}</h1>`,
    '<div class="article-meta">',
    `<span>${escapeHtmlAttr(author)}</span>`,
    `<span>${escapeHtmlAttr(publishedLabel)}</span>`,
    `<span>${viewsLabel} بازدید</span>`,
    article.category ? `<span>${escapeHtmlAttr(article.category)}</span>` : '',
    '</div>',
    coverHtml,
    article.body_html,
    `<a class="article-back" href="/articles.html">بازگشت به مقالات</a>`,
    '</article>',
    '<div class="article-share">',
    '<button type="button" class="btn btn-soft" id="copy-article-link">کپی لینک مقاله</button>',
    `<a class="btn btn-green" href="https://ble.ir/share?url=${encodeURIComponent(canonical)}" target="_blank" rel="noopener noreferrer">اشتراک در بله</a>`,
    '</div>',
    '</main>',
    FOOTER_HTML,
    '<script>',
    'document.getElementById("copy-article-link")?.addEventListener("click",function(){',
    `navigator.clipboard.writeText(${JSON.stringify(canonical)}).then(function(){`,
    'var b=document.getElementById("copy-article-link");if(b)b.textContent="کپی شد!";',
    '}).catch(function(){});});',
    '</script>',
    '<script src="/assets/js/shared.js?v=20260801a" defer></script>',
    '</body>',
    '</html>',
  ].join('\n');
}

function renderArticleNotFound() {
  return [
    '<!DOCTYPE html>',
    '<html lang="fa" dir="rtl">',
    '<head>',
    GTM_HEAD_HTML,
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>مقاله یافت نشد | سلام دکتر</title>',
    '<meta name="robots" content="noindex">',
    '<link rel="icon" type="image/svg+xml" href="/images/logo-heart.svg?v=5">',
    '<link rel="apple-touch-icon" href="/images/logo-heart.svg?v=5">',
    '<meta name="theme-color" content="#1294e0">',
    '<link rel="stylesheet" href="/assets/css/shared.css?v=20260801a">',
    `<style>${ARTICLE_STYLES}</style>`,
    '</head>',
    '<body>',
    GTM_BODY_HTML,
    HEADER_HTML,
    DRAWER_HTML,
    '<main class="article-page">',
    '<div class="article-notfound">',
    '<h1>مقاله یافت نشد</h1>',
    '<p>این مقاله وجود ندارد یا هنوز منتشر نشده است.</p>',
    '<a class="btn btn-main" href="/articles.html">بازگشت به مقالات</a>',
    '</div>',
    '</main>',
    FOOTER_HTML,
    '<script src="/assets/js/shared.js?v=20260801a" defer></script>',
    '</body>',
    '</html>',
  ].join('\n');
}

async function handleConsultation(req, res) {
  const data = await readJsonBody(req, res);
  if (!data) return;

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  let phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const service = typeof data.service === 'string' ? data.service.trim() : '';
  const desc = typeof data.desc === 'string' ? data.desc.trim() : '';

  // Normalize +98 / 0098 / 98… to 09xxxxxxxxx
  phone = String(phone)
    .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[^\d+]/g, '');
  if (phone.startsWith('+')) phone = phone.slice(1);
  if (phone.startsWith('0098')) phone = phone.slice(4);
  else if (phone.startsWith('98') && phone.length >= 12) phone = phone.slice(2);
  if (phone.startsWith('9') && phone.length === 10) phone = '0' + phone;

  if (!name || !phone || !service) {
    sendJson(res, 400, { error: 'Missing required fields: name, phone, service' });
    return;
  }

  if (!/^09\d{9}$/.test(phone)) {
    sendJson(res, 400, { error: 'Invalid phone number' });
    return;
  }

  const lead = {
    id: uniqueId(),
    timestamp: nowIso(),
    name,
    phone,
    service,
    desc,
  };

  const db = openDb();
  try {
    db.prepare(
      'INSERT INTO leads VALUES (@id, @timestamp, @name, @phone, @service, @desc)',
    ).run(lead);
    sendJson(res, 201, { success: true, lead });
  } catch (err) {
    console.error('Failed to save lead:', err);
    sendJson(res, 500, { error: 'Failed to save lead' });
  } finally {
    db.close();
  }
}

async function handleGetLeads(res, method) {
  const m = method || 'GET';
  const db = openDb();
  try {
    const leads = db.prepare('SELECT * FROM leads ORDER BY timestamp DESC').all();
    sendJson(res, 200, leads, m);
  } catch (err) {
    console.error('Failed to read leads:', err);
    sendJson(res, 500, { error: 'Failed to read leads' }, m);
  } finally {
    db.close();
  }
}

function featuredHasImage(row) {
  const img = trimOrNull(row && row.image);
  return img && !/clinic-placeholder/i.test(img);
}

const NAHAL_FEATURED_ID = 'nahal-clinic-featured';

const FEATURED_SLOT_DEFAULTS = [
  { rank: 1, id: NAHAL_FEATURED_ID, name: 'کلینیک نهال', tagline: 'کلینیک کاشت مو،پوست،لیزر و زیبایی', image: 'clinics/114/Hero.webp', link: '/doctor/nahal-clinic', badge: 'ویژه' },
  { rank: 2, id: 'featured-slot-2', name: 'Shiraz Sample Clinic 1', tagline: 'کلینیک تخصصی پوست و مو', image: 'images/sample-clinic-services.webp', link: '/doctor/sample-clinic-1', badge: null },
  { rank: 3, id: 'featured-slot-3', name: 'Shiraz Sample Clinic 4', tagline: 'کلینیک زیبایی و کاشت مو', image: 'images/sample-clinic-services.webp', link: '/doctor/sample-clinic-4', badge: null },
  { rank: 4, id: 'featured-slot-4', name: 'Shiraz Sample Clinic 5', tagline: 'کلینیک زیبایی و کاشت مو', image: 'images/sample-clinic-services.webp', link: '/doctor/sample-clinic-5', badge: null },
  { rank: 5, id: 'featured-slot-5', name: 'Shiraz Sample Clinic 14', tagline: 'کلینیک کاشت مو،پوست،لیزر و زیبایی', image: 'images/sample-clinic-services.webp', link: '/doctor/sample-clinic-14', badge: null },
];

const FEATURED_SLOT_IDS = new Set(FEATURED_SLOT_DEFAULTS.map((slot) => slot.id));

function repairFeaturedLinks(db) {
  const rows = db.prepare('SELECT id, link FROM featured_clinics').all();
  for (const row of rows) {
    const fixed = normalizeFeaturedLink(row.link);
    if (fixed !== row.link) {
      db.prepare('UPDATE featured_clinics SET link = ? WHERE id = ?').run(fixed, row.id);
    }
  }
}

const NAHAL_AD_TITLE = 'کلینیک نهال — کاشت تخصصی مو، ابرو و ریش';
const NAHAL_AD_LINK = '/doctor/nahal-clinic';
const NAHAL_ADS = [
  {
    id: 'nahal-ad-home',
    slot: 'home',
    image: 'images/ads/nahal-banner-home-desktop.jpg',
    image_mobile: 'images/ads/nahal-banner-mobile.jpg',
  },
  {
    id: 'nahal-ad-category',
    slot: 'category',
    image: 'images/ads/nahal-banner-category-desktop.jpg',
    image_mobile: 'images/ads/nahal-banner-mobile.jpg',
  },
  {
    id: 'nahal-ad-profile',
    slot: 'profile',
    image: 'images/ads/nahal-banner-category-desktop.jpg',
    image_mobile: 'images/ads/nahal-banner-mobile.jpg',
  },
  {
    id: 'nahal-ad-global',
    slot: 'global',
    image: 'images/ads/nahal-banner-category-desktop.jpg',
    image_mobile: 'images/ads/nahal-banner-mobile.jpg',
  },
];

function ensureNahalAds(db) {
  for (const ad of NAHAL_ADS) {
    const payload = {
      id: ad.id,
      slot: ad.slot,
      title: NAHAL_AD_TITLE,
      image: ad.image,
      image_mobile: ad.image_mobile,
      link: NAHAL_AD_LINK,
      created_at: nowIso(),
    };
    const existing = db.prepare('SELECT id FROM ads WHERE id = ?').get(ad.id);
    if (existing) {
      db.prepare(`
        UPDATE ads SET
          slot = @slot,
          title = @title,
          image = @image,
          image_mobile = @image_mobile,
          link = @link,
          active = 1,
          weight = 10
        WHERE id = @id
      `).run(payload);
    } else {
      db.prepare(`
        INSERT INTO ads (
          id, slot, title, image, image_mobile, link, weight, active,
          starts_at, ends_at, impressions, clicks, created_at
        ) VALUES (
          @id, @slot, @title, @image, @image_mobile, @link, 10, 1,
          NULL, NULL, 0, 0, @created_at
        )
      `).run(payload);
    }
    db.prepare('UPDATE ads SET active = 0 WHERE slot = ? AND id != ? AND active = 1').run(
      ad.slot,
      ad.id
    );
  }
}

function ensureNahalFeaturedImage(db) {
  const nahal = FEATURED_SLOT_DEFAULTS.find((slot) => slot.id === NAHAL_FEATURED_ID);
  if (!nahal) return;
  const link = normalizeFeaturedLink(nahal.link);
  const existing = db.prepare('SELECT id FROM featured_clinics WHERE id = ?').get(NAHAL_FEATURED_ID);
  const payload = {
    id: NAHAL_FEATURED_ID,
    rank: nahal.rank,
    name: nahal.name,
    tagline: nahal.tagline,
    image: nahal.image,
    link,
    badge: nahal.badge,
    created_at: nowIso(),
  };
  if (existing) {
    db.prepare(`
      UPDATE featured_clinics SET
        rank = @rank, name = @name, tagline = @tagline, image = @image,
        link = @link, badge = @badge, active = 1
      WHERE id = @id
    `).run(payload);
  } else {
    db.prepare(`
      INSERT INTO featured_clinics (
        id, rank, name, tagline, phone, address, image, link, badge,
        active, starts_at, ends_at, clicks, created_at
      ) VALUES (
        @id, @rank, @name, @tagline, '', '', @image, @link, @badge,
        1, NULL, NULL, 0, @created_at
      )
    `).run(payload);
  }
}

function deactivateNonCanonicalFeaturedSlots(db) {
  const placeholders = FEATURED_SLOT_DEFAULTS.map(() => '?').join(', ');
  db.prepare(`
    UPDATE featured_clinics SET active = 0
    WHERE rank BETWEEN 1 AND 5
      AND active = 1
      AND id NOT IN (${placeholders})
  `).run(...FEATURED_SLOT_DEFAULTS.map((slot) => slot.id));
}

function ensureFeaturedSlots() {
  const db = openDb();
  try {
    repairFeaturedLinks(db);
    deactivateNonCanonicalFeaturedSlots(db);
    ensureNahalFeaturedImage(db);

    for (const slot of FEATURED_SLOT_DEFAULTS) {
      const link = normalizeFeaturedLink(slot.link);

      const byId = db.prepare('SELECT id FROM featured_clinics WHERE id = ?').get(slot.id);
      const payload = {
        id: slot.id,
        rank: slot.rank,
        name: slot.name,
        tagline: slot.tagline,
        image: slot.image,
        link,
        badge: slot.badge,
        created_at: nowIso(),
      };

      if (byId) {
        db.prepare(`
          UPDATE featured_clinics SET
            rank = @rank, name = @name, tagline = @tagline, image = @image,
            link = @link, badge = @badge, active = 1
          WHERE id = @id
        `).run(payload);
      } else {
        db.prepare(`
          INSERT INTO featured_clinics (
            id, rank, name, tagline, phone, address, image, link, badge,
            active, starts_at, ends_at, clicks, created_at
          ) VALUES (
            @id, @rank, @name, @tagline, '', '', @image, @link, @badge,
            1, NULL, NULL, 0, @created_at
          )
        `).run(payload);
      }
    }

    db.prepare(`
      UPDATE featured_clinics SET active = 0
      WHERE image IS NULL OR TRIM(image) = '' OR image LIKE '%placeholder%'
    `).run();
  } catch (err) {
    console.warn('ensureFeaturedSlots:', err.message || err);
  } finally {
    db.close();
  }
}

function isExpiringSoon(endsAt) {
  if (!endsAt) return false;
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return false;
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return end > now && end <= now + sevenDays;
}

function daysActiveFromRow(row) {
  const startRaw = row.starts_at || row.created_at;
  if (!startRaw) return 1;
  const start = Date.parse(startRaw);
  if (Number.isNaN(start)) return 1;
  let end = Date.now();
  if (row.ends_at) {
    const ends = Date.parse(row.ends_at);
    if (!Number.isNaN(ends) && ends < end) end = ends;
  }
  const days = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
  return Math.max(1, days);
}

function publicFeaturedRow(row) {
  const link = normalizeFeaturedLink(row.link);
  return {
    id: row.id,
    rank: row.rank,
    name: row.name,
    tagline: row.tagline,
    phone: row.phone,
    address: row.address,
    image: row.image,
    link,
    badge: row.badge,
  };
}

function publicAdRow(row) {
  const { desktop, mobile } = resolveAdImages(row);
  const link = normalizeFeaturedLink(row.link) || row.link || '/';
  return {
    id: row.id,
    slot: row.slot,
    title: row.title,
    // Backward-compatible single image field (desktop)
    image: desktop,
    desktopImageUrl: desktop,
    mobileImageUrl: mobile,
    link,
  };
}

function handleReportsSummary(res) {
  const db = openDb();
  try {
    const featured = db.prepare('SELECT active, clicks FROM featured_clinics').all();
    const ads = db.prepare('SELECT active, impressions, clicks FROM ads').all();
    const totalLeads = db.prepare('SELECT COUNT(*) AS c FROM leads').get().c;
    const leads30 = db.prepare(`
      SELECT COUNT(*) AS c FROM leads
      WHERE timestamp >= datetime('now', '-30 days')
    `).get().c;

    let featuredActive = 0;
    let featuredInactive = 0;
    let featuredClicks = 0;
    for (const row of featured) {
      if (row.active) featuredActive += 1;
      else featuredInactive += 1;
      featuredClicks += row.clicks || 0;
    }

    let adsActive = 0;
    let adsInactive = 0;
    let adImpressions = 0;
    let adClicks = 0;
    for (const row of ads) {
      if (row.active) adsActive += 1;
      else adsInactive += 1;
      adImpressions += row.impressions || 0;
      adClicks += row.clicks || 0;
    }

    const overallCtr = adImpressions > 0 ? adClicks / adImpressions : 0;

    sendJson(res, 200, {
      featured: {
        total: featured.length,
        active: featuredActive,
        inactive: featuredInactive,
        totalClicks: featuredClicks,
      },
      ads: {
        total: ads.length,
        active: adsActive,
        inactive: adsInactive,
        totalImpressions: adImpressions,
        totalClicks: adClicks,
        overallCtr,
      },
      leads: {
        total: totalLeads,
        last30Days: leads30,
      },
    });
  } catch (err) {
    console.error('Failed to build reports summary:', err);
    sendJson(res, 500, { error: 'Failed to build reports summary' });
  } finally {
    db.close();
  }
}

// Cumulative counters only — no per-day event history yet; true trend charts need
// an events table (one row per click/impression with timestamp).
function handleReportsFeatured(res) {
  const db = openDb();
  try {
    const rows = db.prepare(`
      SELECT id, rank, name, badge, active, clicks, starts_at, ends_at, created_at
      FROM featured_clinics
      ORDER BY clicks DESC
    `).all();
    const enriched = rows.map((row) => {
      const daysActive = daysActiveFromRow(row);
      const clicks = row.clicks || 0;
      return {
        ...row,
        daysActive,
        clicksPerDay: clicks / daysActive,
        expiringSoon: isExpiringSoon(row.ends_at),
      };
    });
    sendJson(res, 200, enriched);
  } catch (err) {
    console.error('Failed to build featured report:', err);
    sendJson(res, 500, { error: 'Failed to build featured report' });
  } finally {
    db.close();
  }
}

function handleReportsAds(res) {
  const db = openDb();
  try {
    const rows = db.prepare(`
      SELECT id, slot, title, weight, active, impressions, clicks, starts_at, ends_at
      FROM ads
      ORDER BY clicks DESC
    `).all();
    const enriched = rows.map((row) => {
      const impressions = row.impressions || 0;
      const clicks = row.clicks || 0;
      return {
        ...row,
        ctr: impressions > 0 ? clicks / impressions : 0,
        expiringSoon: isExpiringSoon(row.ends_at),
      };
    });
    sendJson(res, 200, enriched);
  } catch (err) {
    console.error('Failed to build ads report:', err);
    sendJson(res, 500, { error: 'Failed to build ads report' });
  } finally {
    db.close();
  }
}

function handleAdminReports(req, res, pathname, method) {
  if (method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return true;
  }
  if (pathname === '/api/admin/reports/summary') {
    handleReportsSummary(res);
    return true;
  }
  if (pathname === '/api/admin/reports/featured') {
    handleReportsFeatured(res);
    return true;
  }
  if (pathname === '/api/admin/reports/ads') {
    handleReportsAds(res);
    return true;
  }
  return false;
}

function handleGetFeatured(res, method) {
  const m = method || 'GET';
  const db = openDb();
  try {
    const rows = db.prepare('SELECT * FROM featured_clinics WHERE active = 1 ORDER BY rank ASC, created_at ASC').all();
    const byRank = new Map();
    for (const row of rows) {
      if (!isLive(row) || !featuredHasImage(row) || !normalizeFeaturedLink(row.link)) continue;
      const existing = byRank.get(row.rank);
      const rowIsCanonical = FEATURED_SLOT_IDS.has(row.id);
      const existingIsCanonical = existing && FEATURED_SLOT_IDS.has(existing.id);
      if (!existing) {
        byRank.set(row.rank, row);
        continue;
      }
      if (rowIsCanonical && !existingIsCanonical) {
        byRank.set(row.rank, row);
        continue;
      }
      if (row.id === NAHAL_FEATURED_ID) {
        byRank.set(row.rank, row);
      }
    }
    const live = [];
    for (let rank = 1; rank <= 5; rank += 1) {
      const row = byRank.get(rank);
      if (row) live.push(publicFeaturedRow(row));
    }
    sendJson(res, 200, live, m);
  } catch (err) {
    console.error('Failed to read featured clinics:', err);
    sendJson(res, 500, { error: 'Failed to read featured clinics' }, m);
  } finally {
    db.close();
  }
}

function handleGetAd(req, res, method) {
  const m = method || 'GET';
  const params = getSearchParams(req.url);
  const slot = trimOrNull(params.get('slot')) || 'global';
  const db = openDb();
  try {
    const slotRows = db.prepare('SELECT * FROM ads WHERE slot = ?').all(slot);
    let pick = weightedPick(slotRows);
    if (!pick && slot !== 'global') {
      pick = weightedPick(db.prepare('SELECT * FROM ads WHERE slot = ?').all('global'));
    }
    if (pick) {
      db.prepare('UPDATE ads SET impressions = impressions + 1 WHERE id = ?').run(pick.id);
    }
    sendJson(res, 200, pick ? publicAdRow(pick) : null, m);
  } catch (err) {
    console.error('Failed to serve ad:', err);
    sendJson(res, 500, { error: 'Failed to serve ad' }, m);
  } finally {
    db.close();
  }
}

function handleFeaturedClick(req, res) {
  const method = req.method || 'GET';
  // Validate before any DB work — bots often hit /api/featured/click with no id.
  const id = validQueryId(getSearchParams(req.url).get('id'));
  if (!id) {
    sendRedirect(res, '/', method);
    return;
  }

  let db;
  try {
    db = openDb();
    const row = db.prepare('SELECT id, link FROM featured_clinics WHERE id = ?').get(id);
    if (row) {
      db.prepare('UPDATE featured_clinics SET clicks = clicks + 1 WHERE id = ?').run(id);
      sendPermanentRedirect(res, normalizeRedirectPath(row.link), method);
      return;
    }
    sendRedirect(res, '/', method);
  } catch (err) {
    console.error('Failed to track featured click:', err);
    if (!res.headersSent) sendRedirect(res, '/', method);
  } finally {
    if (db) db.close();
  }
}

function handleAdClick(req, res) {
  const method = req.method || 'GET';
  const id = validQueryId(getSearchParams(req.url).get('id'));
  if (!id) {
    sendRedirect(res, '/', method);
    return;
  }

  let db;
  try {
    db = openDb();
    const row = db.prepare('SELECT id, link FROM ads WHERE id = ?').get(id);
    if (row) {
      db.prepare('UPDATE ads SET clicks = clicks + 1 WHERE id = ?').run(id);
      const dest = normalizeFeaturedLink(row.link) || row.link || '/';
      if (/^\/doctor\//i.test(String(dest))) {
        sendPermanentRedirect(res, dest, method);
      } else {
        sendRedirect(res, dest, method);
      }
      return;
    }
    sendRedirect(res, '/', method);
  } catch (err) {
    console.error('Failed to track ad click:', err);
    if (!res.headersSent) sendRedirect(res, '/', method);
  } finally {
    if (db) db.close();
  }
}

async function handleAdminFeaturedPost(req, res) {
  const data = await readJsonBody(req, res);
  if (!data) return;

  const rank = parseRank(data.rank);
  const name = trimOrNull(data.name);
  if (rank == null) {
    sendJson(res, 400, { error: 'Invalid rank: must be an integer from 1 to 5' });
    return;
  }
  if (!name) {
    sendJson(res, 400, { error: 'Missing required field: name' });
    return;
  }

  const bodyId = trimOrNull(data.id);
  const record = {
    rank,
    name,
    tagline: trimOrNull(data.tagline),
    phone: trimOrNull(data.phone),
    address: trimOrNull(data.address),
    image: trimOrNull(data.image),
    link: normalizeFeaturedLink(data.link),
    badge: trimOrNull(data.badge),
    active: parseActive(data.active),
    starts_at: trimOrNull(data.starts_at),
    ends_at: trimOrNull(data.ends_at),
  };

  const db = openDb();
  try {
    let warning = null;
    const rankConflicts = db
      .prepare('SELECT id, name FROM featured_clinics WHERE rank = ? AND active = 1')
      .all(rank)
      .filter((row) => row.id !== bodyId);
    if (rankConflicts.length) {
      warning = `Rank ${rank} is already active for: ${rankConflicts.map((r) => r.name).join(', ')}`;
    }

    let saved;
    if (bodyId) {
      const existing = db.prepare('SELECT id FROM featured_clinics WHERE id = ?').get(bodyId);
      if (existing) {
        db.prepare(`
          UPDATE featured_clinics SET
            rank = @rank,
            name = @name,
            tagline = @tagline,
            phone = @phone,
            address = @address,
            image = @image,
            link = @link,
            badge = @badge,
            active = @active,
            starts_at = @starts_at,
            ends_at = @ends_at
          WHERE id = @id
        `).run({ id: bodyId, ...record });
        saved = db.prepare('SELECT * FROM featured_clinics WHERE id = ?').get(bodyId);
        const payload = { success: true, featured: saved };
        if (warning) payload.warning = warning;
        sendJson(res, 200, payload);
        return;
      }
    }

    const id = bodyId || uniqueId();
    db.prepare(`
      INSERT INTO featured_clinics (
        id, rank, name, tagline, phone, address, image, link, badge,
        active, starts_at, ends_at, clicks, created_at
      ) VALUES (
        @id, @rank, @name, @tagline, @phone, @address, @image, @link, @badge,
        @active, @starts_at, @ends_at, 0, @created_at
      )
    `).run({ id, ...record, created_at: nowIso() });
    saved = db.prepare('SELECT * FROM featured_clinics WHERE id = ?').get(id);
    const payload = { success: true, featured: saved };
    if (warning) payload.warning = warning;
    sendJson(res, 201, payload);
  } catch (err) {
    console.error('Failed to save featured clinic:', err);
    sendJson(res, 500, { error: 'Failed to save featured clinic' });
  } finally {
    db.close();
  }
}

function handleAdminFeaturedList(res) {
  const db = openDb();
  try {
    const rows = db.prepare('SELECT * FROM featured_clinics ORDER BY rank ASC, created_at DESC').all();
    sendJson(res, 200, rows);
  } catch (err) {
    console.error('Failed to list featured clinics:', err);
    sendJson(res, 500, { error: 'Failed to list featured clinics' });
  } finally {
    db.close();
  }
}

function handleAdminFeaturedDelete(req, res) {
  const id = trimOrNull(getSearchParams(req.url).get('id'));
  if (!id) {
    sendJson(res, 400, { error: 'Missing required query parameter: id' });
    return;
  }

  const db = openDb();
  try {
    const result = db.prepare('DELETE FROM featured_clinics WHERE id = ?').run(id);
    if (!result.changes) {
      sendJson(res, 404, { error: 'Featured clinic not found' });
      return;
    }
    sendJson(res, 200, { success: true, id });
  } catch (err) {
    console.error('Failed to delete featured clinic:', err);
    sendJson(res, 500, { error: 'Failed to delete featured clinic' });
  } finally {
    db.close();
  }
}

async function handleAdminAdsPost(req, res) {
  const data = await readJsonBody(req, res);
  if (!data) return;

  const slot = trimOrNull(data.slot);
  const desktopRaw =
    trimOrNull(data.desktopImageUrl) ||
    trimOrNull(data.image) ||
    trimOrNull(data.image_desktop);
  const mobileRaw =
    trimOrNull(data.mobileImageUrl) ||
    trimOrNull(data.image_mobile) ||
    trimOrNull(data.imageMobile);
  const link = trimOrNull(data.link);
  if (!slot || !AD_SLOTS.has(slot)) {
    sendJson(res, 400, { error: 'Invalid or missing slot (home, category, profile, global)' });
    return;
  }
  if (!desktopRaw) {
    sendJson(res, 400, {
      error: 'Missing required field: desktopImageUrl (or image)',
    });
    return;
  }
  if (!link) {
    sendJson(res, 400, { error: 'Missing required field: link' });
    return;
  }

  const desktopImage = normalizeAdImagePath(desktopRaw);
  const mobileImage = mobileRaw ? normalizeAdImagePath(mobileRaw) : null;

  const bodyId = trimOrNull(data.id);
  const record = {
    slot,
    title: trimOrNull(data.title),
    image: desktopImage,
    image_mobile: mobileImage,
    link,
    weight: parseWeight(data.weight),
    active: parseActive(data.active),
    starts_at: trimOrNull(data.starts_at),
    ends_at: trimOrNull(data.ends_at),
  };

  const db = openDb();
  try {
    let saved;
    if (bodyId) {
      const existing = db.prepare('SELECT id FROM ads WHERE id = ?').get(bodyId);
      if (existing) {
        db.prepare(`
          UPDATE ads SET
            slot = @slot,
            title = @title,
            image = @image,
            image_mobile = @image_mobile,
            link = @link,
            weight = @weight,
            active = @active,
            starts_at = @starts_at,
            ends_at = @ends_at
          WHERE id = @id
        `).run({ id: bodyId, ...record });
        saved = db.prepare('SELECT * FROM ads WHERE id = ?').get(bodyId);
        sendJson(res, 200, { success: true, ad: saved });
        return;
      }
    }

    const id = bodyId || uniqueId();
    db.prepare(`
      INSERT INTO ads (
        id, slot, title, image, image_mobile, link, weight, active, starts_at, ends_at,
        impressions, clicks, created_at
      ) VALUES (
        @id, @slot, @title, @image, @image_mobile, @link, @weight, @active, @starts_at, @ends_at,
        0, 0, @created_at
      )
    `).run({ id, ...record, created_at: nowIso() });
    saved = db.prepare('SELECT * FROM ads WHERE id = ?').get(id);
    sendJson(res, 201, { success: true, ad: saved });
  } catch (err) {
    console.error('Failed to save ad:', err);
    sendJson(res, 500, { error: 'Failed to save ad' });
  } finally {
    db.close();
  }
}

function handleAdminAdsList(res) {
  const db = openDb();
  try {
    const rows = db.prepare('SELECT * FROM ads ORDER BY slot ASC, created_at DESC').all();
    sendJson(res, 200, rows);
  } catch (err) {
    console.error('Failed to list ads:', err);
    sendJson(res, 500, { error: 'Failed to list ads' });
  } finally {
    db.close();
  }
}

function handleAdminAdsDelete(req, res) {
  const id = trimOrNull(getSearchParams(req.url).get('id'));
  if (!id) {
    sendJson(res, 400, { error: 'Missing required query parameter: id' });
    return;
  }

  const db = openDb();
  try {
    const result = db.prepare('DELETE FROM ads WHERE id = ?').run(id);
    if (!result.changes) {
      sendJson(res, 404, { error: 'Ad not found' });
      return;
    }
    sendJson(res, 200, { success: true, id });
  } catch (err) {
    console.error('Failed to delete ad:', err);
    sendJson(res, 500, { error: 'Failed to delete ad' });
  } finally {
    db.close();
  }
}

function loadClinicsData() {
  try {
    const file = path.join(ROOT, 'data.min.js');
    const code = fs.readFileSync(file, 'utf8');
    const sandbox = { clinicsData: [] };
    vm.runInNewContext(code.replace(/^const clinicsData/, 'clinicsData'), sandbox);
    return Array.isArray(sandbox.clinicsData) ? sandbox.clinicsData : [];
  } catch (err) {
    console.warn('loadClinicsData:', err.message || err);
    return [];
  }
}

function loadClinicById(clinicId) {
  return loadClinicsData().find((c) => c && c.id === clinicId) || null;
}

function clinicProfileUrl(clinicId) {
  return `${SITE_BASE}${clinicSlug.clinicProfilePath(clinicId)}`;
}

function clinicShareImage(clinic, clinicId) {
  if (clinicId === 114) return absoluteImageUrl('clinics/114/Hero.webp');
  const img = trimOrNull(clinic && clinic.image);
  if (img && !/clinic-placeholder/i.test(img)) return absoluteImageUrl(img);
  return DEFAULT_OG_IMAGE;
}

function resolveClinicDisplayContact(clinic, overlay) {
  const FALLBACK = 'ثبت نشده';
  const overlayPhone =
    (overlay && overlay.contact_info && trimOrNull(overlay.contact_info.phone)) ||
    (overlay && trimOrNull(overlay.phone)) ||
    null;
  const overlayAddress =
    (overlay && trimOrNull(overlay.address)) ||
    (overlay && overlay.contact_info && trimOrNull(overlay.contact_info.address)) ||
    null;
  const phone =
    overlayPhone ||
    trimOrNull(clinic && clinic.phone) ||
    null;
  const address =
    overlayAddress ||
    trimOrNull(clinic && clinic.address) ||
    null;
  return {
    phone: phone || FALLBACK,
    address: address || FALLBACK,
    phoneRaw: phone,
    addressRaw: address,
  };
}

function injectClinicContactPlaceholders(html, phoneDisplay, addressDisplay) {
  return String(html || '')
    .replace(/<!--\s*DYNAMIC_CLINIC_PHONE\s*-->/g, escapeHtmlText(phoneDisplay))
    .replace(/<!--\s*DYNAMIC_CLINIC_ADDRESS\s*-->/g, escapeHtmlText(addressDisplay));
}

function injectProfileFaqs(html, faqs) {
  const markup = faqAccordionHtml(faqs, { idPrefix: 'profile-faq' });
  return String(html || '').replace(/<!--\s*DYNAMIC_PROFILE_FAQS\s*-->/g, markup);
}

function injectProfileH1(html, h1Text) {
  const safe = escapeHtmlText(trimOrNull(h1Text) || 'پروفایل کلینیک');
  return String(html || '').replace(/<!--\s*DYNAMIC_PROFILE_H1\s*-->/g, safe);
}

function injectProfileBreadcrumb(html, breadcrumbHtml) {
  const markup =
    String(breadcrumbHtml || '').trim() ||
    '<div class="container seo-breadcrumb-wrap profile-breadcrumb-wrap">' +
      '<nav class="seo-breadcrumb profile-breadcrumb" aria-label="breadcrumb">' +
      '<a href="/">خانه</a>' +
      '<span class="seo-breadcrumb-separator" aria-hidden="true">›</span>' +
      '<span class="seo-breadcrumb-current" aria-current="page">پروفایل مرکز</span>' +
      '</nav></div>';
  if (String(html || '').includes('<!-- DYNAMIC_PROFILE_BREADCRUMB -->')) {
    return String(html).replace(/<!--\s*DYNAMIC_PROFILE_BREADCRUMB\s*-->/g, markup);
  }
  return String(html || '').replace(
    /<div class="container profile-breadcrumb-wrap">[\s\S]*?<\/div>\s*(?=<section class="profile-hero">)/,
    `${markup}\n    `
  );
}

function injectClinicMapPlaceholders(html, lat, lng, clinicName) {
  const SHIRAZ_LAT = 29.5918;
  const SHIRAZ_LNG = 52.5837;
  const safeLat = Number.isFinite(Number(lat)) ? Number(lat) : SHIRAZ_LAT;
  const safeLng = Number.isFinite(Number(lng)) ? Number(lng) : SHIRAZ_LNG;
  const name = trimOrNull(clinicName) || 'موقعیت مرکز';
  return String(html || '')
    .replace(/<!--\s*DYNAMIC_LAT\s*-->/g, String(safeLat))
    .replace(/<!--\s*DYNAMIC_LNG\s*-->/g, String(safeLng))
    .replace(/<!--\s*DYNAMIC_CLINIC_MAP_NAME\s*-->/g, escapeHtmlAttr(name));
}

function injectProfileMeta(html, clinic, clinicId, overlay) {
  const numericId = Number(clinicId);
  const isNahal = numericId === 114 || String(clinic && clinic.slug || '').trim() === 'nahal-clinic';
  const name = isNahal
    ? 'کلینیک نهال'
    : trimOrNull(clinic.name) ||
      trimOrNull(clinic.sliderTitle) ||
      `مرکز ${clinicId}`;
  const localMods = resolveClinicLocalSeoModifiers(clinic, overlay);
  if (!localMods.city) localMods.city = 'شیراز';
  const nahalDescription =
    'آدرس، تلفن و نوبت‌دهی کلینیک نهال در شیراز (پوست، مو، زیبایی و کاشت مو). مشاهده جزئیات و رزرو از طریق سلام دکتر.';
  const seo = clinicSeo(name, {
    ...localMods,
    ...(isNahal ? { description: nahalDescription } : {}),
  });
  const title = seo.title;
  const ogTitle = seo.title;
  const display = resolveClinicDisplayContact(clinic, overlay);
  const address =
    display.addressRaw ||
    trimOrNull(clinic.sliderTagline) ||
    'شیراز';
  const phone = display.phoneRaw || '';
  const introFull = htmlToPlainText(overlay && overlay.intro, 500);
  const description = seo.description;
  const schemaDescription = introFull || seo.description;

  const canonical = clinicProfileUrl(clinicId);
  const ogImage = clinicShareImage(clinic, clinicId);

  const lat =
    overlay && overlay.latitude != null
      ? Number(overlay.latitude)
      : clinic.latitude != null
        ? Number(clinic.latitude)
        : null;
  const lng =
    overlay && overlay.longitude != null
      ? Number(overlay.longitude)
      : clinic.longitude != null
        ? Number(clinic.longitude)
        : null;

  const contactInfo = Object.assign(
    {},
    clinic.contact_info || {},
    (overlay && overlay.contact_info) || {}
  );
  if (phone && !contactInfo.phone) contactInfo.phone = phone;
  if (display.addressRaw && !contactInfo.address) {
    contactInfo.address = display.addressRaw;
  }

  const medicalSpecialty = localMods.specialty;

  const entityType =
    clinic.entityType === 'Physician' || clinic.entity_type === 'Physician'
      ? 'Physician'
      : 'MedicalClinic';

  const medicalEntity = buildMedicalEntityJsonLd({
    entityType,
    name,
    medicalSpecialty,
    address: {
      street: address,
      city: localMods.city || 'شیراز',
      region: 'فارس',
      country: 'IR',
    },
    telephone: contactInfo.phone || phone,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    ratingValue: clinic.ratingValue != null ? clinic.ratingValue : clinic.rating,
    reviewCount:
      clinic.reviewCount != null
        ? clinic.reviewCount
        : clinic.ratingCount != null
          ? clinic.ratingCount
          : clinic.reviewsCount,
    url: clinicSlug.clinicProfilePath(clinicId),
    image: clinic.image,
    description: schemaDescription,
  });

  const faqs = clinicProfileFaqs(clinic, {
    name,
    city: localMods.city,
    specialty: localMods.specialty,
  });
  const faqSchema = buildFaqPageJsonLd(faqs);

  const crumbs = buildClinicBreadcrumbPayload(clinic, {
    clinicId,
    name,
    city: localMods.city || 'شیراز',
    specialty: localMods.specialty,
    profileUrl: clinicSlug.clinicProfilePath(clinicId),
  });

  let out = injectHeadSeo(html, {
    title,
    description,
    ogTitle,
    ogDescription: description,
    canonical,
    ogImage,
    jsonLd: [medicalEntity, crumbs.jsonLd, faqSchema].filter(Boolean),
  });
  out = injectProfileBreadcrumb(out, crumbs.html);
  out = injectProfileH1(out, seo.h1);
  out = injectProfileFaqs(out, faqs);
  out = injectClinicContactPlaceholders(out, display.phone, display.address);
  out = injectClinicMapPlaceholders(
    out,
    Number.isFinite(lat) ? lat : null,
    Number.isFinite(lng) ? lng : null,
    name
  );
  return out;
}

function loadClinicOverlayForSeo(clinicId) {
  const db = openDb();
  try {
    const row = db
      .prepare(
        `SELECT clinic_id, intro, contact_info, address, latitude, longitude, services_json,
                dept1_title, dept1_phone, dept1_whatsapp,
                dept2_title, dept2_phone, dept2_whatsapp, updated_at
         FROM clinic_profiles WHERE clinic_id = ?`
      )
      .get(clinicId);
    if (!row) return null;
    return serializeClinicProfileRow(row, null);
  } catch (_err) {
    return null;
  } finally {
    db.close();
  }
}

function readProfileHtmlTemplate() {
  return fs.readFileSync(path.join(ROOT, 'profile.html'), 'utf8');
}

function injectClinicBootstrap(html, payload) {
  const tag = `<script>window.__CLINIC_PROFILE__=${JSON.stringify(payload)};</script>`;
  if (String(html).includes('<!-- DYNAMIC_CLINIC_BOOTSTRAP -->')) {
    return String(html).replace('<!-- DYNAMIC_CLINIC_BOOTSTRAP -->', tag);
  }
  return String(html).replace(/<\/head>/i, `  ${tag}\n</head>`);
}

function handleProfilePageById(req, res, clinicId, doctorData) {
  if (!Number.isInteger(clinicId) || clinicId <= 0) {
    sendRedirect(res, '/', req.method || 'GET');
    return;
  }

  clinicSlug.registerClinics(loadClinicsData());

  let html;
  try {
    html = readProfileHtmlTemplate();
  } catch (err) {
    console.error('Failed to read profile.html:', err);
    sendText(res, 500, 'Profile page unavailable');
    return;
  }

  const clinic =
    (doctorData && doctorData.clinic) || loadClinicById(clinicId);
  const slug =
    (doctorData && doctorData.slug) ||
    clinicSlug.slugForClinic(clinic || { id: clinicId });
  html = injectClinicBootstrap(html, {
    id: clinicId,
    slug,
    name: (doctorData && doctorData.name) || (clinic && (clinic.name || clinic.sliderTitle)) || null,
  });

  if (clinic) {
    const overlay = loadClinicOverlayForSeo(clinicId);
    html = injectProfileMeta(html, clinic, clinicId, overlay);
  } else {
    html = injectHeadSeo(html, {
      title: 'پروفایل کلینیک | سلام دکتر',
      description: 'پروفایل کلینیک و پزشک - سلام دکتر',
      canonical: clinicProfileUrl(clinicId),
      ogImage: DEFAULT_OG_IMAGE,
    });
    html = injectClinicContactPlaceholders(html, 'ثبت نشده', 'ثبت نشده');
    html = injectClinicMapPlaceholders(html, null, null, 'شیراز');
    html = injectProfileFaqs(html, defaultClinicProfileFaqs({ name: 'این مرکز', city: 'شیراز' }));
  }

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
  res.end(html);
}

async function findClinicIdBySlug(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key) return null;

  // Prefer in-memory / JSON maps (includes legacy redirects).
  if (clinicSlug && typeof clinicSlug.idFromSlug === 'function') {
    const fromCache = clinicSlug.idFromSlug(key);
    if (fromCache) return fromCache;
  }

  let prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    const row = await prisma.clinic.findFirst({
      where: { slug: { equals: key, mode: 'insensitive' } },
      select: { id: true, slug: true },
    });
    if (row && Number.isInteger(row.id)) {
      console.log('[profiles] DB slug hit', { slug: key, id: row.id, storedSlug: row.slug });
      return row.id;
    }
    console.warn('[profiles] DB slug miss', {
      query: { slug: { equals: key, mode: 'insensitive' } },
    });
    return null;
  } catch (err) {
    console.warn('[profiles] DB slug lookup failed:', (err && err.message) || err);
    return null;
  } finally {
    if (prisma) {
      try {
        await prisma.$disconnect();
      } catch (_e) {
        /* ignore */
      }
    }
  }
}

function decodeDoctorSlugFromPath(pathname) {
  const raw = String(pathname || '')
    .replace(/^\/doctor\/?/i, '')
    .split('/')[0]
    .split('?')[0];
  if (!raw) return '';
  try {
    return decodeURIComponent(raw).trim();
  } catch (_err) {
    return String(raw).trim();
  }
}

/**
 * Native fallback when Express doctorApp failed to boot — still before static/404.
 * All doctor/profile redirects are HTTP 301 (never 302), single-hop to clean slug.
 */
async function tryHandleDoctorProfileNative(req, res, pathname, method) {
  if (!(method === 'GET' || method === 'HEAD')) return false;

  if (pathname === '/profile.html' || pathname === '/profiles.html') {
    const url = new URL(req.url || '/', 'http://localhost');
    const rawId = validQueryId(url.searchParams.get('id') || url.searchParams.get('clinic_id'));
    if (!rawId) {
      sendPermanentRedirect(res, '/', method);
      return true;
    }
    const id = Number.parseInt(rawId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      sendPermanentRedirect(res, '/', method);
      return true;
    }
    const clinic = loadClinicById(id);
    const doctorSlug = clinicSlug.slugForClinic(clinic || { id });
    if (!doctorSlug) {
      sendPermanentRedirect(res, '/', method);
      return true;
    }
    sendPermanentRedirect(res, `/doctor/${doctorSlug}`, method);
    return true;
  }

  if (!pathname.startsWith('/doctor/')) return false;

  const slug = decodeDoctorSlugFromPath(pathname);
  if (!slug) {
    sendPermanentRedirect(res, '/', method);
    return true;
  }

  if (slug.startsWith('sample-clinic')) {
    sendPermanentRedirect(res, '/shiraz', method);
    return true;
  }

  const id = await findClinicIdBySlug(slug);
  if (!id) {
    console.error(`[Doctor Route] Slug not found: ${slug}`);
    sendNotFound(res, 'Profile not found');
    return true;
  }

  const clinic = loadClinicById(id);
  const doctorSlug = clinicSlug.slugForClinic(clinic || { id });
  if (!doctorSlug) {
    sendNotFound(res, 'Profile not found');
    return true;
  }

  const key = String(slug).trim().toLowerCase();
  if (key !== doctorSlug) {
    // Direct 301 to clean slug — avoids clinic-:id intermediate hops
    sendPermanentRedirect(res, `/doctor/${doctorSlug}`, method);
    return true;
  }

  handleProfilePageById(req, res, id);
  return true;
}

try {
  if (typeof createDoctorProfileApp === 'function') {
    doctorApp = createDoctorProfileApp({
      serveProfileById: handleProfilePageById,
      loadClinicById,
      findClinicIdBySlug,
    });
  } else {
    doctorApp = null;
    console.warn('[profiles] /doctor/:slug using native fallback (Express app unavailable)');
  }
} catch (err) {
  console.warn('[profiles] /doctor/:slug routes disabled:', (err && err.message) || err);
  doctorApp = null;
}

function loadClinicsCatalog() {
  return loadClinicsData()
      .filter((c) => c && Number.isInteger(c.id))
      .map((c) => ({ id: c.id, name: trimOrNull(c.name) || trimOrNull(c.sliderTitle) || ('مرکز ' + c.id) }))
      .sort((a, b) => a.id - b.id);
}

function sanitizeClinicIntro(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li',
      'h2', 'h3', 'h4', 'a', 'div', 'span', 'section', 'blockquote',
      'figure', 'figcaption', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'class', 'dir'],
      div: ['class', 'id', 'role', 'aria-label', 'aria-labelledby'],
      section: ['class', 'id', 'role', 'aria-label', 'aria-labelledby'],
      span: ['class', 'aria-hidden', 'id'],
      p: ['class'],
      blockquote: ['class'],
      figure: ['class'],
      figcaption: ['class'],
      img: ['src', 'alt', 'class', 'loading', 'decoding', 'width', 'height'],
      table: ['class'],
      thead: ['class'],
      tbody: ['class'],
      tr: ['class'],
      th: ['class', 'scope'],
      td: ['class'],
      ul: ['class'],
      ol: ['class'],
      li: ['class', 'data-intro-support-phone'],
      h2: ['class', 'id'],
      h3: ['class', 'id'],
      h4: ['class', 'id'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  }).trim();
}

/**
 * Strip an (already-sanitized) HTML intro down to plain text for use in
 * JSON-LD `description` fields, which must not contain markup. Truncates
 * to maxLen without cutting a word in half.
 */
function htmlToPlainText(html, maxLen) {
  const text = sanitizeHtml(String(html || ''), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, ' ')
    .trim();
  if (!maxLen || text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

function clinicStaticIntroPath(clinicId) {
  return path.join(__dirname, 'clinic-intros', String(clinicId) + '.html');
}

function clinicHasStaticIntroFile(clinicId) {
  try {
    return fs.existsSync(clinicStaticIntroPath(clinicId));
  } catch (_err) {
    return false;
  }
}

function introLooksStructured(html) {
  const s = String(html || '');
  return s.indexOf('clinic-intro__block') !== -1 || s.indexOf('class="clinic-intro') !== -1;
}

function writeClinicStaticIntro(clinicId, html) {
  const dir = path.join(__dirname, 'clinic-intros');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(clinicStaticIntroPath(clinicId), String(html || '').trim() + '\n', 'utf8');
}

function emptyContactInfo() {
  return {
    instagram: null,
    whatsapp: null,
    telegram: null,
    rubika: null,
    bale: null,
    rubika_title: null,
    rubika_link: null,
    bale_title: null,
    bale_link: null,
    phone: null,
    whatsapp_consult: null,
    phone_consult: null,
    address: null,
  };
}

function emptyDeptFields() {
  return {
    dept1_title: null,
    dept1_phone: null,
    dept1_whatsapp: null,
    dept2_title: null,
    dept2_phone: null,
    dept2_whatsapp: null,
  };
}

function normalizeDeptFields(raw) {
  let src = raw;
  if (typeof raw === 'string') {
    try {
      src = JSON.parse(raw);
    } catch (_err) {
      src = null;
    }
  }
  if (!src || typeof src !== 'object') return emptyDeptFields();
  return {
    dept1_title: trimOrNull(src.dept1_title || src.dept1Title),
    dept1_phone: trimOrNull(src.dept1_phone || src.dept1Phone),
    dept1_whatsapp: trimOrNull(src.dept1_whatsapp || src.dept1Whatsapp),
    dept2_title: trimOrNull(src.dept2_title || src.dept2Title),
    dept2_phone: trimOrNull(src.dept2_phone || src.dept2Phone),
    dept2_whatsapp: trimOrNull(src.dept2_whatsapp || src.dept2Whatsapp),
  };
}

function normalizeContactInfo(raw) {
  let src = raw;
  if (typeof raw === 'string') {
    try {
      src = JSON.parse(raw);
    } catch (_err) {
      src = null;
    }
  }
  if (!src || typeof src !== 'object') return emptyContactInfo();
  const rubikaLink =
    trimOrNull(src.rubika_link || src.rubikaLink) || trimOrNull(src.rubika);
  const baleLink =
    trimOrNull(src.bale_link || src.baleLink) || trimOrNull(src.bale);
  return {
    instagram: trimOrNull(src.instagram),
    whatsapp: trimOrNull(src.whatsapp),
    telegram: trimOrNull(src.telegram),
    // Legacy aliases kept for profile.html / catalog consumers
    rubika: rubikaLink,
    bale: baleLink,
    rubika_title: trimOrNull(src.rubika_title || src.rubikaTitle),
    rubika_link: rubikaLink,
    bale_title: trimOrNull(src.bale_title || src.baleTitle),
    bale_link: baleLink,
    phone: trimOrNull(src.phone),
    whatsapp_consult: trimOrNull(src.whatsapp_consult || src.whatsappConsult),
    phone_consult: trimOrNull(src.phone_consult || src.phoneConsult),
    address: trimOrNull(src.address),
  };
}

function slugifyService(value) {
  return englishSlugFromLabel(value) || 'service';
}

function normalizeServiceTag(item) {
  if (item == null) return null;
  if (typeof item === 'string') {
    const label = item.trim();
    if (!label || label === 'دارد') return null;
    const slug = slugifyService(label);
    return {
      label,
      slug,
      url: `/services/${slug}`,
    };
  }
  if (typeof item !== 'object') return null;
  const label = trimOrNull(item.label) || trimOrNull(item.name) || trimOrNull(item.title);
  if (!label) return null;
  let slug = trimOrNull(item.slug);
  let url = trimOrNull(item.url);
  if (url && url.startsWith('/services/')) {
    slug = slug || url.replace(/^\/services\//, '').split(/[?#]/)[0];
  }
  if (!slug) slug = slugifyService(label);
  slug = resolveCanonicalEnglishSlug(slug) || (isEnglishServiceSlug(slug) ? slug : slugifyService(label));
  if (!url) url = `/services/${slug}`;
  else if (url.startsWith('/services/')) url = `/services/${slug}`;
  return { label, slug, url };
}

function normalizeServicesMeta(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch (_err) {
      list = null;
    }
  }
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const tag = normalizeServiceTag(item);
    if (!tag) continue;
    const key = tag.slug || tag.label;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

function parseOptionalCoord(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  return n;
}

function serializeClinicProfileRow(row, catalogName) {
  if (!row) return null;
  const contactInfo = normalizeContactInfo(row.contact_info);
  const dept = normalizeDeptFields(row);
  const address =
    trimOrNull(row.address) || contactInfo.address || null;
  if (address && !contactInfo.address) contactInfo.address = address;
  const services = normalizeServicesMeta(row.services_json);
  return {
    clinicId: row.clinic_id,
    clinic_id: row.clinic_id,
    name: catalogName || null,
    intro: row.intro || '',
    address,
    phone: contactInfo.phone || null,
    contact_info: contactInfo,
    contactInfo,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    services,
    services_json: services,
    dept1_title: dept.dept1_title,
    dept1_phone: dept.dept1_phone,
    dept1_whatsapp: dept.dept1_whatsapp,
    dept2_title: dept.dept2_title,
    dept2_phone: dept.dept2_phone,
    dept2_whatsapp: dept.dept2_whatsapp,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
  };
}

function clinicProfileHasContent(payload) {
  if (!payload) return false;
  if (trimOrNull(payload.intro)) return true;
  if (trimOrNull(payload.address)) return true;
  if (payload.latitude != null || payload.longitude != null) return true;
  if (Array.isArray(payload.services) && payload.services.length) return true;
  if (
    payload.dept1_title ||
    payload.dept1_phone ||
    payload.dept1_whatsapp ||
    payload.dept2_title ||
    payload.dept2_phone ||
    payload.dept2_whatsapp
  ) {
    return true;
  }
  const c = payload.contact_info || payload.contactInfo || {};
  return Boolean(
    c.instagram ||
      c.whatsapp ||
      c.telegram ||
      c.rubika ||
      c.bale ||
      c.rubika_title ||
      c.rubika_link ||
      c.bale_title ||
      c.bale_link ||
      c.phone ||
      c.whatsapp_consult ||
      c.phone_consult ||
      c.address
  );
}

function handleGetClinicProfile(req, res) {
  const method = req.method || 'GET';
  const raw = trimOrNull(getSearchParams(req.url).get('clinic_id'));
  if (!raw) {
    sendRedirect(res, '/', method);
    return;
  }
  const clinicId = Number.parseInt(raw, 10);
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    sendRedirect(res, '/', method);
    return;
  }
  const catalogClinic = loadClinicById(clinicId);
  const db = openDb();
  try {
    const row = db
      .prepare(
        `SELECT clinic_id, intro, contact_info, address, latitude, longitude, services_json,
                dept1_title, dept1_phone, dept1_whatsapp,
                dept2_title, dept2_phone, dept2_whatsapp, updated_at
         FROM clinic_profiles WHERE clinic_id = ?`
      )
      .get(clinicId);

    if (row && clinicProfileHasContent(serializeClinicProfileRow(row))) {
      const payload = serializeClinicProfileRow(
        row,
        catalogClinic && (catalogClinic.name || catalogClinic.sliderTitle)
      );
      // Fallback services from static catalog when overlay has none
      if (!payload.services.length && catalogClinic && Array.isArray(catalogClinic.services)) {
        payload.services = normalizeServicesMeta(catalogClinic.services);
        payload.services_json = payload.services;
      }
      // Fallback contact phone / address from catalog
      if (!payload.contact_info.phone && catalogClinic && catalogClinic.phone) {
        payload.contact_info.phone = String(catalogClinic.phone).trim() || null;
        payload.phone = payload.contact_info.phone;
        payload.contactInfo = payload.contact_info;
      }
      if (!payload.address && catalogClinic && catalogClinic.address) {
        payload.address = String(catalogClinic.address).trim() || null;
        payload.contact_info.address = payload.address;
        payload.contactInfo = payload.contact_info;
      }
      payload.slug = clinicSlug.slugForClinic(clinicId);
      payload.profileUrl = clinicSlug.clinicProfilePath(clinicId);
      sendJson(res, 200, payload, method);
      return;
    }

    // No overlay row — still return catalog-derived structure when useful
    if (catalogClinic) {
      sendJson(
        res,
        200,
        {
          clinicId,
          clinic_id: clinicId,
          slug: clinicSlug.slugForClinic(clinicId),
          profileUrl: clinicSlug.clinicProfilePath(clinicId),
          name: catalogClinic.name || catalogClinic.sliderTitle || null,
          intro: null,
          address: trimOrNull(catalogClinic.address),
          phone: trimOrNull(catalogClinic.phone),
          contact_info: {
            ...emptyContactInfo(),
            phone: trimOrNull(catalogClinic.phone),
            address: trimOrNull(catalogClinic.address),
          },
          contactInfo: {
            ...emptyContactInfo(),
            phone: trimOrNull(catalogClinic.phone),
            address: trimOrNull(catalogClinic.address),
          },
          latitude: parseOptionalCoord(catalogClinic.latitude),
          longitude: parseOptionalCoord(catalogClinic.longitude),
          services: normalizeServicesMeta(catalogClinic.services || []),
          services_json: normalizeServicesMeta(catalogClinic.services || []),
          ...emptyDeptFields(),
          updatedAt: null,
          updated_at: null,
          fromCatalog: true,
        },
        method
      );
      return;
    }

    sendJson(res, 200, null, method);
  } catch (err) {
    console.error('Failed to read clinic profile:', err);
    sendJson(res, 500, { error: 'Failed to read clinic profile' }, method);
  } finally {
    db.close();
  }
}

function handleAdminClinicsCatalog(res) {
  sendJson(res, 200, loadClinicsCatalog());
}

function handleAdminClinicProfilesList(res) {
  const db = openDb();
  try {
    const catalog = new Map(
      loadClinicsCatalog().map((c) => [c.id, c.name])
    );
    const rows = db
      .prepare(
        `SELECT clinic_id, intro, contact_info, address, latitude, longitude, services_json,
                dept1_title, dept1_phone, dept1_whatsapp,
                dept2_title, dept2_phone, dept2_whatsapp, updated_at
         FROM clinic_profiles ORDER BY clinic_id ASC`
      )
      .all();
    sendJson(
      res,
      200,
      rows.map((row) => serializeClinicProfileRow(row, catalog.get(row.clinic_id)))
    );
  } catch (err) {
    console.error('Failed to list clinic profiles:', err);
    sendJson(res, 500, { error: 'Failed to list clinic profiles' });
  } finally {
    db.close();
  }
}

async function handleAdminClinicProfilePost(req, res) {
  const data = await readJsonBody(req, res);
  if (!data) return;

  const clinicId = Number.parseInt(String(data.clinic_id ?? data.clinicId ?? ''), 10);
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    sendJson(res, 400, { error: 'Invalid or missing clinic_id' });
    return;
  }
  if (!loadClinicById(clinicId)) {
    sendJson(res, 400, { error: `Unknown clinic_id: ${clinicId}` });
    return;
  }

  const intro = sanitizeClinicIntro(data.intro || '');
  const contactInfo = normalizeContactInfo({
    ...(data.contact_info || data.contactInfo || {}),
    ...data,
  });
  // Allow top-level address/phone overrides from admin form
  const addressOverride = trimOrNull(data.address);
  const phoneOverride = trimOrNull(data.phone);
  if (addressOverride) contactInfo.address = addressOverride;
  if (phoneOverride) contactInfo.phone = phoneOverride;

  const latitude = parseOptionalCoord(data.latitude);
  const longitude = parseOptionalCoord(data.longitude);
  if (latitude != null && (latitude < -90 || latitude > 90)) {
    sendJson(res, 400, { error: 'latitude must be between -90 and 90' });
    return;
  }
  if (longitude != null && (longitude < -180 || longitude > 180)) {
    sendJson(res, 400, { error: 'longitude must be between -180 and 180' });
    return;
  }

  const services = normalizeServicesMeta(
    data.services || data.services_json || data.servicesMeta || []
  );

  const dept = normalizeDeptFields({
    ...(data.contact_info || data.contactInfo || {}),
    ...data,
  });

  // Prefer structured HTML: save to clinic-intros/{id}.html so profile layout stays rich.
  // Flat Quill HTML must not overwrite an existing curated template.
  const usesStaticIntro = clinicHasStaticIntroFile(clinicId);
  const structuredIntro = introLooksStructured(intro);
  let introToStore = '';
  let skipIntroColumn = false;

  if (structuredIntro) {
    // SQLite is the source of truth for profile display; also sync static file when possible
    // (Docker must mount ./clinic-intros or nginx will keep serving a stale host copy).
    introToStore = intro;
    try {
      writeClinicStaticIntro(clinicId, intro);
    } catch (err) {
      console.warn('[clinic] failed to write static intro (DB still saved):', err && err.message);
    }
  } else if (usesStaticIntro) {
    // Keep curated template; ignore Quill-flattened intro on save
    skipIntroColumn = true;
    introToStore = '';
  } else {
    introToStore =
      trimOrNull(intro) && intro !== '<p><br></p>' ? intro : '';
  }

  const hasIntro = Boolean(trimOrNull(introToStore)) || skipIntroColumn || usesStaticIntro;
  const hasContact = Boolean(
    contactInfo.instagram ||
      contactInfo.whatsapp ||
      contactInfo.telegram ||
      contactInfo.rubika ||
      contactInfo.bale ||
      contactInfo.rubika_title ||
      contactInfo.rubika_link ||
      contactInfo.bale_title ||
      contactInfo.bale_link ||
      contactInfo.phone ||
      contactInfo.whatsapp_consult ||
      contactInfo.phone_consult ||
      contactInfo.address
  );
  const hasCoords = latitude != null || longitude != null;
  const hasServices = services.length > 0;
  const hasDept = Boolean(
    dept.dept1_title ||
      dept.dept1_phone ||
      dept.dept1_whatsapp ||
      dept.dept2_title ||
      dept.dept2_phone ||
      dept.dept2_whatsapp
  );
  if (!hasIntro && !hasContact && !hasCoords && !hasServices && !hasDept && !usesStaticIntro) {
    sendJson(res, 400, {
      error:
        'Provide at least one of: intro, contact_info (phone/address/socials), departments, latitude/longitude, or services',
    });
    return;
  }

  const record = {
    clinic_id: clinicId,
    intro: introToStore,
    skip_intro: skipIntroColumn ? 1 : 0,
    contact_info: JSON.stringify(contactInfo),
    address: contactInfo.address || null,
    latitude,
    longitude,
    services_json: JSON.stringify(services),
    dept1_title: dept.dept1_title,
    dept1_phone: dept.dept1_phone,
    dept1_whatsapp: dept.dept1_whatsapp,
    dept2_title: dept.dept2_title,
    dept2_phone: dept.dept2_phone,
    dept2_whatsapp: dept.dept2_whatsapp,
    updated_at: nowIso(),
  };

  const db = openDb();
  try {
    db.prepare(`
      INSERT INTO clinic_profiles (
        clinic_id, intro, contact_info, address, latitude, longitude, services_json,
        dept1_title, dept1_phone, dept1_whatsapp,
        dept2_title, dept2_phone, dept2_whatsapp, updated_at
      ) VALUES (
        @clinic_id, @intro, @contact_info, @address, @latitude, @longitude, @services_json,
        @dept1_title, @dept1_phone, @dept1_whatsapp,
        @dept2_title, @dept2_phone, @dept2_whatsapp, @updated_at
      )
      ON CONFLICT(clinic_id) DO UPDATE SET
        intro = CASE WHEN @skip_intro = 1 THEN clinic_profiles.intro ELSE excluded.intro END,
        contact_info = excluded.contact_info,
        address = excluded.address,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        services_json = excluded.services_json,
        dept1_title = excluded.dept1_title,
        dept1_phone = excluded.dept1_phone,
        dept1_whatsapp = excluded.dept1_whatsapp,
        dept2_title = excluded.dept2_title,
        dept2_phone = excluded.dept2_phone,
        dept2_whatsapp = excluded.dept2_whatsapp,
        updated_at = excluded.updated_at
    `).run(record);

    const saved = db
      .prepare(
        `SELECT clinic_id, intro, contact_info, address, latitude, longitude, services_json,
                dept1_title, dept1_phone, dept1_whatsapp,
                dept2_title, dept2_phone, dept2_whatsapp, updated_at
         FROM clinic_profiles WHERE clinic_id = ?`
      )
      .get(clinicId);
    const catalog = loadClinicById(clinicId);
    // Best-effort sync to PostgreSQL clinics table when available
    syncClinicContactToPostgres(
      clinicId,
      contactInfo.phone,
      contactInfo.address,
      dept,
      contactInfo
    ).catch(
      (err) => console.warn('[clinic] postgres sync skipped:', err && err.message)
    );
    sendJson(res, 200, {
      success: true,
      profile: serializeClinicProfileRow(
        saved,
        catalog && (catalog.name || catalog.sliderTitle)
      ),
    });
  } catch (err) {
    console.error('Failed to save clinic profile:', err);
    sendJson(res, 500, { error: 'Failed to save clinic profile' });
  } finally {
    db.close();
  }
}

function handleAdminClinicProfileDelete(req, res) {
  const clinicId = Number.parseInt(
    String(getSearchParams(req.url).get('clinic_id') || ''),
    10
  );
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    sendJson(res, 400, { error: 'Missing required query parameter: clinic_id' });
    return;
  }
  const db = openDb();
  try {
    const result = db
      .prepare('DELETE FROM clinic_profiles WHERE clinic_id = ?')
      .run(clinicId);
    if (!result.changes) {
      sendJson(res, 404, { error: 'Clinic profile not found' });
      return;
    }
    sendJson(res, 200, { success: true, clinic_id: clinicId });
  } catch (err) {
    console.error('Failed to delete clinic profile:', err);
    sendJson(res, 500, { error: 'Failed to delete clinic profile' });
  } finally {
    db.close();
  }
}

function handleGetPublishedArticles(res) {
  const db = openDb();
  try {
    const rows = db.prepare(`
      SELECT id, slug, title, summary, cover_image, category, author, published_at
      FROM articles
      WHERE status = 'published'
      ORDER BY published_at DESC
    `).all();
    const staticRows = listStaticArticles(ARTICLES_DIR).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      cover_image: row.cover_image,
      category: row.category,
      author: row.author,
      published_at: row.published_at,
      url: row.url,
      source: 'static',
    }));
    const seen = new Set();
    const merged = [];
    staticRows.forEach((row) => {
      seen.add(row.slug);
      merged.push(row);
    });
    rows.forEach((row) => {
      if (seen.has(row.slug)) return;
      seen.add(row.slug);
      merged.push({
        ...row,
        url: '/article/' + encodeURIComponent(row.slug),
        source: 'db',
      });
    });
    merged.sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
    sendJson(res, 200, merged);
  } catch (err) {
    console.error('Failed to list published articles:', err);
    sendJson(res, 500, { error: 'Failed to list articles' });
  } finally {
    db.close();
  }
}

function handleGetArticleBySlug(slug, res) {
  const db = openDb();
  try {
    const row = db.prepare(`
      SELECT * FROM articles WHERE slug = ? AND status = 'published'
    `).get(slug);
    if (!row) {
      sendJson(res, 404, { error: 'Article not found' });
      return;
    }
    db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(row.id);
    row.views = (row.views || 0) + 1;
    sendJson(res, 200, row);
  } catch (err) {
    console.error('Failed to read article:', err);
    sendJson(res, 500, { error: 'Failed to read article' });
  } finally {
    db.close();
  }
}

function handleArticlePage(slug, res) {
  const db = openDb();
  try {
    const row = db.prepare(`
      SELECT id, slug, title, summary, cover_image, body_html, category, author,
             published_at, updated_at, views, hub_url, hub_keyword
      FROM articles WHERE slug = ? AND status = 'published'
    `).get(slug);
    if (!row) {
      sendHtml(res, 404, renderArticleNotFound());
      return;
    }
    db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(row.id);
    row.views = (row.views || 0) + 1;
    if (articleTemplate) {
      articleTemplate.renderArticle(row)
        .then((html) => sendHtml(res, 200, html))
        .catch((err) => {
          console.error('[articles] EJS render failed, using legacy renderer:', err && err.message);
          sendHtml(res, 200, renderArticlePage(row));
        });
      return;
    }
    sendHtml(res, 200, renderArticlePage(row));
  } catch (err) {
    console.error('Failed to render article page:', err);
    sendText(res, 500, 'Internal server error');
  } finally {
    db.close();
  }
}

function handleSitemapArticles(res, method) {
  const httpMethod = method || 'GET';
  try {
    const bySlug = new Map();
    listStaticArticles(ARTICLES_DIR).forEach((row) => {
      const slug = String(row.slug || '').trim();
      if (!slug) return;
      const rel = row.url || `/articles/${slug}.html`;
      bySlug.set(slug, {
        loc: SITE_BASE + (rel.startsWith('/') ? rel : '/' + rel),
        lastmod: sitemapLastmod(row.updated_at || row.published_at),
      });
    });

    const db = openDb();
    try {
      const rows = db.prepare(`
        SELECT slug, updated_at, published_at
        FROM articles WHERE status = 'published'
        ORDER BY published_at DESC
      `).all();
      rows.forEach((row) => {
        const slug = String(row.slug || '').trim();
        if (!slug || bySlug.has(slug)) return;
        const staticPath = path.join(ARTICLES_DIR, slug + '.html');
        if (!fs.existsSync(staticPath)) return;
        bySlug.set(slug, {
          loc: `${SITE_BASE}/articles/${slug}.html`,
          lastmod: sitemapLastmod(row.updated_at || row.published_at),
        });
      });
    } finally {
      db.close();
    }

    const urls = [...bySlug.values()]
      .sort((a, b) => String(a.loc).localeCompare(String(b.loc), 'fa'))
      .map((entry) => {
        const lastmod = entry.lastmod || sitemapLastmod();
        return `  <url>\n    <loc>${escapeHtmlAttr(entry.loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
      })
      .join('\n');

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      '</urlset>',
    ].join('\n');
    sendXml(res, 200, xml, httpMethod);
  } catch (err) {
    console.error('Failed to build articles sitemap:', err);
    sendText(res, 500, 'Internal server error');
  }
}

function handleAdminArticlesListOrGet(req, res) {
  const id = trimOrNull(getSearchParams(req.url).get('id'));
  const db = openDb();
  try {
    if (id) {
      if (isStaticArticleId(id)) {
        const staticRow = getStaticArticleById(id, ARTICLES_DIR);
        if (!staticRow) {
          sendJson(res, 404, { error: 'Article not found' });
          return;
        }
        sendJson(res, 200, staticRow);
        return;
      }
      const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
      if (!row) {
        sendJson(res, 404, { error: 'Article not found' });
        return;
      }
      sendJson(res, 200, row);
      return;
    }
    const rows = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC').all();
    const staticRows = listStaticArticles(ARTICLES_DIR);
    const merged = staticRows.concat(rows).sort((a, b) => {
      const aDate = a.updated_at || a.published_at || '';
      const bDate = b.updated_at || b.published_at || '';
      return String(bDate).localeCompare(String(aDate));
    });
    sendJson(res, 200, merged);
  } catch (err) {
    console.error('Failed to list admin articles:', err);
    sendJson(res, 500, { error: 'Failed to list articles' });
  } finally {
    db.close();
  }
}

async function handleAdminArticlesPost(req, res) {
  const data = await readJsonBody(req, res);
  if (!data) return;

  const title = trimOrNull(data.title);
  const rawBody = typeof data.body_html === 'string' ? data.body_html : '';
  const bodyHtml = cleanBody(rawBody);

  if (!title) {
    sendJson(res, 400, { error: 'Missing required field: title' });
    return;
  }
  if (!bodyHtml.trim()) {
    sendJson(res, 400, { error: 'Missing required field: body_html' });
    return;
  }

  const bodyId = trimOrNull(data.id);
  if (isStaticArticleId(bodyId)) {
    try {
      const saved = saveStaticArticle(ARTICLES_DIR, bodyId, {
        title,
        summary: trimOrNull(data.summary),
        cover_image: trimOrNull(data.cover_image),
        body_html: bodyHtml,
        category: trimOrNull(data.category),
        author: trimOrNull(data.author) || 'تیم سلام دکتر',
        published_at: trimOrNull(data.published_at),
        date_label: trimOrNull(data.date_label),
      });
      refreshArticlesCatalog();
      sendJson(res, 200, { success: true, article: saved });
    } catch (err) {
      console.error('Failed to save static article:', err);
      sendJson(res, 500, { error: 'Failed to save static article' });
    }
    return;
  }
  const status = data.status === 'published' ? 'published' : 'draft';
  const publishedAtInput = trimOrNull(data.published_at);
  const record = {
    title,
    summary: trimOrNull(data.summary),
    cover_image: trimOrNull(data.cover_image),
    body_html: bodyHtml,
    category: trimOrNull(data.category),
    author: trimOrNull(data.author) || 'تیم سلام دکتر',
    status,
    // Optional per-article hub override for the in-article conversion widget
    // (falls back to keyword auto-matching in articleTemplate.resolveHub).
    hub_url: trimOrNull(data.hub_url),
    hub_keyword: trimOrNull(data.hub_keyword),
    updated_at: nowIso(),
  };

  const db = openDb();
  try {
    const rawSlug = trimOrNull(data.slug) || title;
    const slug = uniqueSlug(db, makeSlug(rawSlug), bodyId);

    if (bodyId) {
      const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(bodyId);
      if (existing) {
        const publishedAt = publishedAtInput
          ? publishedAtInput.slice(0, 10)
          : (status === 'published'
            ? (existing.published_at || nowIso())
            : existing.published_at);
        db.prepare(`
          UPDATE articles SET
            slug = @slug,
            title = @title,
            summary = @summary,
            cover_image = @cover_image,
            body_html = @body_html,
            category = @category,
            author = @author,
            status = @status,
            hub_url = @hub_url,
            hub_keyword = @hub_keyword,
            updated_at = @updated_at,
            published_at = @published_at
          WHERE id = @id
        `).run({
          id: bodyId,
          slug,
          ...record,
          published_at: publishedAt,
        });
        const saved = db.prepare('SELECT * FROM articles WHERE id = ?').get(bodyId);
        sendJson(res, 200, { success: true, article: saved });
        return;
      }
    }

    const id = bodyId || uniqueId();
    const ts = nowIso();
    const publishedAt = publishedAtInput
      ? publishedAtInput.slice(0, 10)
      : (status === 'published' ? ts : null);
    db.prepare(`
      INSERT INTO articles (
        id, slug, title, summary, cover_image, body_html, category, author,
        status, views, created_at, updated_at, published_at, hub_url, hub_keyword
      ) VALUES (
        @id, @slug, @title, @summary, @cover_image, @body_html, @category, @author,
        @status, 0, @created_at, @updated_at, @published_at, @hub_url, @hub_keyword
      )
    `).run({
      id,
      slug,
      ...record,
      created_at: ts,
      published_at: publishedAt,
    });
    const saved = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
    sendJson(res, 201, { success: true, article: saved });
  } catch (err) {
    console.error('Failed to save article:', err);
    sendJson(res, 500, { error: 'Failed to save article' });
  } finally {
    db.close();
  }
}

function handleAdminArticlesDelete(req, res) {
  const id = trimOrNull(getSearchParams(req.url).get('id'));
  if (!id) {
    sendJson(res, 400, { error: 'Missing required query parameter: id' });
    return;
  }
  if (isStaticArticleId(id)) {
    sendJson(res, 400, { error: 'مقالات استاتیک از پنل ادمین حذف نمی‌شوند.' });
    return;
  }

  const db = openDb();
  try {
    const result = db.prepare('DELETE FROM articles WHERE id = ?').run(id);
    if (!result.changes) {
      sendJson(res, 404, { error: 'Article not found' });
      return;
    }
    sendJson(res, 200, { success: true, id });
  } catch (err) {
    console.error('Failed to delete article:', err);
    sendJson(res, 500, { error: 'Failed to delete article' });
  } finally {
    db.close();
  }
}

async function handleAdminUpload(req, res) {
  const data = await readJsonBody(req, res, 1024 * 1024 * 5);
  if (!data) return;

  let base64 = typeof data.dataBase64 === 'string' ? data.dataBase64.trim() : '';
  if (!base64) {
    sendJson(res, 400, { error: 'Missing required field: dataBase64' });
    return;
  }

  const comma = base64.indexOf(',');
  if (comma !== -1 && base64.slice(0, comma).includes('base64')) {
    base64 = base64.slice(comma + 1);
  }

  let buf;
  try {
    buf = Buffer.from(base64, 'base64');
  } catch {
    sendJson(res, 400, { error: 'Invalid base64 data' });
    return;
  }

  if (!buf.length) {
    sendJson(res, 400, { error: 'Empty file data' });
    return;
  }
  if (buf.length > 3 * 1024 * 1024) {
    sendJson(res, 400, { error: 'File too large (max 3 MB)' });
    return;
  }

  const imageType = detectImageType(buf);
  const ext = imageExtension(imageType);
  if (!ext) {
    sendJson(res, 400, { error: 'Unsupported image type (jpeg, png, webp only)' });
    return;
  }

  ensureUploadsDir();
  const filename = uniqueId() + ext;
  const filePath = path.join(UPLOADS_DIR, filename);

  try {
    fs.writeFileSync(filePath, buf);
    sendJson(res, 201, { url: '/uploads/' + filename });
  } catch (err) {
    console.error('Failed to save upload:', err);
    sendJson(res, 500, { error: 'Failed to save upload' });
  }
}

function getSessionSummary(session) {
  return {
    id: session.id,
    connectedAt: session.connectedAt,
    lastMessage: session.lastMessage,
    messageCount: session.messages.length,
    unread: session.unread,
  };
}

function getSessionPayload(session) {
  return {
    ...getSessionSummary(session),
    messages: session.messages,
  };
}

function broadcastSessionList(io) {
  io.to('admin').emit('session:list', Array.from(chatSessions.values()).map(getSessionSummary));
}

function resolveSocketRole(socket) {
  const referer = String(socket.handshake.headers.referer || '');
  return socket.handshake.auth?.role
    || socket.handshake.query?.role
    || (referer.includes('/admin.html') ? 'admin' : 'user');
}

const categoryMonetize = createCategoryMonetizeHandlers({
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
});

const serviceLanding = createServiceLandingHandlers({
  rootDir: ROOT,
  siteBase: SITE_BASE,
  ogImage: DEFAULT_OG_IMAGE,
  headerHtml: HEADER_HTML,
  drawerHtml: DRAWER_HTML,
  footerHtml: FOOTER_HTML,
  openDb,
  loadClinicsData,
  normalizeServicesMeta,
  sendHtml,
  sendJson,
  sendText,
  sendRedirect,
});

let serviceApp = null;
try {
  serviceApp = createServiceLandingApp({
    rootDir: ROOT,
    siteBase: SITE_BASE,
    ogImage: DEFAULT_OG_IMAGE,
    headerHtml: HEADER_HTML,
    drawerHtml: DRAWER_HTML,
    footerHtml: FOOTER_HTML,
    openDb,
    loadClinicsData,
    normalizeServicesMeta,
    sendHtml,
    sendJson,
    sendText,
    sendRedirect,
  });
} catch (err) {
  console.warn('[services] Express service routes disabled:', (err && err.message) || err);
  serviceApp = null;
}

try {
  commercialLandingApp = require('./commercialLandingRouter').createCommercialLandingApp({
    rootDir: ROOT,
    siteBase: SITE_BASE,
    openDb,
    loadClinicsData,
  });
} catch (err) {
  console.warn('[commercial-landing] routes disabled:', (err && err.message) || err);
  commercialLandingApp = null;
}

function loadSqliteServiceSlugs() {
  const slugs = [];
  const db = openDb();
  try {
    const rows = db
      .prepare(
        `SELECT services_json FROM clinic_profiles
         WHERE services_json IS NOT NULL AND TRIM(services_json) != ''`
      )
      .all();
    for (const row of rows) {
      const list = normalizeServicesMeta(row.services_json);
      for (const tag of list) {
        if (tag && tag.slug) slugs.push(String(tag.slug).trim().toLowerCase());
      }
    }
  } finally {
    db.close();
  }
  return slugs;
}

async function loadPostgresServiceSlugs() {
  if (!process.env.DATABASE_URL) return [];
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const slugs = new Set();
  try {
    // Distinct taxonomy slugs from services table
    const services = await prisma.service.findMany({
      select: { slug: true },
      distinct: ['slug'],
    });
    for (const s of services) {
      const slug = String(s.slug || '')
        .trim()
        .toLowerCase();
      if (slug) slugs.add(slug);
    }

    // DISTINCT slugs linked to ACTIVE clinics (raw SQL)
    try {
      const activeLinked = await prisma.$queryRaw`
        SELECT DISTINCT s.slug AS slug
        FROM services s
        INNER JOIN clinic_services cs ON cs.service_id = s.id
        INNER JOIN clinics c ON c.id = cs.clinic_id
        WHERE c.contract_status = 'ACTIVE'
          AND s.slug IS NOT NULL
          AND TRIM(s.slug) <> ''
      `;
      for (const row of activeLinked || []) {
        const slug = String(row.slug || '')
          .trim()
          .toLowerCase();
        if (slug) slugs.add(slug);
      }
    } catch (rawErr) {
      console.warn(
        '[seo] DISTINCT active service slug query skipped:',
        (rawErr && rawErr.message) || rawErr
      );
    }

    // Approved medical device brands → /services/{brand} and /services/{brand}-laser
    try {
      const devices = await prisma.medicalDevice.findMany({
        where: { verificationStatus: 'APPROVED' },
        select: { brandName: true },
      });
      for (const d of devices) {
        const brand = String(d.brandName || '').trim();
        if (!brand) continue;
        const base = brand
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (!base || !isEnglishServiceSlug(base)) continue;
        const canonical = resolveCanonicalEnglishSlug(base) || resolveCanonicalEnglishSlug(base + '-laser');
        if (canonical) slugs.add(canonical);
        else {
          slugs.add(base);
          if (!/-laser$/.test(base)) slugs.add(base + '-laser');
        }
      }
    } catch (devErr) {
      console.warn(
        '[seo] medical device brand slugs skipped:',
        (devErr && devErr.message) || devErr
      );
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
  return Array.from(slugs);
}

async function loadUniqueServiceSlugs() {
  const slugs = new Set();

  try {
    for (const s of loadSqliteServiceSlugs()) slugs.add(s);
  } catch (err) {
    console.warn('[seo] sqlite service slug scan failed:', (err && err.message) || err);
  }

  try {
    for (const clinic of loadClinicsData()) {
      if (!clinic || !Array.isArray(clinic.services)) continue;
      for (const s of clinic.services) {
        if (s && typeof s === 'object' && s.slug) {
          slugs.add(String(s.slug).trim().toLowerCase());
        }
      }
    }
  } catch (_err) {
    /* ignore */
  }

  Object.keys(SERVICE_LANDINGS || {}).forEach((s) => slugs.add(s));

  try {
    for (const s of await loadPostgresServiceSlugs()) slugs.add(s);
  } catch (err) {
    console.warn('[seo] postgres service slugs skipped:', (err && err.message) || err);
  }

  const englishOnly = new Set();
  for (const raw of slugs) {
    const canonical = resolveCanonicalEnglishSlug(raw);
    if (canonical && isEnglishServiceSlug(canonical)) englishOnly.add(canonical);
  }
  return Array.from(englishOnly).sort();
}

async function tryLoadPrismaSitemapUrls() {
  try {
    if (!process.env.DATABASE_URL) return [];
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const out = [];
      const today = new Date().toISOString().slice(0, 10);
      const activeNow = new Date();
      const citySlugs = Object.keys(CITIES || {});
      const highTrafficCities = new Set(['shiraz', 'tehran']);

      let serviceRows = [];
      if (prisma.service && typeof prisma.service.findMany === 'function') {
        serviceRows = await prisma.service.findMany({
          select: {
            id: true,
            slug: true,
            parentId: true,
            children: { select: { id: true } },
          },
          orderBy: { slug: 'asc' },
        });
      }

      const serviceMap = new Map();
      for (const row of serviceRows) {
        const slug = String(row.slug || '').trim().toLowerCase();
        if (!slug) continue;
        serviceMap.set(slug, row);
      }

      const serviceSlugSet = new Set(HUB_SLUGS.map((slug) => String(slug || '').trim().toLowerCase()));
      for (const slug of serviceMap.keys()) serviceSlugSet.add(slug);

      const activeClinicWhere = {
        contractStatus: 'ACTIVE',
        OR: [{ endDate: null }, { endDate: { gte: activeNow } }],
      };

      for (const slug of Array.from(serviceSlugSet).sort()) {
        if (!slug) continue;
        const row = serviceMap.get(slug);
        const serviceIds = row
          ? [row.id, ...((row.children || []).map((child) => child.id).filter(Boolean))]
          : null;

        let activeCount = 0;
        let latestUpdate = null;
        if (serviceIds && prisma.clinic && typeof prisma.clinic.aggregate === 'function') {
          const aggregate = await prisma.clinic.aggregate({
            where: {
              ...activeClinicWhere,
              services: { some: { serviceId: { in: serviceIds } } },
            },
            _count: { id: true },
            _max: { updatedAt: true },
          });
          activeCount = Number((aggregate && aggregate._count && aggregate._count.id) || 0);
          latestUpdate = aggregate && aggregate._max ? aggregate._max.updatedAt : null;
        }

        if (activeCount <= 0) continue;

        for (const citySlug of citySlugs) {
          out.push({
            path: `/${citySlug}/${slug}`,
            lastmod: latestUpdate || today,
            priority: '0.9',
            changefreq: highTrafficCities.has(citySlug) ? 'daily' : 'weekly',
          });
        }

        const servicePath = canonicalServicePath(slug);
        if (servicePath) {
          out.push({
            path: servicePath,
            lastmod: latestUpdate || today,
            priority: '0.8',
            changefreq: 'weekly',
          });
        }
      }

      // Active doctors only — canonical /doctor/:slug (never profile.html / transliterations).
      if (prisma.clinic && typeof prisma.clinic.findMany === 'function') {
        const clinics = await prisma.clinic.findMany({
          where: activeClinicWhere,
          select: {
            id: true,
            slug: true,
            englishName: true,
            name: true,
            endDate: true,
            updatedAt: true,
            contractStatus: true,
          },
        });
        try {
          clinicSlug.registerClinics(clinics);
        } catch (_err) {
          /* optional */
        }
        for (const c of clinics) {
          const doctorSlug = clinicSlug.slugForClinic(c);
          if (!clinicSlug.isCleanCanonicalSlug(doctorSlug)) continue;
          const lastmod = c.updatedAt || today;
          out.push({
            path: `/doctor/${doctorSlug}`,
            lastmod,
            priority: '0.8',
            changefreq: 'weekly',
          });
        }
      }
      return out;
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  } catch (err) {
    console.warn('[seo] prisma unavailable for sitemap:', (err && err.message) || err);
    return [];
  }
}

const seoInfra = createSeoInfraHandlers({
  rootDir: ROOT,
  sendHtml,
  sendText,
  loadClinicsData,
  serviceLandings: SERVICE_LANDINGS,
  hubSlugs: HUB_SLUGS,
  tryLoadPrismaUrls: tryLoadPrismaSitemapUrls,
  loadUniqueServiceSlugs,
  loadSqliteServiceSlugs,
  loadPostgresServiceSlugs,
  getSearchParams,
});

const blogArticles =
  typeof createBlogArticleHandlers === 'function'
    ? createBlogArticleHandlers({
        rootDir: ROOT,
        sendJson,
        sendHtml,
        sendText,
        injectHeadSeo,
        readJsonBody,
      })
    : null;

const blogSilo =
  typeof createBlogSiloHandlers === 'function'
    ? createBlogSiloHandlers({ sendJson })
    : null;

let uploadApp = null;
if (typeof createUploadApp === 'function') {
  try {
    uploadApp = createUploadApp(ROOT);
  } catch (err) {
    console.warn('[upload] disabled:', (err && err.message) || err);
  }
}

const siteSettings =
  typeof createSiteSettingsHandlers === 'function'
    ? createSiteSettingsHandlers({
        openDb,
        sendJson,
        readJsonBody,
      })
    : null;

const heroSlides =
  typeof createHeroSlidesHandlers === 'function'
    ? createHeroSlidesHandlers({
        sendJson,
        readJsonBody,
        trimOrNull,
      })
    : null;

const directoryAdmin =
  typeof createDirectoryAdminHandlers === 'function'
    ? createDirectoryAdminHandlers({
        sendJson,
        readJsonBody,
        trimOrNull,
        getDb: () => db,
      })
    : null;

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  const pathname = getPathname(req.url);

  if (pathname.startsWith('/api/admin')) {
    res.__adminNoindex = true;
  }

  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // Candela / Titanium / Botox / laser-hair.html consolidation.
    if (method === 'GET' || method === 'HEAD') {
      // Trailing slash on /shiraz/* hubs → one-hop 301 (canonical without slash).
      const rawPathOnly = String(req.url || '/').split('?')[0].split('#')[0];
      if (
        rawPathOnly.length > 1 &&
        rawPathOnly.endsWith('/') &&
        rawPathOnly.startsWith('/shiraz')
      ) {
        const qs = String(req.url || '').includes('?')
          ? '?' + String(req.url).split('?').slice(1).join('?').split('#')[0]
          : '';
        sendPermanentRedirect(res, rawPathOnly.replace(/\/+$/, '') + qs, method);
        return;
      }

      let decodedPath = pathname;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch (_err) {
        /* keep pathname */
      }
      // Dual hub consolidations: .html → Shiraz canonical (one-hop 301)
      if (decodedPath === '/laser-hair.html') {
        sendPermanentRedirect(res, '/shiraz/laser-hair-removal', method);
        return;
      }
      if (decodedPath === '/cosmetic-surgery.html') {
        sendPermanentRedirect(res, '/shiraz/cosmetic-surgery', method);
        return;
      }
      if (decodedPath === '/hair-transplant.html') {
        sendPermanentRedirect(res, '/shiraz/hair-transplant', method);
        return;
      }
      if (decodedPath === '/skin-rejuvenation.html') {
        sendPermanentRedirect(res, '/shiraz/skin-rejuvenation', method);
        return;
      }
      if (decodedPath === '/injection.html') {
        sendPermanentRedirect(res, '/shiraz/injectables', method);
        return;
      }
      if (
        decodedPath === '/services/candela-laser' ||
        /^\/services\/.*کندلا.*/i.test(decodedPath)
      ) {
        sendPermanentRedirect(res, '/shiraz/laser-candela-2026', method);
        return;
      }
      if (
        decodedPath === '/services/titanium-laser' ||
        /^\/services\/.*تیتانیوم.*/i.test(decodedPath)
      ) {
        sendPermanentRedirect(res, '/shiraz/laser-titanium-2026', method);
        return;
      }
      // Botox → /shiraz/botox only (Persian aliases must not chain via /services/botox).
      // Exact paths only — do NOT match بوتاکس-و-فیلر (botox-filler stays separate).
      if (
        decodedPath === '/services/botox' ||
        decodedPath === '/services/بوتاکس' ||
        decodedPath === '/services/تزریق-بوتاکس'
      ) {
        sendPermanentRedirect(res, '/shiraz/botox', method);
        return;
      }

      // Soft-404 recovery: high-impression Persian /services/* → Shiraz hubs
      const soft404HubRedirects = {
        '/services/برداشتن-خال': '/shiraz/mole-removal',
        '/services/برداشت-خال-و': '/shiraz/mole-removal',
        '/services/فیشیال': '/shiraz/facial',
        '/services/فیشیال-و-پاکسازی-پوست': '/shiraz/facial',
        '/services/برطرف-کردن-منافذ-باز-پوست': '/shiraz/pore-treatment',
        '/services/درمان-منافذ-صورت': '/shiraz/pore-treatment',
        '/services/بوکال-فت': '/shiraz/buccal-fat',
        '/services/لیفت-صورت-بوکال-فت': '/shiraz/buccal-fat',
        // CO2 → fractional CO2 hub
        '/services/co2-laser': '/shiraz/co2-fractional-laser',
        '/services/لیزرco2': '/shiraz/co2-fractional-laser',
        '/services/لیزر-فرکشنالco2': '/shiraz/co2-fractional-laser',
        // Fotona → fotona hub (NOT hair-removal)
        '/services/fotona-laser': '/shiraz/fotona-laser',
        '/services/لیزر-فوتونا': '/shiraz/fotona-laser',
        '/services/فوتونا': '/shiraz/fotona-laser',
        '/shiraz/فوتونا': '/shiraz/fotona-laser',
        '/shiraz/لیزر-فوتونا': '/shiraz/fotona-laser',
        // Soft-404: مزوژل و بوتاکس → botox hub (exact path only)
        '/services/مزوژل-و-بوتاکس': '/shiraz/botox',
        // Soft-404 batch B — new Shiraz landings
        '/services/جراحی-سینه': '/shiraz/breast-surgery',
        '/services/پیرسینگ-گوش': '/shiraz/ear-piercing',
        '/services/درمان-زگیل-تناسلی-با-کرایو-تراپی-و-لیزر-درمانی':
          '/shiraz/wart-cryotherapy',
        '/services/نمونه-برداری-پوستی': '/shiraz/skin-biopsy',
        // Face/neck lift soft-404 → rejuvenation category (not a new thin hub)
        '/services/جوان-سازی-و-لیفت-صورت-و-گردن': '/shiraz/skin-rejuvenation',
        // IPL / pico hair → laser hair Shiraz hub
        '/services/پیکو-لیزر-مو-های-زائد-با-فناوری-پیشرفته-ipl':
          '/shiraz/laser-hair-removal',
        // Slimming / body contouring → static category page
        '/services/لاغری': '/slimming.html',
        '/services/پیکرتراشی': '/slimming.html',
        '/services/اسلیمینگ': '/slimming.html',
        '/shiraz/لاغری': '/slimming.html',
        '/shiraz/پیکرتراشی': '/slimming.html',
        '/shiraz/اسلیمینگ': '/slimming.html',
        '/shiraz/slimming': '/slimming.html',
        '/shiraz/body-contouring': '/slimming.html',
        // Double-chin soft-404s → HIFU Doublo Gold
        '/services/ساکشن-غبغب': '/shiraz/hifu-doublo-gold',
        '/services/لیفت-غبغب': '/shiraz/hifu-doublo-gold',
      };
      const soft404Dest = soft404HubRedirects[decodedPath];
      if (soft404Dest) {
        sendPermanentRedirect(res, soft404Dest, method);
        return;
      }
    }

    // Bare /index.html → canonical home (no duplicate URL).
    if (
      (method === 'GET' || method === 'HEAD') &&
      pathname === '/index.html'
    ) {
      sendPermanentRedirect(res, '/', method);
      return;
    }

    // Bare /doctor and /doctor/ → home (no slug).
    if (
      (method === 'GET' || method === 'HEAD') &&
      (pathname === '/doctor' || pathname === '/doctor/')
    ) {
      sendPermanentRedirect(res, '/', method);
      return;
    }

    // Legacy profile URLs without ?id= → home (before /doctor/:slug).
    if (
      (method === 'GET' || method === 'HEAD') &&
      (pathname === '/profile.html' || pathname === '/profiles.html')
    ) {
      const url = new URL(req.url || '/', 'http://localhost');
      const rawId = validQueryId(url.searchParams.get('id') || url.searchParams.get('clinic_id'));
      if (!rawId) {
        sendPermanentRedirect(res, '/', method);
        return;
      }
    }

    // Doctor profiles MUST run before static catch-alls / generic 404.
    // Extensionless /doctor/:slug must never fall through to tryServeStaticAsset.
    if (
      (method === 'GET' || method === 'HEAD') &&
      (pathname === '/profile.html' ||
        pathname === '/profiles.html' ||
        pathname.startsWith('/doctor/'))
    ) {
      if (doctorApp) {
        doctorApp(req, res);
        return;
      }
      if (await tryHandleDoctorProfileNative(req, res, pathname, method)) {
        return;
      }
      console.error(`[Doctor Route] Slug not found: ${pathname}`);
      sendNotFound(res, 'Profile not found');
      return;
    }

    if (await categoryMonetize.tryHandle(req, res, pathname, method)) {
      return;
    }

    if (await seoInfra.tryHandle(req, res, pathname, method)) {
      return;
    }

    if (siteSettings && siteSettings.tryHandle(req, res, pathname, method)) {
      return;
    }

    if (heroSlides && heroSlides.tryHandle(req, res, pathname, method)) {
      return;
    }

    if (directoryAdmin && directoryAdmin.tryHandle(req, res, pathname, method)) {
      return;
    }

    if (blogSilo && blogSilo.tryHandle(req, res, pathname, method)) {
      return;
    }

    if (
      commercialLandingApp &&
      (pathname.startsWith('/lp/') ||
        pathname.startsWith('/ads/') ||
        pathname.startsWith('/api/landing/'))
    ) {
      commercialLandingApp(req, res);
      return;
    }

    if (
      serviceApp &&
      (method === 'GET' || method === 'HEAD') &&
      (pathname === '/services' ||
        pathname === '/services/' ||
        pathname.startsWith('/services/') ||
        pathname.startsWith('/api/services/'))
    ) {
      serviceApp(req, res);
      return;
    }

    if (serviceLanding.tryHandle(req, res, pathname, method)) {
      return;
    }

    if (method === 'POST' && pathname === '/api/consultation') {
      console.log('[API] POST /api/consultation');
      await handleConsultation(req, res);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/leads') {
      console.log('[API] GET /api/leads');
      await handleGetLeads(res, method);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'salam-doctor-backend',
        features: {
          reports: true,
          clinicProfiles: true,
          seoHubs: Boolean(seoApp),
          siteSearch: Boolean(searchApp),
          htmlSitemap: Boolean(htmlSitemapApp),
          commercialLandings: Boolean(commercialLandingApp),
          heroSlides: Boolean(heroSlides),
          blogSilo: Boolean(blogSilo),
        },
        seoHubs: seoApp ? 'enabled' : 'disabled — run npm install express ejs and rebuild',
        siteSearch: searchApp ? 'enabled' : 'disabled',
      }, method);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/clinic-profile') {
      handleGetClinicProfile(req, res);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/featured') {
      handleGetFeatured(res, method);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/ads') {
      handleGetAd(req, res, method);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/featured/click') {
      handleFeaturedClick(req, res);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/ads/click') {
      handleAdClick(req, res);
      return;
    }

    if (pathname.startsWith('/api/admin/reports')) {
      if (handleAdminReports(req, res, pathname, method)) return;
      sendJson(res, 404, { error: 'Report not found' });
      return;
    }

    if (pathname === '/api/admin/featured') {
      if (method === 'POST') {
        await handleAdminFeaturedPost(req, res);
        return;
      }
      if (method === 'GET') {
        handleAdminFeaturedList(res);
        return;
      }
      if (method === 'DELETE') {
        handleAdminFeaturedDelete(req, res);
        return;
      }
    }

    if (pathname === '/api/admin/clinic-profiles') {
      if (method === 'POST' || method === 'PUT') {
        await handleAdminClinicProfilePost(req, res);
        return;
      }
      if (method === 'GET') {
        handleAdminClinicProfilesList(res);
        return;
      }
      if (method === 'DELETE') {
        handleAdminClinicProfileDelete(req, res);
        return;
      }
    }

    if (pathname === '/api/admin/clinics-catalog' && method === 'GET') {
      handleAdminClinicsCatalog(res);
      return;
    }

    if (pathname === '/api/admin/ads') {
      if (method === 'POST') {
        await handleAdminAdsPost(req, res);
        return;
      }
      if (method === 'GET') {
        handleAdminAdsList(res);
        return;
      }
      if (method === 'DELETE') {
        handleAdminAdsDelete(req, res);
        return;
      }
    }

    if (pathname === '/api/admin/upload' && method === 'POST') {
      await handleAdminUpload(req, res);
      return;
    }

    // TinyMCE image upload + /uploads static (Express + multer sub-app)
    if (
      uploadApp &&
      (pathname === '/api/upload-image' ||
        (pathname.startsWith('/uploads/') && (method === 'GET' || method === 'HEAD')))
    ) {
      uploadApp(req, res);
      return;
    }

    if (pathname === '/api/admin/articles') {
      if (method === 'POST') {
        await handleAdminArticlesPost(req, res);
        return;
      }
      if (method === 'GET') {
        handleAdminArticlesListOrGet(req, res);
        return;
      }
      if (method === 'DELETE') {
        handleAdminArticlesDelete(req, res);
        return;
      }
    }

    if (pathname === '/api/articles' && method === 'POST') {
      if (!blogArticles) {
        sendJson(res, 503, { error: 'Blog module unavailable' });
        return;
      }
      await blogArticles.handleCreateArticle(req, res);
      return;
    }

    if (method === 'GET' && pathname === '/api/articles') {
      handleGetPublishedArticles(res);
      return;
    }

    if (method === 'GET' && pathname.startsWith('/api/articles/')) {
      const slug = parseArticleSlugFromPath(pathname, '/api/articles/');
      if (slug) {
        handleGetArticleBySlug(slug, res);
        return;
      }
    }

    if ((method === 'GET' || method === 'HEAD') && (pathname === '/blog' || pathname === '/blog/')) {
      if (!blogArticles) {
        sendText(res, 503, 'Blog module unavailable');
        return;
      }
      await blogArticles.handleBlogListPage(res);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname.startsWith('/blog/')) {
      if (!blogArticles) {
        sendText(res, 503, 'Blog module unavailable');
        return;
      }
      const slug = parseArticleSlugFromPath(pathname, '/blog/');
      if (slug) {
        await blogArticles.handleBlogPostPage(slug, res);
        return;
      }
      sendRedirect(res, '/blog', method);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && (pathname === '/article' || pathname === '/article/')) {
      serveArticlesHubPage(res, method);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname.startsWith('/article/')) {
      const slug = parseArticleSlugFromPath(pathname, '/article/');
      if (slug) {
        handleArticlePage(slug, res);
        return;
      }
      sendRedirect(res, '/article', method, 301);
      return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/sitemap-articles.xml') {
      handleSitemapArticles(res, method);
      return;
    }

    // Site search — WebSite SearchAction target (Sitelinks searchbox).
    if (searchApp && (method === 'GET' || method === 'HEAD') && pathname === '/search') {
      searchApp(req, res);
      return;
    }

    // HTML sitemap — hierarchical city / service / clinic index for crawlability.
    if (
      htmlSitemapApp &&
      (method === 'GET' || method === 'HEAD') &&
      (pathname === '/sitemap' || pathname === '/html-sitemap')
    ) {
      htmlSitemapApp(req, res);
      return;
    }

    // Delegate programmatic-SEO hub pages to the Express sub-app.
    if (seoApp && (method === 'GET' || method === 'HEAD')) {
      if (pathname === '/shiraz' || pathname.startsWith('/shiraz/')) {
        seoApp(req, res);
        return;
      }
      if (isLocalHubPath(pathname)) {
        seoApp(req, res);
        return;
      }
      if (pathname.startsWith('/api/seo/local-hub/')) {
        seoApp(req, res);
        return;
      }
    }

    if ((method === 'GET' || method === 'HEAD') && pathname.startsWith('/api/map-tiles/')) {
      if (await handleMapTileProxy(req, res, pathname, method)) return;
    }

    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/clinic-static-map') {
      if (await handleClinicStaticMap(req, res, req.url, method)) return;
    }

    if (tryServeStaticAsset(req, res, pathname, method)) {
      return;
    }

    console.warn('[404]', method, pathname);
    sendNotFound(res);
  } catch (err) {
    console.error('Request error:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error' });
    }
  }
});

const io = new Server(server, {
  path: '/socket.io/',
  cors: {
    origin: true,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  const role = resolveSocketRole(socket);

  if (role === 'admin') {
    socket.join('admin');
    socket.emit('session:list', Array.from(chatSessions.values()).map(getSessionSummary));

    socket.on('admin:join-session', (sessionId) => {
      const session = chatSessions.get(sessionId);
      if (!session) return;
      session.unread = 0;
      socket.emit('session:history', getSessionPayload(session));
      broadcastSessionList(io);
    });

    socket.on('admin:reply', (payload) => {
      const sessionId = payload && payload.sessionId;
      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!sessionId || !text) return;

      const session = chatSessions.get(sessionId);
      if (!session) return;

      const message = {
        from: 'admin',
        text,
        timestamp: nowIso(),
      };
      session.messages.push(message);
      session.lastMessage = text;

      io.to(sessionId).emit('chat:reply', message);
      io.to('admin').emit('session:update', getSessionPayload(session));
    });

    return;
  }

  const session = {
    id: socket.id,
    connectedAt: nowIso(),
    messages: [],
    lastMessage: '',
    unread: 0,
  };
  chatSessions.set(socket.id, session);

  io.to('admin').emit('session:new', getSessionPayload(session));
  broadcastSessionList(io);

  socket.emit('chat:welcome', {
    from: 'admin',
    text: 'سلام! چطور می‌تونم راهنماییتون کنم؟ می‌تونید پیام بنویسید یا از سوالات آماده پایین چت انتخاب کنید.',
    timestamp: nowIso(),
  });

  socket.on('chat:message', (payload) => {
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!text) return;

    const message = {
      from: 'user',
      text,
      timestamp: nowIso(),
    };
    session.messages.push(message);
    session.lastMessage = text;
    session.unread += 1;

    io.to('admin').emit('chat:user-message', {
      sessionId: socket.id,
      message,
    });
    io.to('admin').emit('session:update', getSessionPayload(session));
  });

  socket.on('disconnect', () => {
    chatSessions.delete(socket.id);
    io.to('admin').emit('session:remove', { sessionId: socket.id });
    broadcastSessionList(io);
  });
});

async function start() {
  ensureUploadsDir();
  const db = openDb();
  try {
    repairAdImagePaths(db);
    ensureNahalAds(db);
  } finally {
    db.close();
  }
  ensureFeaturedSlots();

  server.on('error', (err) => {
    console.error('Server error:', err.message || err);
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    console.log(`Backend listening on http://${HOST}:${PORT}`);
    console.log('API:  POST /api/consultation  GET /api/leads  GET /api/health');
    console.log('Monetization: GET /api/featured  GET /api/ads  GET /api/categories/:id/slider|top5');
    console.log('Upload: POST /api/upload-image  GET /uploads/*');
    console.log('Articles: GET /api/articles  POST /api/articles (Postgres blog)  GET /article/:slug');
    try {
      const staticCount = listStaticArticles(ARTICLES_DIR).length;
      console.log(`Static articles: ${staticCount} file(s) in ${ARTICLES_DIR}`);
    } catch (err) {
      console.warn('[articles] static catalog unavailable:', err && err.message);
    }
    console.log('Blog: GET /blog  GET /blog/:slug');
    try {
      clinicSlug.registerClinics(loadClinicsData());
    } catch (_err) {
      /* catalog optional at boot */
    }
    console.log('Profiles: GET /doctor/:slug  (legacy /profile.html?id= → 301)');
    console.log('Services: GET /services/:slug  GET /api/services/:slug  (e.g. /services/candela-laser)');
    console.log('SEO: GET /sitemap.xml  (dynamic)  category landings via Node meta injection');
    console.log('Site settings: GET /api/site-settings  GET|PUT /api/admin/site-settings');
    console.log('Admin: /api/admin/featured  /api/admin/categories/:id/slider|top5  /api/admin/ads  /api/admin/clinic-profiles  /api/admin/clinics-catalog  /api/admin/articles  /api/admin/upload  /api/admin/reports/*');
    console.log('Chat: /socket.io/');
    if (seoApp) {
      console.log('SEO hubs: GET /{city}/:service_slug  (e.g. /tehran/hair-transplant, /shiraz/laser)');
      console.log('SEO API:  GET /api/seo/local-hub/:city/:service  (JSON headHtml for vanilla JS)');
    }
    if (searchApp) {
      console.log('Site search: GET /search?q=…  (WebSite SearchAction / Sitelinks searchbox)');
    }
    if (htmlSitemapApp) {
      console.log('HTML sitemap: GET /sitemap  (alias GET /html-sitemap → 301)');
    }
    if (!seoApp) {
      console.warn('SEO hubs DISABLED — install express + ejs and ensure seoRouter.js + views/ exist');
    }
    if (commercialLandingApp) {
      console.log('Commercial landings: GET /lp/:package  GET /ads/:package  POST /api/landing/leads');
    }
    if (leadSyncWorker && process.env.LEAD_SYNC_ENABLED !== '0') {
      leadSyncWorker.startLeadSyncCron({ dbPath: DB_FILE });
      console.log('Lead sync: cron → SQLite leads.db → Postgres (LEAD_SYNC_ENABLED=0 to disable)');
    }
  });
}

start();
