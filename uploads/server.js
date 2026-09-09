'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');
const sanitizeHtml = require('sanitize-html');

// Programmatic-SEO hub pages (/shiraz/:service_slug) run on a small Express
// sub-app. Loaded defensively so the core server still boots if `express`
// or the Prisma client haven't been installed/generated yet.
let seoApp = null;
try {
  seoApp = require('./seoRouter').createSeoApp();
} catch (err) {
  console.warn('[seo] SEO hub routes disabled:', (err && err.message) || err);
}

// SEO-optimised blog template (views/article.ejs: TOC + FAQ schema + hub CTA).
// Loaded defensively; falls back to the legacy inline renderer if unavailable.
let articleTemplate = null;
try {
  articleTemplate = require('./articleTemplate');
} catch (err) {
  console.warn('[articles] EJS article template disabled:', (err && err.message) || err);
}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'leads.db');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

const AD_SLOTS = new Set(['home', 'category', 'profile', 'global']);
const SITE_BASE = 'https://salam-doctor.ir';
const DEFAULT_OG_IMAGE = SITE_BASE + '/images/hero-collage.png';

const HEADER_HTML = `<header class="topbar">
  <div class="container topbar-row">
    <a href="/index.html" class="brand" aria-label="سلام دکتر — صفحه اصلی">
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
          <a href="/hair-transplant.html">کاشت مو و ابرو</a>
          <a href="/skin-rejuvenation.html">پوست و جوانسازی</a>
          <a href="/injection.html">تزریقات زیبایی</a>
        </div>
      </div>
      <div class="dropdown">
        <a href="#">لیزر و جراحی
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        <div class="dropdown-content">
          <a href="/laser-hair.html">لیزر موهای زائد</a>
          <a href="/cosmetic-surgery.html">جراحی زیبایی</a>
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
      <a href="/home-visit.html">ویزیت در منزل</a>
      <a href="/lab.html">آزمایش در منزل</a>
      <a href="/equipment.html">اجاره تجهیزات</a>
      <a href="/articles.html">مقالات</a>
      <a href="/products.html">محصولات زیبایی</a>
      <a href="/pharmacy.html">داروخانه</a>
      <a href="/faq.html">سوالات متداول</a>
      <a href="/about.html">درباره ما</a>
    </nav>
    <div class="top-cta">
      <span class="phone">۰۹۰۰۷۰۰۰۴۶۲</span>
      <a class="btn btn-main" href="tel:+989007000462">مشاوره</a>
    </div>
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
    <a href="/index.html">خانه</a>
    <a href="/hair-transplant.html">کاشت مو و ابرو</a>
    <a href="/skin-rejuvenation.html">پوست و جوانسازی</a>
    <a href="/injection.html">تزریقات زیبایی</a>
    <a href="/laser-hair.html">لیزر موهای زائد</a>
    <a href="/cosmetic-surgery.html">جراحی زیبایی</a>
    <a href="/slimming.html">لاغری و پیکرتراشی</a>
    <a href="/lasik.html">لیزیک</a>
    <a href="/femto-lasik.html">فمتولیزیک</a>
    <a href="/prk.html">PRK</a>
    <a href="/products.html">محصولات زیبایی</a>
    <a href="/pharmacy.html">داروخانه</a>
    <a href="/faq.html">سوالات متداول</a>
    <a href="/home-visit.html">ویزیت در منزل</a>
    <a href="/lab.html">آزمایش در منزل</a>
    <a href="/equipment.html">اجاره تجهیزات</a>
    <a href="/articles.html">مقالات</a>
    <a href="/about.html">درباره ما</a>
    <a href="tel:+989007000462" class="drawer-cta">تماس: ۰۹۰۰۷۰۰۰۴۶۲</a>
  </div>
</nav>`;

const FOOTER_HTML = `<footer>
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        <h4>سلام دکتر</h4>
        <div class="footer-links">
          <span>تماس: ۰۹۰۰۷۰۰۰۴۶۲</span>
          <span>شیراز، روبروی پاسارگاد شرقی، جنب نگین عدالت</span>
          <span>info@salamdoctor.ir</span>
        </div>
      </div>
      <div class="footer-col">
        <h4>خدمات پرکاربرد</h4>
        <div class="footer-links">
          <a href="/home-visit.html">خدمات پزشکی در منزل</a>
          <a href="/home-visit.html">ویزیت پزشک در منزل</a>
          <a href="/equipment.html">اجاره تجهیزات</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>راهنمای بیماران</h4>
        <div class="footer-links">
          <a href="/articles.html">مقالات آموزشی</a>
          <a href="/faq.html">سوالات متداول</a>
          <a href="/about.html">درباره ما</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>مقالات جدید</h4>
        <div class="footer-links">
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
.article-cta{ width:min(760px,92%); margin:28px auto 40px; background:var(--navy); color:#fff;
  border-radius:16px; padding:22px; display:flex; justify-content:space-between;
  align-items:center; gap:12px; flex-wrap:wrap; }
.article-cta h3{ font-size:1.15rem; }
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
      updated_at TEXT NOT NULL
    );
  `);

  // Migration: hub override columns for pre-existing articles tables
  // (CREATE TABLE IF NOT EXISTS does not add columns to existing tables).
  const articleCols = db.prepare('PRAGMA table_info(articles)').all().map((c) => c.name);
  if (!articleCols.includes('hub_url')) db.exec('ALTER TABLE articles ADD COLUMN hub_url TEXT');
  if (!articleCols.includes('hub_keyword')) db.exec('ALTER TABLE articles ADD COLUMN hub_keyword TEXT');

  return db;
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  });
  res.end(body);
}

function sendText(res, statusCode, message) {
  setCorsHeaders(res);
  const body = String(message);
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  });
  res.end(body);
}

function sendHtml(res, statusCode, html) {
  const body = String(html);
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  });
  res.end(body);
}

function sendRedirect(res, location, method) {
  setCorsHeaders(res);
  const dest = normalizeRedirectPath(location);
  if (method === 'HEAD') {
    res.writeHead(302, { Location: dest });
    res.end();
    return;
  }
  res.writeHead(302, { Location: dest });
  res.end();
}

function normalizeFeaturedLink(link) {
  if (link == null) return null;
  let s = String(link).trim();
  if (!s) return null;
  if (/\/api\/featured\/click/i.test(s)) {
    return null;
  }
  s = s.replace(/^https?:\/\/[^/]+/i, '');
  if (s.startsWith('/')) s = s.slice(1);
  return s || null;
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

function getPathname(url) {
  const raw = String(url || '/').split('?')[0].split('#')[0];
  let path = raw.startsWith('/') ? raw : '/' + raw;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
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
  if (raw.startsWith('images/') || raw.startsWith('uploads/')) return raw;
  return 'images/' + raw.replace(/^\/+/, '');
}

function repairAdImagePaths(db) {
  const rows = db.prepare('SELECT id, image FROM ads').all();
  for (const row of rows) {
    const fixed = normalizeAdImagePath(row.image);
    if (fixed && fixed !== row.image) {
      db.prepare('UPDATE ads SET image = ? WHERE id = ?').run(fixed, row.id);
    }
  }
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

function formatPersianDate(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString('fa-IR');
  }
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

function sitemapLastmod(iso) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  return String(iso).slice(0, 10);
}

function sendXml(res, statusCode, xml) {
  const body = String(xml);
  res.writeHead(statusCode, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  });
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
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${escapeHtmlAttr(title)} | سلام دکتر</title>`,
    summary ? `<meta name="description" content="${escapeHtmlAttr(summary)}">` : '',
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
    '<link rel="stylesheet" href="/assets/css/shared.css?v=20260620a">',
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
    `<style>${ARTICLE_STYLES}</style>`,
    '</head>',
    '<body>',
    HEADER_HTML,
    DRAWER_HTML,
    '<main class="article-page">',
    '<nav class="article-breadcrumb" aria-label="مسیر صفحه">',
    '<a href="/index.html">خانه</a>',
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
    '<div class="article-cta">',
    '<h3>برای مشاوره رایگان با ما تماس بگیرید</h3>',
    '<div style="display:flex;gap:8px;flex-wrap:wrap">',
    '<a class="btn btn-main" href="tel:+989007000462">تماس فوری</a>',
    '<a class="btn btn-soft" href="/index.html#doctors-clinics" style="background:#fff;color:var(--navy)">فرم مشاوره</a>',
    '</div>',
    '</div>',
    '</main>',
    FOOTER_HTML,
    '<script>',
    'document.getElementById("copy-article-link")?.addEventListener("click",function(){',
    `navigator.clipboard.writeText(${JSON.stringify(canonical)}).then(function(){`,
    'var b=document.getElementById("copy-article-link");if(b)b.textContent="کپی شد!";',
    '}).catch(function(){});});',
    '</script>',
    '<script src="/assets/js/shared.js?v=20260620a" defer></script>',
    '</body>',
    '</html>',
  ].join('\n');
}

function renderArticleNotFound() {
  return [
    '<!DOCTYPE html>',
    '<html lang="fa" dir="rtl">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<title>مقاله یافت نشد | سلام دکتر</title>',
    '<meta name="robots" content="noindex">',
    '<link rel="icon" type="image/svg+xml" href="/images/logo-heart.svg?v=5">',
    '<link rel="apple-touch-icon" href="/images/logo-heart.svg?v=5">',
    '<meta name="theme-color" content="#1294e0">',
    '<link rel="stylesheet" href="/assets/css/shared.css?v=20260620a">',
    `<style>${ARTICLE_STYLES}</style>`,
    '</head>',
    '<body>',
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
    '<script src="/assets/js/shared.js?v=20260620a" defer></script>',
    '</body>',
    '</html>',
  ].join('\n');
}

async function handleConsultation(req, res) {
  const data = await readJsonBody(req, res);
  if (!data) return;

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const service = typeof data.service === 'string' ? data.service.trim() : '';
  const desc = typeof data.desc === 'string' ? data.desc.trim() : '';

  if (!name || !phone || !service) {
    sendJson(res, 400, { error: 'Missing required fields: name, phone, service' });
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

async function handleGetLeads(res) {
  const db = openDb();
  try {
    const leads = db.prepare('SELECT * FROM leads ORDER BY timestamp DESC').all();
    sendJson(res, 200, leads);
  } catch (err) {
    console.error('Failed to read leads:', err);
    sendJson(res, 500, { error: 'Failed to read leads' });
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
  { rank: 1, id: NAHAL_FEATURED_ID, name: 'کلینیک نهال', tagline: 'کلینیک کاشت مو،پوست،لیزر و زیبایی', image: 'images/nahal-reception.webp', link: 'profile.html?id=114', badge: 'ویژه' },
  { rank: 2, id: 'featured-slot-2', name: 'کلینیک ترنج', tagline: 'کلینیک تخصصی پوست و مو', image: 'images/toranj.webp', link: 'profile.html?id=101', badge: null },
  { rank: 3, id: 'featured-slot-3', name: 'کلینیک رخ', tagline: 'کلینیک زیبایی و کاشت مو', image: 'images/rokh.webp', link: 'profile.html?id=104', badge: null },
  { rank: 4, id: 'featured-slot-4', name: 'کلینیک دکتر متقی', tagline: 'کلینیک زیبایی و کاشت مو', image: 'images/motaqi.webp', link: 'profile.html?id=105', badge: null },
  { rank: 5, id: 'featured-slot-5', name: 'کلینیک دکتر صالح', tagline: 'کلینیک کاشت مو،پوست،لیزر و زیبایی', image: 'images/clinic-saleh.png', link: 'profile.html?id=115', badge: null },
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
  return {
    id: row.id,
    rank: row.rank,
    name: row.name,
    tagline: row.tagline,
    phone: row.phone,
    address: row.address,
    image: row.image,
    link: row.link,
    badge: row.badge,
  };
}

function publicAdRow(row) {
  return {
    id: row.id,
    slot: row.slot,
    title: row.title,
    image: normalizeAdImagePath(row.image),
    link: row.link,
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

function handleGetFeatured(res) {
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
    sendJson(res, 200, live);
  } catch (err) {
    console.error('Failed to read featured clinics:', err);
    sendJson(res, 500, { error: 'Failed to read featured clinics' });
  } finally {
    db.close();
  }
}

function handleGetAd(req, res) {
  const params = getSearchParams(req.url);
  const slot = trimOrNull(params.get('slot')) || 'global';
  const db = openDb();
  try {
    const rows = db
      .prepare('SELECT * FROM ads WHERE slot = ? OR slot = ?')
      .all(slot, 'global');
    const pick = weightedPick(rows);
    if (pick) {
      db.prepare('UPDATE ads SET impressions = impressions + 1 WHERE id = ?').run(pick.id);
    }
    sendJson(res, 200, pick ? publicAdRow(pick) : null);
  } catch (err) {
    console.error('Failed to serve ad:', err);
    sendJson(res, 500, { error: 'Failed to serve ad' });
  } finally {
    db.close();
  }
}

function handleFeaturedClick(req, res) {
  const id = trimOrNull(getSearchParams(req.url).get('id'));
  const method = req.method || 'GET';
  if (!id) {
    sendRedirect(res, '/', method);
    return;
  }

  const db = openDb();
  try {
    const row = db.prepare('SELECT id, link FROM featured_clinics WHERE id = ?').get(id);
    if (row) {
      db.prepare('UPDATE featured_clinics SET clicks = clicks + 1 WHERE id = ?').run(id);
      sendRedirect(res, row.link || '/', method);
      return;
    }
    sendRedirect(res, '/', method);
  } catch (err) {
    console.error('Failed to track featured click:', err);
    sendRedirect(res, '/', method);
  } finally {
    db.close();
  }
}

function handleAdClick(req, res) {
  const id = trimOrNull(getSearchParams(req.url).get('id'));
  const method = req.method || 'GET';
  if (!id) {
    sendRedirect(res, '/', method);
    return;
  }

  const db = openDb();
  try {
    const row = db.prepare('SELECT id, link FROM ads WHERE id = ?').get(id);
    if (row) {
      db.prepare('UPDATE ads SET clicks = clicks + 1 WHERE id = ?').run(id);
      sendRedirect(res, row.link || '/', method);
      return;
    }
    sendRedirect(res, '/', method);
  } catch (err) {
    console.error('Failed to track ad click:', err);
    sendRedirect(res, '/', method);
  } finally {
    db.close();
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
  const image = trimOrNull(data.image);
  const link = trimOrNull(data.link);
  if (!slot || !AD_SLOTS.has(slot)) {
    sendJson(res, 400, { error: 'Invalid or missing slot (home, category, profile, global)' });
    return;
  }
  if (!image) {
    sendJson(res, 400, { error: 'Missing required field: image' });
    return;
  }
  if (!link) {
    sendJson(res, 400, { error: 'Missing required field: link' });
    return;
  }

  const bodyId = trimOrNull(data.id);
  const record = {
    slot,
    title: trimOrNull(data.title),
    image: normalizeAdImagePath(image),
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
        id, slot, title, image, link, weight, active, starts_at, ends_at,
        impressions, clicks, created_at
      ) VALUES (
        @id, @slot, @title, @image, @link, @weight, @active, @starts_at, @ends_at,
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
  return `${SITE_BASE}/profile.html?id=${encodeURIComponent(clinicId)}`;
}

function clinicShareImage(clinic, clinicId) {
  if (clinicId === 114) return absoluteImageUrl('images/nahal-reception.webp');
  const img = trimOrNull(clinic && clinic.image);
  if (img && !/clinic-placeholder/i.test(img)) return absoluteImageUrl(img);
  return DEFAULT_OG_IMAGE;
}

function injectProfileMeta(html, clinic, clinicId) {
  const name = trimOrNull(clinic.name) || trimOrNull(clinic.sliderTitle) || (`مرکز ${clinicId}`);
  const title = `${name} | سلام دکتر`;
  const tagline = trimOrNull(clinic.sliderTagline) || trimOrNull(clinic.address) || 'مرکز درمانی و زیبایی در شیراز';
  const desc = `${name} - ${tagline}`;
  const canonical = clinicProfileUrl(clinicId);
  const ogImage = clinicShareImage(clinic, clinicId);

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`)
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${escapeHtmlAttr(desc)}">`,
    )
    .replace(
      /<meta property="og:url"\s+content="[^"]*">/,
      `<meta property="og:url"         content="${escapeHtmlAttr(canonical)}">`,
    )
    .replace(
      /<meta property="og:title"\s+content="[^"]*">/,
      `<meta property="og:title"       content="${escapeHtmlAttr(title)}">`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*">/,
      `<meta property="og:description" content="${escapeHtmlAttr(desc)}">`,
    )
    .replace(
      /<meta property="og:image"\s+content="[^"]*">/,
      `<meta property="og:image"       content="${escapeHtmlAttr(ogImage)}">`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*">/,
      `<link rel="canonical" href="${escapeHtmlAttr(canonical)}">`,
    )
    .replace(
      /<meta name="twitter:title"\s+content="[^"]*">/,
      `<meta name="twitter:title"       content="${escapeHtmlAttr(title)}">`,
    )
    .replace(
      /<meta name="twitter:description" content="[^"]*">/,
      `<meta name="twitter:description" content="${escapeHtmlAttr(desc)}">`,
    )
    .replace(
      /<meta name="twitter:image" content="[^"]*">/,
      `<meta name="twitter:image"       content="${escapeHtmlAttr(ogImage)}">`,
    );
}

function readProfileHtmlTemplate() {
  return fs.readFileSync(path.join(ROOT, 'profile.html'), 'utf8');
}

function handleProfilePage(req, res) {
  let html;
  try {
    html = readProfileHtmlTemplate();
  } catch (err) {
    console.error('Failed to read profile.html:', err);
    sendText(res, 500, 'Profile page unavailable');
    return;
  }

  const clinicId = Number.parseInt(String(getSearchParams(req.url).get('id') || ''), 10);
  if (Number.isInteger(clinicId) && clinicId > 0) {
    const clinic = loadClinicById(clinicId);
    if (clinic) html = injectProfileMeta(html, clinic, clinicId);
  }

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
  res.end(html);
}

function handleProfilesAlias(req, res) {
  const raw = String(req.url || '');
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
  sendRedirect(res, `/profile.html${query}`, req.method || 'GET');
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
      'h3', 'h4', 'a', 'div', 'span', 'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      div: ['class'],
      span: ['class'],
      p: ['class'],
      blockquote: ['class'],
      table: ['class'],
      thead: ['class'],
      tbody: ['class'],
      tr: ['class'],
      th: ['class'],
      td: ['class'],
      ul: ['class'],
      ol: ['class'],
      li: ['class'],
      h3: ['class'],
      h4: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  }).trim();
}

function handleGetClinicProfile(req, res) {
  const clinicId = Number.parseInt(String(getSearchParams(req.url).get('clinic_id') || ''), 10);
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    sendJson(res, 400, { error: 'Invalid clinic_id' });
    return;
  }
  const db = openDb();
  try {
    const row = db.prepare('SELECT clinic_id, intro, updated_at FROM clinic_profiles WHERE clinic_id = ?').get(clinicId);
    if (!row || !trimOrNull(row.intro)) {
      sendJson(res, 200, null);
      return;
    }
    sendJson(res, 200, {
      clinicId: row.clinic_id,
      intro: row.intro,
      updatedAt: row.updated_at,
    });
  } catch (err) {
    console.error('Failed to read clinic profile:', err);
    sendJson(res, 500, { error: 'Failed to read clinic profile' });
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
    const rows = db.prepare('SELECT clinic_id, intro, updated_at FROM clinic_profiles ORDER BY clinic_id ASC').all();
    const catalog = loadClinicsCatalog();
    const nameById = new Map(catalog.map((c) => [c.id, c.name]));
    sendJson(res, 200, rows.map((row) => ({
      clinicId: row.clinic_id,
      name: nameById.get(row.clinic_id) || ('مرکز ' + row.clinic_id),
      intro: row.intro,
      updatedAt: row.updated_at,
    })));
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

  const clinicId = Number.parseInt(String(data.clinic_id != null ? data.clinic_id : data.clinicId), 10);
  const intro = sanitizeClinicIntro(data.intro);
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    sendJson(res, 400, { error: 'Invalid clinic_id' });
    return;
  }
  if (!intro) {
    sendJson(res, 400, { error: 'Intro text is required' });
    return;
  }

  const catalog = loadClinicsCatalog();
  if (!catalog.some((c) => c.id === clinicId)) {
    sendJson(res, 400, { error: 'Unknown clinic_id (not in data.min.js)' });
    return;
  }

  const db = openDb();
  try {
    const updatedAt = nowIso();
    db.prepare(`
      INSERT INTO clinic_profiles (clinic_id, intro, updated_at)
      VALUES (@clinic_id, @intro, @updated_at)
      ON CONFLICT(clinic_id) DO UPDATE SET
        intro = excluded.intro,
        updated_at = excluded.updated_at
    `).run({ clinic_id: clinicId, intro, updated_at: updatedAt });
    sendJson(res, 200, {
      success: true,
      profile: { clinicId, intro, updatedAt },
    });
  } catch (err) {
    console.error('Failed to save clinic profile:', err);
    sendJson(res, 500, { error: 'Failed to save clinic profile' });
  } finally {
    db.close();
  }
}

function handleAdminClinicProfileDelete(req, res) {
  const clinicId = Number.parseInt(String(getSearchParams(req.url).get('clinic_id') || ''), 10);
  if (!Number.isInteger(clinicId) || clinicId < 1) {
    sendJson(res, 400, { error: 'Invalid clinic_id' });
    return;
  }
  const db = openDb();
  try {
    const result = db.prepare('DELETE FROM clinic_profiles WHERE clinic_id = ?').run(clinicId);
    if (!result.changes) {
      sendJson(res, 404, { error: 'Clinic profile not found' });
      return;
    }
    sendJson(res, 200, { success: true, clinicId });
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
    sendJson(res, 200, rows);
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

function handleSitemapArticles(res) {
  const db = openDb();
  try {
    const rows = db.prepare(`
      SELECT slug, updated_at, published_at
      FROM articles WHERE status = 'published'
      ORDER BY published_at DESC
    `).all();
    const urls = rows.map((row) => {
      const loc = SITE_BASE + '/article/' + encodeURIComponent(row.slug);
      const lastmod = sitemapLastmod(row.updated_at || row.published_at);
      return `  <url>\n    <loc>${escapeHtmlAttr(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
    }).join('\n');
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      '</urlset>',
    ].join('\n');
    sendXml(res, 200, xml);
  } catch (err) {
    console.error('Failed to build articles sitemap:', err);
    sendText(res, 500, 'Internal server error');
  } finally {
    db.close();
  }
}

function handleAdminArticlesListOrGet(req, res) {
  const id = trimOrNull(getSearchParams(req.url).get('id'));
  const db = openDb();
  try {
    if (id) {
      const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
      if (!row) {
        sendJson(res, 404, { error: 'Article not found' });
        return;
      }
      sendJson(res, 200, row);
      return;
    }
    const rows = db.prepare('SELECT * FROM articles ORDER BY updated_at DESC').all();
    sendJson(res, 200, rows);
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
  const status = data.status === 'published' ? 'published' : 'draft';
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
        const publishedAt = status === 'published'
          ? (existing.published_at || nowIso())
          : existing.published_at;
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
    const publishedAt = status === 'published' ? ts : null;
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

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  const pathname = getPathname(req.url);

  if (method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (method === 'POST' && pathname === '/api/consultation') {
      console.log('[API] POST /api/consultation');
      await handleConsultation(req, res);
      return;
    }

    if (method === 'GET' && pathname === '/api/leads') {
      console.log('[API] GET /api/leads');
      await handleGetLeads(res);
      return;
    }

    if (method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        service: 'salam-doctor-backend',
        features: { reports: true, clinicProfiles: true, seoHubs: Boolean(seoApp) },
        seoHubs: seoApp ? 'enabled' : 'disabled — run npm install express ejs and rebuild',
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/clinic-profile') {
      handleGetClinicProfile(req, res);
      return;
    }

    if (method === 'GET' && pathname === '/api/featured') {
      handleGetFeatured(res);
      return;
    }

    if (method === 'GET' && pathname === '/api/ads') {
      handleGetAd(req, res);
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
      if (method === 'POST') {
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

    if (method === 'GET' && pathname === '/profiles.html') {
      handleProfilesAlias(req, res);
      return;
    }

    if (method === 'GET' && pathname === '/profile.html') {
      handleProfilePage(req, res);
      return;
    }

    if (method === 'GET' && pathname.startsWith('/article/')) {
      const slug = parseArticleSlugFromPath(pathname, '/article/');
      if (slug) {
        handleArticlePage(slug, res);
        return;
      }
    }

    if (method === 'GET' && pathname === '/sitemap-articles.xml') {
      handleSitemapArticles(res);
      return;
    }

    // Delegate programmatic-SEO hub pages to the Express sub-app.
    if (seoApp && (method === 'GET' || method === 'HEAD')
        && (pathname === '/shiraz' || pathname.startsWith('/shiraz/'))) {
      seoApp(req, res);
      return;
    }

    console.warn('[404]', method, pathname);
    sendText(res, 404, 'Not Found');
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
    console.log('Monetization: GET /api/featured  GET /api/ads  GET /api/*/click');
    console.log('Articles: GET /api/articles  GET /api/articles/:slug  GET /article/:slug  GET /sitemap-articles.xml');
    console.log('Profiles: GET /profile.html?id=…  GET /profiles.html → redirect (share meta injected server-side)');
    console.log('Admin: /api/admin/featured  /api/admin/ads  /api/admin/clinic-profiles  /api/admin/clinics-catalog  /api/admin/articles  /api/admin/upload  /api/admin/reports/*');
    console.log('Chat: /socket.io/');
    if (seoApp) {
      console.log('SEO hubs: GET /shiraz/:service_slug  (e.g. /shiraz/hair-transplant)');
    } else {
      console.warn('SEO hubs DISABLED — install express + ejs and ensure seoRouter.js + views/ exist');
    }
  });
}

start();
