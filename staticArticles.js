'use strict';

const fs = require('fs');
const path = require('path');
const { formatPersianJalaliDate } = require('./persianDate');
const {
  syncArticleDatesInHtml,
  resolveJalaliLabel,
  normalizeCoverPath,
} = require('./articleCatalog');

const STATIC_ID_PREFIX = 'static:';

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstMatch(html, patterns) {
  for (const re of patterns) {
    const match = re.exec(html);
    if (match && match[1]) return match[1].trim();
  }
  return '';
}

function extractArticleBody(html) {
  const match = String(html).match(
    /<div[^>]*\bitemprop=["']articleBody["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  return match ? match[1].trim() : '';
}

function replaceAllLiterals(source, replacements) {
  let out = String(source);
  for (const [from, to] of replacements) {
    if (!from) continue;
    out = out.split(from).join(to);
  }
  return out;
}

/**
 * Parse metadata from a static articles/*.html file.
 * @param {string} html
 * @param {string} slug
 */
function parseStaticArticleHtml(html, slug) {
  const datePublished = firstMatch(html, [
    /"datePublished"\s*:\s*"([^"]+)"/,
    /<time[^>]+datetime="([^"]+)"[^>]*itemprop="datePublished"/i,
    /<time[^>]+itemprop="datePublished"[^>]+datetime="([^"]+)"/i,
  ]);

  const title = stripHtml(firstMatch(html, [
    /<h1[^>]*itemprop="headline"[^>]*>([\s\S]*?)<\/h1>/i,
    /<title>([^|]+)/i,
  ]));

  const category = stripHtml(firstMatch(html, [
    /rounded-full bg-sky-50[^>]*>([^<]+)</i,
  ]));

  const summary = firstMatch(html, [
    /<meta name="description" content="([^"]+)"/i,
  ]);

  const coverImage = firstMatch(html, [
    /<meta property="og:image" content="([^"]+)"/i,
    /itemprop="image"[^>]*src="([^"]+)"/i,
    /<img[^>]+itemprop="image"[^>]+src="([^"]+)"/i,
  ]);

  const updatedAt = firstMatch(html, [
    /"dateModified"\s*:\s*"([^"]+)"/,
  ]) || datePublished;

  const author = stripHtml(firstMatch(html, [
    /<span[^>]*itemprop="name"[^>]*class="[^"]*font-semibold[^"]*"[^>]*>([^<]+)</i,
    /<span[^>]*itemprop="name"[^>]*>([^<]+)</i,
  ])) || 'تیم سلام دکتر';

  return {
    id: STATIC_ID_PREFIX + slug,
    slug,
    title,
    summary,
    category,
    cover_image: normalizeCoverPath(coverImage) || null,
    body_html: extractArticleBody(html),
    author,
    published_at: datePublished || null,
    updated_at: updatedAt || datePublished || null,
    date_label: resolveJalaliLabel(html) || (datePublished ? formatPersianJalaliDate(datePublished) : null),
    status: 'published',
    views: 0,
    source: 'static',
    url: `/articles/${slug}.html`,
  };
}

function listStaticArticles(articlesDir) {
  if (!articlesDir || !fs.existsSync(articlesDir)) return [];

  return fs
    .readdirSync(articlesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.html$/i.test(entry.name) && !entry.name.startsWith('_'))
    .map((entry) => {
      const slug = entry.name.replace(/\.html$/i, '');
      const html = fs.readFileSync(path.join(articlesDir, entry.name), 'utf8');
      return parseStaticArticleHtml(html, slug);
    })
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
}

function isStaticArticleId(id) {
  return String(id || '').startsWith(STATIC_ID_PREFIX);
}

function staticArticlePath(articlesDir, idOrSlug) {
  const slug = isStaticArticleId(idOrSlug)
    ? String(idOrSlug).slice(STATIC_ID_PREFIX.length)
    : String(idOrSlug || '').trim();
  if (!slug) return null;
  return path.join(articlesDir, `${slug}.html`);
}

function getStaticArticleById(id, articlesDir) {
  const filePath = staticArticlePath(articlesDir, id);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const slug = path.basename(filePath, '.html');
  const html = fs.readFileSync(filePath, 'utf8');
  return parseStaticArticleHtml(html, slug);
}

/**
 * Patch an existing static article HTML file with admin edits.
 * @param {string} articlesDir
 * @param {string} id static:slug
 * @param {object} updates
 */
function saveStaticArticle(articlesDir, id, updates) {
  const filePath = staticArticlePath(articlesDir, id);
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Static article file not found');
  }

  const slug = path.basename(filePath, '.html');
  const current = parseStaticArticleHtml(fs.readFileSync(filePath, 'utf8'), slug);
  let html = fs.readFileSync(filePath, 'utf8');

  const title = String(updates.title || current.title || '').trim();
  const summary = String(updates.summary || current.summary || '').trim();
  const category = String(updates.category || current.category || '').trim();
  const author = String(updates.author || current.author || 'تیم سلام دکتر').trim();
  const coverImage = String(updates.cover_image || current.cover_image || '').trim();
  const bodyHtml = String(updates.body_html || current.body_html || '').trim();
  const publishedAt = String(updates.published_at || current.published_at || '').slice(0, 10);
  const existingJalali = resolveJalaliLabel(html);
  let jalaliLabel = String(updates.date_label || '').trim();
  if (!jalaliLabel && publishedAt) {
    jalaliLabel = (publishedAt === String(current.published_at || '').slice(0, 10) && existingJalali)
      ? existingJalali
      : formatPersianJalaliDate(publishedAt);
  }
  const oldTitle = current.title || title;

  html = replaceAllLiterals(html, [
    [`<title>${oldTitle} | سلام دکتر</title>`, `<title>${title} | سلام دکتر</title>`],
    [`content="${oldTitle}"`, `content="${escapeHtmlAttr(title)}"`],
    [`"headline": "${oldTitle}"`, `"headline": "${title.replace(/"/g, '\\"')}"`],
    [`>${oldTitle}</h1>`, `>${title}</h1>`],
    [`alt="${oldTitle}"`, `alt="${escapeHtmlAttr(title)}"`],
  ]);

  if (summary) {
    html = html.replace(
      /<meta name="description" content="[^"]*"/i,
      `<meta name="description" content="${escapeHtmlAttr(summary)}"`,
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*"/i,
      `<meta property="og:description" content="${escapeHtmlAttr(summary)}"`,
    );
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*"/i,
      `<meta name="twitter:description" content="${escapeHtmlAttr(summary)}"`,
    );
    html = html.replace(
      /"description": "[^"]*"/,
      `"description": "${summary.replace(/"/g, '\\"')}"`,
    );
  }

  if (category) {
    html = html.replace(
      /rounded-full bg-sky-50[^>]*>[^<]+</,
      `rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">${category}<`,
    );
  }

  if (coverImage) {
    html = html.replace(
      /<meta property="og:image" content="[^"]*"/i,
      `<meta property="og:image" content="${escapeHtmlAttr(coverImage)}"`,
    );
    html = html.replace(
      /<meta name="twitter:image" content="[^"]*"/i,
      `<meta name="twitter:image" content="${escapeHtmlAttr(coverImage)}"`,
    );
    html = html.replace(
      /"image": "[^"]*"/,
      `"image": "${coverImage.replace(/"/g, '\\"')}"`,
    );
    html = html.replace(
      /(<img[^>]*itemprop="image"[^>]*\ssrc=")[^"]*(")/i,
      `$1${escapeHtmlAttr(coverImage)}$2`,
    );
  }

  if (publishedAt) {
    html = syncArticleDatesInHtml(html, publishedAt, jalaliLabel);
  }

  if (author) {
    html = html.replace(
      /(<span[^>]*itemprop="name"[^>]*>)[^<]*(<\/span>)/i,
      `$1${author}$2`,
    );
    html = html.replace(
      /"name": "تیم سلام دکتر"/,
      `"name": "${author.replace(/"/g, '\\"')}"`,
    );
  }

  if (bodyHtml) {
    html = html.replace(
      /(<div[^>]*\bitemprop=["']articleBody["'][^>]*>)([\s\S]*?)(<\/div>)/i,
      `$1\n\n        ${bodyHtml}\n\n      $3`,
    );
  }

  fs.writeFileSync(filePath, html, 'utf8');
  return parseStaticArticleHtml(html, slug);
}

module.exports = {
  STATIC_ID_PREFIX,
  parseStaticArticleHtml,
  extractArticleBody,
  listStaticArticles,
  isStaticArticleId,
  getStaticArticleById,
  saveStaticArticle,
  staticArticlePath,
};
