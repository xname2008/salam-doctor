'use strict';

/**
 * Shared article catalog + date sync for static articles/*.html
 * Used by: scripts/sync-article-catalog.js, staticArticles.js
 */

const fs = require('fs');
const path = require('path');
const { formatPersianJalaliDate } = require('./persianDate');

const PUBLISHED_COMMENT_RE = /<!--\s*article-published:\s*(\d{4}-\d{2}-\d{2})\s*-->/i;
const JALALI_COMMENT_RE = /<!--\s*article-jalali:\s*([^-]+?)\s*-->/i;

/** Slugs whose public KEEP is the extensionless /articles/{slug} URL. */
const BARE_CANONICAL_ARTICLE_SLUGS = new Set(['botox-filler-guide']);

function articlePublicPath(slug) {
  const clean = String(slug || '').trim();
  if (!clean) return '';
  if (BARE_CANONICAL_ARTICLE_SLUGS.has(clean)) return `articles/${clean}`;
  return `articles/${clean}.html`;
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function firstMatch(html, patterns) {
  for (const re of patterns) {
    const match = re.exec(html);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

function toIsoDateLocal(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Resolve ISO publication date (priority: HTML comment → JSON-LD → time → file ctime/mtime).
 */
function resolvePublishedDate(html, fileStat) {
  const comment = PUBLISHED_COMMENT_RE.exec(html);
  if (comment) return comment[1];

  const fromJsonLd = firstMatch(html, [/\"datePublished\"\s*:\s*\"(\d{4}-\d{2}-\d{2})/]);
  if (fromJsonLd) return fromJsonLd.slice(0, 10);

  const fromTime = firstMatch(html, [
    /itemprop=["']datePublished["'][^>]+datetime=["'](\d{4}-\d{2}-\d{2})/i,
    /datetime=["'](\d{4}-\d{2}-\d{2})["'][^>]*itemprop=["']datePublished["']/i,
  ]);
  if (fromTime) return fromTime.slice(0, 10);

  if (fileStat) {
    const fileDate = fileStat.birthtime || fileStat.mtime;
    return toIsoDateLocal(fileDate);
  }
  return '';
}

function resolveJalaliLabel(html) {
  const comment = JALALI_COMMENT_RE.exec(html);
  return comment ? comment[1].trim() : '';
}

function dateSortKey(iso) {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
}

function sortEntriesByDate(entries) {
  return entries.slice().sort((a, b) => dateSortKey(b.datePublished) - dateSortKey(a.datePublished));
}

function normalizeCoverPath(coverUrl) {
  if (!coverUrl) return '';
  const value = String(coverUrl).trim();
  const marker = '/assets/images/articles/';
  const idx = value.indexOf(marker);
  if (idx !== -1) return value.slice(idx + 1);
  if (value.startsWith('../assets/')) return value.slice(3);
  if (value.startsWith('assets/')) return value;
  return value;
}

/**
 * Parse listing metadata from article HTML (no body).
 */
function parseArticleMetadata(html, slug) {
  const title = stripHtml(firstMatch(html, [
    /<h1[^>]*itemprop=["']headline["'][^>]*>([\s\S]*?)<\/h1>/i,
    /<title>([^|]+)/i,
  ]));

  const category = stripHtml(firstMatch(html, [
    /rounded-full bg-sky-50[^>]*>([^<]+)</i,
  ]));

  const summary = firstMatch(html, [
    /<meta name=["']description["'] content=["']([^"']+)["']/i,
  ]);

  const coverImage = firstMatch(html, [
    /<meta property=["']og:image["'] content=["']([^"']+)["']/i,
    /<img[^>]+itemprop=["']image["'][^>]+src=["']([^"']+)["']/i,
    /itemprop=["']image["'][^>]*src=["']([^"']+)["']/i,
  ]);

  return {
    slug,
    title,
    summary,
    category,
    cover_image: normalizeCoverPath(coverImage),
    url: articlePublicPath(slug),
  };
}

/**
 * Sync ISO dates in JSON-LD + <time datetime> (visible label filled by persian-date.js).
 */
function syncArticleDatesInHtml(html, isoDate, jalaliLabel) {
  if (!isoDate) return html;
  let out = String(html);

  out = out.replace(/"datePublished"\s*:\s*"[^"]*"/g, `"datePublished": "${isoDate}"`);
  out = out.replace(/"dateModified"\s*:\s*"[^"]*"/g, `"dateModified": "${isoDate}"`);

  if (/<time[^>]*itemprop=["']datePublished["']/i.test(out)) {
    out = out.replace(
      /(<time)([^>]*itemprop=["']datePublished["'][^>]*)(>)[^<]*(<\/time>)/gi,
      (match, open, attrs, close, end) => {
        let nextAttrs = attrs
          .replace(/\sdatetime=["'][^"']*["']/gi, '')
          .replace(/\sdata-jalali-label=["'][^"']*["']/gi, '');
        const jalaliAttr = jalaliLabel
          ? ` data-jalali-label="${jalaliLabel.replace(/"/g, '&quot;')}"`
          : '';
        return `${open}${nextAttrs} datetime="${isoDate}"${jalaliAttr}${close}${end}`;
      },
    );
  }

  if (jalaliLabel) {
    if (JALALI_COMMENT_RE.test(out)) {
      out = out.replace(JALALI_COMMENT_RE, `<!-- article-jalali: ${jalaliLabel} -->`);
    } else if (PUBLISHED_COMMENT_RE.test(out)) {
      out = out.replace(PUBLISHED_COMMENT_RE, (match) => `${match}\n  <!-- article-jalali: ${jalaliLabel} -->`);
    } else {
      out = out.replace(/<head>/i, `<head>\n  <!-- article-jalali: ${jalaliLabel} -->`);
    }
  } else if (isoDate) {
    const autoLabel = formatPersianJalaliDate(isoDate);
    if (autoLabel) {
      if (JALALI_COMMENT_RE.test(out)) {
        out = out.replace(JALALI_COMMENT_RE, `<!-- article-jalali: ${autoLabel} -->`);
      } else if (PUBLISHED_COMMENT_RE.test(out)) {
        out = out.replace(PUBLISHED_COMMENT_RE, (match) => `${match}\n  <!-- article-jalali: ${autoLabel} -->`);
      }
    }
  }

  if (PUBLISHED_COMMENT_RE.test(out)) {
    out = out.replace(PUBLISHED_COMMENT_RE, `<!-- article-published: ${isoDate} -->`);
  } else {
    out = out.replace(/<head>/i, `<head>\n  <!-- article-published: ${isoDate} -->`);
  }

  return out;
}

/**
 * Scan articles directory, optionally write synced HTML, return catalog entries sorted newest-first.
 */
function scanArticleCatalog(articlesDir, opts = {}) {
  const syncHtml = opts.syncHtml !== false;
  if (!articlesDir || !fs.existsSync(articlesDir)) return [];

  const entries = fs
    .readdirSync(articlesDir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.html$/i.test(e.name) && !e.name.startsWith('_'))
    .map((fileEntry) => {
      const filePath = path.join(articlesDir, fileEntry.name);
      const slug = fileEntry.name.replace(/\.html$/i, '');
      const stat = fs.statSync(filePath);
      let html = fs.readFileSync(filePath, 'utf8');
      const datePublished = resolvePublishedDate(html, stat);
      const jalaliLabel = resolveJalaliLabel(html);
      const meta = parseArticleMetadata(html, slug);

      if (syncHtml && datePublished) {
        const synced = syncArticleDatesInHtml(html, datePublished, jalaliLabel);
        if (synced !== html) {
          fs.writeFileSync(filePath, synced, 'utf8');
          html = synced;
        }
      }

      const catalogEntry = {
        ...meta,
        datePublished,
      };
      if (jalaliLabel) catalogEntry.jalaliLabel = jalaliLabel;
      return catalogEntry;
    });

  return sortEntriesByDate(entries);
}

function writeGeneratedCatalogJs(entries, outFile) {
  const sorted = sortEntriesByDate(entries);
  const payload = JSON.stringify(sorted, null, 2);
  const js = [
    '/**',
    ' * AUTO-GENERATED by npm run articles:sync — do not edit manually.',
    ' * Source: articles/*.html (dates from article-published comment, JSON-LD, or file ctime).',
    ' */',
    '(function (root) {',
    '  root.ARTICLES_CATALOG = ' + payload + ';',
    '})(typeof window !== "undefined" ? window : this);',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, js, 'utf8');
}

module.exports = {
  resolvePublishedDate,
  resolveJalaliLabel,
  parseArticleMetadata,
  syncArticleDatesInHtml,
  scanArticleCatalog,
  writeGeneratedCatalogJs,
  normalizeCoverPath,
  toIsoDateLocal,
  BARE_CANONICAL_ARTICLE_SLUGS,
  articlePublicPath,
};
