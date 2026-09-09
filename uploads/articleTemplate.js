'use strict';

// ==========================================================================
// articleTemplate — SEO-optimised blog-post renderer (EJS: views/article.ejs)
// --------------------------------------------------------------------------
// Everything is computed SERVER-SIDE so the page ships zero TOC/FAQ JS:
//   1. TOC        — parse <h2>/<h3> in body_html, inject stable Persian-safe
//                   slug ids, emit a nested table-of-contents model.
//   2. CTA hub    — resolve the directory hub page (hub_page_url/_keyword)
//                   this article should funnel to, from (in priority order):
//                   article.hub_url/hub_keyword fields (if the admin ever adds
//                   them) → category/title keyword match → default /shiraz.
//   3. JSON-LD    — Article + BreadcrumbList always; FAQPage only when the
//                   body contains real Q/A content (never fabricated).
// ==========================================================================

const path = require('path');
const ejs = require('ejs');

const SITE_BASE = process.env.SITE_BASE || 'https://salam-doctor.ir';
const VIEWS_DIR = path.join(__dirname, 'views');

// --------------------------------------------------------------------------
// Hub routing table — maps article topics to directory hub pages. Keyword
// matching runs against category + title + slug (Persian and English).
// First match wins; extend as new hub pages are added.
// --------------------------------------------------------------------------
const HUB_ROUTES = [
  { match: /بلفاروپلاستی|blepharoplasty|پلک/i, url: `${SITE_BASE}/shiraz/cosmetic-surgery`, keyword: 'بهترین کلینیک جراحی زیبایی شیراز' },
  { match: /کاشت مو|hair[- ]?transplant|پیوند مو/i, url: `${SITE_BASE}/shiraz/hair-transplant`, keyword: 'بهترین کلینیک کاشت مو شیراز' },
  { match: /کاشت ابرو|eyebrow/i, url: `${SITE_BASE}/shiraz/eyebrow-transplant`, keyword: 'بهترین مرکز کاشت ابرو شیراز' },
  { match: /لیزر|laser/i, url: `${SITE_BASE}/shiraz/laser-hair-removal`, keyword: 'بهترین کلینیک لیزر شیراز' },
  { match: /بوتاکس|botox/i, url: `${SITE_BASE}/shiraz/botox`, keyword: 'بهترین کلینیک بوتاکس شیراز' },
  { match: /فیلر|ژل|filler/i, url: `${SITE_BASE}/shiraz/fillers`, keyword: 'بهترین کلینیک فیلر و ژل شیراز' },
  { match: /لاغری|پیکرتراشی|slimming|تناسب/i, url: `${SITE_BASE}/shiraz/slimming`, keyword: 'بهترین کلینیک لاغری شیراز' },
  { match: /جوانساز|rejuvenat|پوست/i, url: `${SITE_BASE}/shiraz/skin-rejuvenation`, keyword: 'بهترین کلینیک جوانسازی پوست شیراز' },
  { match: /ایمپلنت|دندان|dental|ارتودنسی/i, url: `${SITE_BASE}/shiraz/dentistry`, keyword: 'بهترین کلینیک دندانپزشکی شیراز' },
  { match: /جراحی|surgery|بخیه/i, url: `${SITE_BASE}/shiraz/cosmetic-surgery`, keyword: 'بهترین کلینیک جراحی زیبایی شیراز' },
];
const HUB_DEFAULT = { url: `${SITE_BASE}/shiraz/dermatology`, keyword: 'بهترین کلینیک پوست و زیبایی شیراز' };

function resolveHub(article) {
  // Auto-match from topic keywords first…
  const haystack = [article.category, article.title, article.slug].filter(Boolean).join(' ');
  let hub = HUB_DEFAULT;
  for (const r of HUB_ROUTES) {
    if (r.match.test(haystack)) { hub = { url: r.url, keyword: r.keyword }; break; }
  }
  // …then apply explicit per-article admin overrides (either field alone works).
  return {
    url: article.hub_url || hub.url,
    keyword: article.hub_keyword || hub.keyword,
  };
}

// --------------------------------------------------------------------------
// Heading extraction + id injection (TOC)
// --------------------------------------------------------------------------
function stripTags(html) {
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// Persian-safe anchor slug (keeps Arabic-script letters, digits, dashes).
function anchorSlug(text, fallback) {
  const s = stripTags(text)
    .toLowerCase()
    .replace(/[\u200c\u200f\u200e]/g, ' ') // ZWNJ / directional marks
    .replace(/[^0-9a-z\u0600-\u06FF]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || fallback;
}

/**
 * Parse body_html; add id attributes to every <h2>/<h3> (respecting existing
 * ids) and return { html, toc } where toc = [{ id, text, children:[...] }].
 */
function buildToc(bodyHtml) {
  const toc = [];
  const used = new Set();
  let counter = 0;

  const html = String(bodyHtml).replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (full, level, attrs, inner) => {
      counter += 1;
      const text = stripTags(inner);
      if (!text) return full;

      const existing = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs);
      let id = existing ? existing[1] : anchorSlug(text, `section-${counter}`);
      while (used.has(id)) id = `${id}-${counter}`;
      used.add(id);

      const entry = { id, text, children: [] };
      if (level === '2' || toc.length === 0) toc.push(entry);
      else toc[toc.length - 1].children.push(entry);

      const newAttrs = existing ? attrs.replace(existing[0], `id="${id}"`) : `${attrs} id="${id}"`;
      return `<h${level}${newAttrs}>${inner}</h${level}>`;
    }
  );

  return { html, toc };
}

// --------------------------------------------------------------------------
// FAQ auto-extraction — finds a Q/A section in the article body so FAQPage
// JSON-LD mirrors VISIBLE content (Google requirement; nothing is invented).
// A heading is treated as a question if it ends with "؟"/"?" or starts with a
// Persian interrogative (آیا، چرا، چگونه، چطور، چه، کی، چند ...).
// --------------------------------------------------------------------------
const QUESTION_RE = /(\?|؟)\s*$|^(آیا|چرا|چگونه|چطور|چه|کدام|چند|کی|هزینه|بهترین زمان)\b/;

function extractFaq(bodyHtml) {
  const faq = [];
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>([\s\S]*?)(?=<h[23][^>]*>|$)/gi;
  let m;
  while ((m = re.exec(String(bodyHtml))) !== null) {
    const q = stripTags(m[2]);
    if (!q || !QUESTION_RE.test(q)) continue;
    const answerHtml = m[3] || '';
    const a = stripTags(answerHtml).slice(0, 1200);
    if (a.length < 40) continue; // too thin to be a real answer
    faq.push({ question: q, answer: a });
    if (faq.length >= 8) break;
  }
  return faq;
}

// --------------------------------------------------------------------------
// JSON-LD builders
// --------------------------------------------------------------------------
function articleJsonLd(article, canonical, ogImage) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.summary || undefined,
    image: article.cover_image ? ogImage : undefined,
    author: { '@type': 'Organization', name: article.author || 'تیم سلام دکتر', url: SITE_BASE },
    publisher: {
      '@type': 'Organization',
      name: 'سلام دکتر',
      logo: { '@type': 'ImageObject', url: `${SITE_BASE}/images/logo-heart.svg` },
    },
    datePublished: article.published_at || undefined,
    dateModified: article.updated_at || article.published_at || undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    inLanguage: 'fa-IR',
  };
}

function faqJsonLd(faq) {
  if (!faq.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

function breadcrumbJsonLd(article, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'خانه', item: `${SITE_BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'مقالات', item: `${SITE_BASE}/articles.html` },
      { '@type': 'ListItem', position: 3, name: article.title, item: canonical },
    ],
  };
}

const safeJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

// --------------------------------------------------------------------------
// Split body_html at the <h2> boundary nearest ~40% of the content so the
// mid-article conversion widget lands at natural reading depth (never inside
// a paragraph or between a heading and its first line).
// --------------------------------------------------------------------------
function splitForWidget(bodyHtml) {
  const html = String(bodyHtml);
  const target = Math.floor(html.length * 0.4);

  const boundaries = [];
  const re = /<h2[\s>]/gi;
  let m;
  while ((m = re.exec(html)) !== null) boundaries.push(m.index);

  // Need a boundary strictly inside the article (not the very first heading).
  const candidates = boundaries.filter((i) => i > 0);
  if (!candidates.length) return { before: html, after: '' };

  let best = candidates[0];
  for (const i of candidates) {
    if (Math.abs(i - target) < Math.abs(best - target)) best = i;
  }
  return { before: html.slice(0, best), after: html.slice(best) };
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------
/**
 * Render the full blog-post page. Returns a Promise<string> of HTML.
 * @param {object} article row from the articles table
 */
function renderArticle(article) {
  const canonical = `${SITE_BASE}/article/${encodeURIComponent(article.slug || '')}`;
  const ogImage = article.cover_image
    ? (/^https?:\/\//i.test(article.cover_image) ? article.cover_image : SITE_BASE + (article.cover_image.startsWith('/') ? '' : '/') + article.cover_image)
    : `${SITE_BASE}/images/hero-collage.png`;

  const { html: bodyHtml, toc } = buildToc(article.body_html || '');
  const faq = extractFaq(bodyHtml);
  const hub = resolveHub(article);
  const bodyParts = splitForWidget(bodyHtml);

  const jsonLdBlocks = [
    safeJson(articleJsonLd(article, canonical, ogImage)),
    safeJson(breadcrumbJsonLd(article, canonical)),
  ];
  const faqLd = faqJsonLd(faq);
  if (faqLd) jsonLdBlocks.push(safeJson(faqLd));

  return ejs.renderFile(
    path.join(VIEWS_DIR, 'article.ejs'),
    {
      article,
      bodyParts, // { before, after } — widget injected between them
      toc,
      faq,
      hub, // { url, keyword } → conversion widget
      canonical,
      ogImage,
      siteBase: SITE_BASE,
      jsonLdBlocks,
    },
    { rmWhitespace: false }
  );
}

module.exports = { renderArticle, buildToc, extractFaq, resolveHub, anchorSlug, splitForWidget, HUB_ROUTES };
