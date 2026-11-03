#!/usr/bin/env node
'use strict';

/**
 * Local SEO guard: sitemaps + hub SEO payloads + article canonical/lastmod parity.
 * Zero new dependencies. Exit 1 on any failure.
 *
 *   npm run seo:audit
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://salam-doctor.com';
const PRICE_META_RE = /قیمت|هزینه|تعرفه|تومان/;
const TOMAN_RE = /تومان/;
const LASTMOD_RE = /^\d{4}-\d{2}-\d{2}$/;
const COST_CLOSE_RE = /به‌صورت کتبی اعلام می‌کند/;

let failures = 0;
function pass(msg) {
  console.log(`PASS ${msg}`);
}
function fail(msg) {
  console.log(`FAIL ${msg}`);
  failures += 1;
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function parseSitemapLocs(xml) {
  const locs = [];
  const re = /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]*)<\/lastmod>)?/gi;
  let m;
  while ((m = re.exec(xml))) {
    locs.push({ loc: m[1].trim(), lastmod: (m[2] || '').trim() });
  }
  return locs;
}

function auditSitemaps() {
  for (const file of ['sitemap.xml', 'sitemap-articles.xml']) {
    const xml = read(file);
    const urls = parseSitemapLocs(xml);
    if (!urls.length) {
      fail(`${file} has no <url> entries`);
      continue;
    }
    let htmlish = 0;
    let trailing = 0;
    let badLastmod = 0;
    for (const u of urls) {
      if (/\.html(?:[?#]|$)/i.test(u.loc)) htmlish += 1;
      try {
        const { pathname } = new URL(u.loc);
        if (pathname !== '/' && pathname.endsWith('/')) trailing += 1;
      } catch (_e) {
        fail(`${file} invalid loc ${u.loc}`);
      }
      if (u.lastmod && !LASTMOD_RE.test(u.lastmod)) badLastmod += 1;
      if (!u.lastmod) badLastmod += 1;
    }
    htmlish === 0 ? pass(`${file} 0 .html locs`) : fail(`${file} ${htmlish} .html locs`);
    trailing === 0
      ? pass(`${file} 0 trailing-slash locs`)
      : fail(`${file} ${trailing} trailing-slash locs`);
    badLastmod === 0
      ? pass(`${file} lastmods YYYY-MM-DD`)
      : fail(`${file} ${badLastmod} invalid/missing lastmod`);
  }

  // Excluded / noindex slugs must not appear in articles sitemap.
  const articlesXml = read('sitemap-articles.xml');
  if (/body-contouring-clinic-guide/.test(articlesXml)) {
    // After re-index it SHOULD be present — only hair-loss-treatment-comparison excluded.
    pass('sitemap-articles includes body-contouring-clinic-guide');
  } else {
    fail('sitemap-articles missing body-contouring-clinic-guide');
  }
  if (/hair-loss-treatment-comparison/.test(articlesXml)) {
    fail('sitemap-articles still lists excluded hair-loss-treatment-comparison');
  } else {
    pass('sitemap-articles excludes hair-loss-treatment-comparison');
  }
}

function buildHubHtml(seo) {
  const faqHtml = (seo.faq || [])
    .map(
      (f) =>
        `<details><summary>${f.q}</summary><p>${f.a}</p></details>`
    )
    .join('\n');
  return `${seo.headHtml || ''}
<title>${seo.title || ''}</title>
<meta name="description" content="${seo.description || ''}">
<meta property="og:title" content="${seo.title || ''}">
<meta property="og:description" content="${seo.description || ''}">
<meta name="twitter:title" content="${seo.title || ''}">
<meta name="twitter:description" content="${seo.description || ''}">
${seo.seoDescriptionHtml || ''}
<section>${faqHtml}</section>
<script type="application/ld+json">${seo.jsonLd || '{}'}</script>`;
}

function auditHubs() {
  const { HUB_SLUGS } = require(path.join(ROOT, 'hub-slugs'));
  const seoConfig = require(path.join(ROOT, 'seo-config'));
  const { buildLocalHubSeo } = require(path.join(ROOT, 'seoInfra'));
  const labels = require(path.join(ROOT, 'hub-labels'));

  for (const slug of HUB_SLUGS) {
    const name =
      (labels && labels[slug]) ||
      (seoConfig[slug] && seoConfig[slug].h1) ||
      slug;
    const data = {
      city: 'شیراز',
      citySlug: 'shiraz',
      service: { slug, name },
      clinics: [],
      districts: [],
      canonicalPath: `/shiraz/${slug}`,
    };
    const overrides = seoConfig[slug] || {};
    let seo;
    try {
      seo = buildLocalHubSeo(data, overrides);
    } catch (err) {
      fail(`/shiraz/${slug} buildLocalHubSeo threw: ${(err && err.message) || err}`);
      continue;
    }
    const html = buildHubHtml(seo);

    if (TOMAN_RE.test(html)) fail(`/shiraz/${slug} contains تومان`);
    else pass(`/shiraz/${slug} no تومان`);

    const metaBlob = [
      seo.title || '',
      seo.description || '',
      seo.title || '',
      seo.description || '',
      seo.title || '',
      seo.description || '',
    ].join('\n');
    // title + description drive og/twitter in our builder
    if (PRICE_META_RE.test(seo.title || '') || PRICE_META_RE.test(seo.description || '')) {
      fail(`/shiraz/${slug} price words in title/description`);
    } else {
      pass(`/shiraz/${slug} meta free of price words`);
    }

    // JSON-LD parse
    let graphOk = true;
    let faqLd = [];
    try {
      const parsed = JSON.parse(seo.jsonLd || '{}');
      const nodes = parsed['@graph'] || [parsed];
      for (const n of nodes) {
        if (!n || typeof n !== 'object') continue;
        if (n['@type'] === 'FAQPage') faqLd = n.mainEntity || [];
      }
    } catch (err) {
      graphOk = false;
      fail(`/shiraz/${slug} JSON-LD parse: ${(err && err.message) || err}`);
    }
    if (graphOk) pass(`/shiraz/${slug} JSON-LD parses`);

    const vis = seo.faq || [];
    const ldQs = faqLd.map((e) => String(e.name || '').trim());
    const visQs = vis.map((f) => String(f.q || '').trim());
    if (ldQs.length === visQs.length && ldQs.every((q, i) => q === visQs[i])) {
      pass(`/shiraz/${slug} FAQ 1:1 (${visQs.length})`);
    } else {
      fail(
        `/shiraz/${slug} FAQ mismatch vis=${visQs.length} ld=${ldQs.length}`
      );
    }

    const costCloseOk = (text) =>
      COST_CLOSE_RE.test(text || '') ||
      /قیمت دقیق هر قلم را داروخانه اعلام می‌کند/.test(text || '');
    const costVis = vis.some(
      (f) => /هزینه|قیمت/.test(f.q || '') && costCloseOk(f.a)
    );
    const costLd = faqLd.some(
      (e) =>
        /هزینه|قیمت/.test(e.name || '') &&
        costCloseOk((e.acceptedAnswer && e.acceptedAnswer.text) || '')
    );
    if (costVis && costLd) pass(`/shiraz/${slug} cost FAQ closing present`);
    else fail(`/shiraz/${slug} missing cost FAQ closing in visible/JSON-LD`);
  }
}

function auditArticles() {
  const xml = read('sitemap-articles.xml');
  const urls = parseSitemapLocs(xml).filter((u) =>
    u.loc.includes('/articles/')
  );
  for (const u of urls) {
    const slug = u.loc.replace(/^https?:\/\/[^/]+\/articles\//, '').replace(/\/$/, '');
    const file = path.join(ROOT, 'articles', `${slug}.html`);
    if (!fs.existsSync(file)) {
      fail(`article file missing for ${slug}`);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const canon = (html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
      html.match(/href=["']([^"']+)["'][^>]*rel=["']canonical["']/i) ||
      [])[1];
    const og = (html.match(/property=["']og:url["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]*property=["']og:url["']/i) ||
      [])[1];
    const expect = `${SITE}/articles/${slug}`;
    if (canon === expect && og === expect && u.loc === expect) {
      pass(`article ${slug} canonical==og:url==sitemap bare`);
    } else {
      fail(
        `article ${slug} canon=${canon} og=${og} sitemap=${u.loc} expect=${expect}`
      );
    }
    const dm = (html.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) ||
      [])[1];
    if (dm && u.lastmod === dm) {
      pass(`article ${slug} lastmod==dateModified (${dm})`);
    } else {
      fail(`article ${slug} lastmod=${u.lastmod} dateModified=${dm}`);
    }
  }
}

function main() {
  console.log('=== seo-audit ===');
  auditSitemaps();
  auditHubs();
  auditArticles();
  console.log('');
  if (failures) {
    console.log(`SOME FAIL (${failures})`);
    process.exit(1);
  }
  console.log('ALL PASS');
}

main();
