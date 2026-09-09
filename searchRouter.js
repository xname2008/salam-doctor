'use strict';

// ==========================================================================
// searchRouter.js — site search for Sitelinks Searchbox eligibility.
//   GET /search           → search landing (form only)
//   GET /search?q=...     → hub + clinic results (same URL pattern as JSON-LD)
//
// WebSite SearchAction target (index.html):
//   https://salam-doctor.ir/search?q={search_term_string}
// ==========================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const express = require('express');
const { searchHubs, searchClinics, normalizeQuery } = require('./search-index');
const { GTM_HEAD_HTML, GTM_BODY_HTML } = require('./scripts/gtm-snippets');

const SITE_BASE = process.env.SITE_BASE || 'https://salam-doctor.com';
const ROOT = path.join(__dirname);

function loadClinicsData() {
  try {
    const code = fs.readFileSync(path.join(ROOT, 'data.min.js'), 'utf8');
    const sandbox = { clinicsData: [] };
    vm.runInNewContext(code.replace(/^const clinicsData/, 'clinicsData'), sandbox);
    return Array.isArray(sandbox.clinicsData) ? sandbox.clinicsData : [];
  } catch {
    return [];
  }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSearchPage({ q, hubs, clinics }) {
  const hasQuery = Boolean(q);
  const canonical = hasQuery
    ? `${SITE_BASE}/search?q=${encodeURIComponent(q)}`
    : `${SITE_BASE}/search`;
  const title = hasQuery
    ? `نتایج جستجو برای «${q}» | سلام دکتر`
    : 'جستجو در سلام دکتر | مراکز درمانی شیراز';
  const robots = hasQuery && (hubs.length || clinics.length)
    ? 'index, follow'
    : 'noindex, follow';

  const hubRows = hubs.map((h) => (
    `<li class="result-item">
      <a href="${esc(h.url)}">
        <strong>${esc(h.name)}</strong>
        <span>مقایسه مراکز ${esc(h.name)} در شیراز</span>
      </a>
    </li>`
  )).join('');

  const clinicRows = clinics.map((c) => (
    `<li class="result-item result-item--clinic">
      <a href="${esc(c.url)}">
        <strong>${esc(c.name)}</strong>
        ${c.tagline ? `<span>${esc(c.tagline)}</span>` : ''}
      </a>
    </li>`
  )).join('');

  const emptyMsg = hasQuery && !hubs.length && !clinics.length
    ? `<p class="empty">نتیجه‌ای برای «${esc(q)}» یافت نشد. عبارت دیگری امتحان کنید یا با ما تماس بگیرید.</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
${GTM_HEAD_HTML}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#1294e0">
  <title>${esc(title)}</title>
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="icon" type="image/svg+xml" href="/images/logo-heart.svg?v=5">
  <link rel="preload" href="/assets/fonts/Vazirmatn-RD-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/fonts/Vazirmatn-font-face.css">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:"Vazirmatn",Tahoma,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.8}
    a{color:inherit;text-decoration:none}
    .wrap{max-width:720px;margin:0 auto;padding:24px 16px 48px}
    .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.05rem;margin-bottom:24px;color:#0f172a}
    .brand img{width:36px;height:36px}
    h1{font-size:1.35rem;font-weight:800;margin-bottom:16px;color:#0f172a}
    .search-box{display:flex;gap:8px;margin-bottom:28px}
    .search-box input{flex:1;border:1px solid #cbd5e1;border-radius:12px;padding:12px 14px;font:inherit;font-size:1rem;background:#fff}
    .search-box input:focus{outline:2px solid #1294e0;border-color:#1294e0}
    .search-box button{background:#1294e0;color:#fff;border:0;border-radius:12px;padding:0 20px;font:inherit;font-weight:700;cursor:pointer}
    .search-box button:hover{background:#0e7fc0}
    .section{margin-bottom:24px}
    .section h2{font-size:1rem;font-weight:800;color:#334155;margin-bottom:10px}
    .results{list-style:none}
    .result-item{background:#fff;border:1px solid #e2e8f0;border-radius:14px;margin-bottom:10px;overflow:hidden}
    .result-item a{display:block;padding:14px 16px}
    .result-item a:hover{background:#f0f9ff}
    .result-item strong{display:block;font-size:1rem;color:#0f172a}
    .result-item span{display:block;font-size:.85rem;color:#64748b;margin-top:4px}
    .empty{color:#64748b;background:#fff;border:1px dashed #cbd5e1;border-radius:14px;padding:20px;text-align:center}
    .hint{font-size:.85rem;color:#64748b;margin-top:20px}
    .hint a{color:#1294e0;font-weight:700}
  </style>
</head>
<body>
${GTM_BODY_HTML}
  <div class="wrap">
    <a href="/" class="brand">
      <img src="/images/logo-heart.svg" alt="" width="36" height="36">
      <span>سلام دکتر</span>
    </a>
    <h1>${hasQuery ? `نتایج جستجو: ${esc(q)}` : 'جستجو در مراکز درمانی شیراز'}</h1>
    <form class="search-box" action="/search" method="get" role="search">
      <input type="search" name="q" value="${esc(q)}" placeholder="مثال: کاشت مو، لیزر کندلا، بوتاکس…" autocomplete="off" aria-label="عبارت جستجو">
      <button type="submit">جستجو</button>
    </form>
    ${emptyMsg}
    ${hubs.length ? `<section class="section" aria-labelledby="hubs-h"><h2 id="hubs-h">دسته‌بندی‌های مرتبط</h2><ul class="results">${hubRows}</ul></section>` : ''}
    ${clinics.length ? `<section class="section" aria-labelledby="clinics-h"><h2 id="clinics-h">مراکز مرتبط</h2><ul class="results">${clinicRows}</ul></section>` : ''}
    <p class="hint">نیاز به راهنمایی دارید؟ <a href="tel:+989007000462">مشاوره رایگان</a> · <a href="/">صفحه اصلی</a></p>
  </div>
</body>
</html>`;
}

function createSearchApp() {
  const app = express();
  const clinicsCache = { data: null, at: 0 };
  const TTL = 5 * 60 * 1000;

  function getClinics() {
    const now = Date.now();
    if (!clinicsCache.data || now - clinicsCache.at > TTL) {
      clinicsCache.data = loadClinicsData();
      clinicsCache.at = now;
    }
    return clinicsCache.data;
  }

  app.get('/search', (req, res) => {
    const q = normalizeQuery(req.query.q || '');
    const hubs = q ? searchHubs(q) : [];
    const clinics = q ? searchClinics(q, getClinics()) : [];
    res.set('Cache-Control', q ? 'public, max-age=300' : 'public, max-age=3600');
    res.type('html').send(renderSearchPage({ q, hubs, clinics }));
  });

  return app;
}

module.exports = { createSearchApp, renderSearchPage, searchHubs };
