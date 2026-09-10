'use strict';

/**
 * Scan articles/*.html and build sitemap <url> entries for static blog posts.
 * Used by scripts/update-sitemap-articles.js → sitemap-articles.xml only.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ORIGIN = 'https://salam-doctor.com';
const ARTICLE_PRIORITY = '0.7';
const ARTICLE_CHANGEFREQ = 'monthly';

/** Matches any existing static-article <url> block in sitemap.xml. */
const STATIC_ARTICLE_URL_BLOCK_RE =
  /\s*<url>[\s\S]*?<loc>[^<]*\/articles\/[^<]+\.html<\/loc>[\s\S]*?<\/url>/gi;

function canonicalOrigin(override) {
  return String(override || process.env.SITE_BASE || DEFAULT_ORIGIN).replace(/\/$/, '');
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtDate(input) {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
}

function today() {
  return fmtDate(new Date());
}

function articleLoc(filename, origin) {
  const name = String(filename || '').trim();
  if (!name || !/\.html$/i.test(name)) return null;
  return `${canonicalOrigin(origin)}/articles/${name}`;
}

/**
 * Read articlesDir and return metadata for each *.html file (sorted by name).
 * @param {string} articlesDir
 * @param {{ origin?: string }} [opts]
 * @returns {{ filename: string, slug: string, loc: string, mtime: Date, lastmod: string }[]}
 */
function scanStaticArticles(articlesDir, opts = {}) {
  if (!fs.existsSync(articlesDir)) return [];

  return fs
    .readdirSync(articlesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.html$/i.test(entry.name) && !entry.name.startsWith('.') && !entry.name.startsWith('_'))
    .map((entry) => {
      const fullPath = path.join(articlesDir, entry.name);
      const stat = fs.statSync(fullPath);
      const loc = articleLoc(entry.name, opts.origin);
      return {
        filename: entry.name,
        slug: entry.name.replace(/\.html$/i, ''),
        loc,
        mtime: stat.mtime,
        lastmod: fmtDate(stat.mtime),
      };
    })
    .filter((row) => row.loc)
    .sort((a, b) => a.filename.localeCompare(b.filename, 'fa'));
}

/**
 * @param {{ loc: string, lastmod?: string }} article
 * @param {{ priority?: string, changefreq?: string, lastmod?: string }} [opts]
 */
function urlEntry(article, opts = {}) {
  const lastmod = opts.lastmod || article.lastmod || today();
  const priority = opts.priority != null ? opts.priority : ARTICLE_PRIORITY;
  const changefreq = opts.changefreq != null ? opts.changefreq : ARTICLE_CHANGEFREQ;

  const lines = [
    '  <url>',
    `    <loc>${xmlEscape(article.loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ];
  return lines.join('\n');
}

/**
 * @param {ReturnType<typeof scanStaticArticles>} articles
 * @param {{ priority?: string, changefreq?: string, lastmodMode?: 'today'|'mtime' }} [opts]
 */
function buildArticleUrlBlocks(articles, opts = {}) {
  const lastmodMode = opts.lastmodMode || 'today';
  return articles.map((article) =>
    urlEntry(article, {
      priority: opts.priority,
      changefreq: opts.changefreq,
      lastmod: lastmodMode === 'mtime' ? article.lastmod : today(),
    }),
  );
}

/**
 * Collect URL objects compatible with generate-sitemap.js collectUrls().
 * @param {string} articlesDir
 * @param {{ lastmodMode?: 'today'|'mtime', origin?: string }} [opts]
 */
function collectStaticArticleUrls(articlesDir, opts = {}) {
  const lastmodMode = opts.lastmodMode || 'today';
  return scanStaticArticles(articlesDir, { origin: opts.origin }).map((article) => ({
    loc: article.loc,
    lastmod: lastmodMode === 'mtime' ? article.lastmod : today(),
    priority: ARTICLE_PRIORITY,
    changefreq: ARTICLE_CHANGEFREQ,
  }));
}

/**
 * Remove prior /articles/*.html entries and append fresh blocks before </urlset>.
 * @param {string} existingXml
 * @param {string[]} articleBlocks
 */
function mergeArticlesIntoSitemap(existingXml, articleBlocks) {
  const cleaned = String(existingXml || '').replace(STATIC_ARTICLE_URL_BLOCK_RE, '');
  const blocks = (articleBlocks || []).filter(Boolean);

  if (!blocks.length) return cleaned;

  const insertAt = cleaned.lastIndexOf('</urlset>');
  if (insertAt === -1) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      blocks.join('\n'),
      '</urlset>',
      '',
    ].join('\n');
  }

  return `${cleaned.slice(0, insertAt)}${blocks.join('\n')}\n${cleaned.slice(insertAt)}`;
}

module.exports = {
  DEFAULT_ORIGIN,
  ARTICLE_PRIORITY,
  ARTICLE_CHANGEFREQ,
  STATIC_ARTICLE_URL_BLOCK_RE,
  canonicalOrigin,
  xmlEscape,
  fmtDate,
  today,
  articleLoc,
  scanStaticArticles,
  urlEntry,
  buildArticleUrlBlocks,
  collectStaticArticleUrls,
  mergeArticlesIntoSitemap,
};
