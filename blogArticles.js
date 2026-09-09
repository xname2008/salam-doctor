/**
 * PostgreSQL-backed blog articles (Prisma).
 * Powers POST /api/articles, GET /blog, GET /blog/:slug.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const { buildArticleBreadcrumbJsonLd } = require('./blogBreadcrumb');
const { formatPersianJalaliDate } = require('./persianDate');

const SITE_BASE = process.env.SITE_BASE || 'https://salam-doctor.com';
const DEFAULT_OG = `${SITE_BASE}/images/hero-collage.png`;

let prismaClient = null;
let prismaUnavailable = false;

function getPrisma() {
  if (prismaUnavailable) return null;
  if (prismaClient) return prismaClient;
  if (!process.env.DATABASE_URL) {
    prismaUnavailable = true;
    return null;
  }
  try {
    const { PrismaClient } = require('@prisma/client');
    prismaClient = new PrismaClient();
    return prismaClient;
  } catch (err) {
    console.warn('[blog] Prisma unavailable:', err && err.message);
    prismaUnavailable = true;
    return null;
  }
}

function trimOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function makeSlug(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180) || `article-${Date.now()}`;
}

function cleanContent(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'h1', 'h2', 'h3', 'h4', 'figure', 'figcaption',
    ]),
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      '*': ['class', 'id'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Best-effort Persian -> Pinglish transliteration, used only to build
// short, URL-safe anchor ids for CMS-authored headings (id="..." itself is
// never shown to readers, so an approximate transliteration is fine).
const PERSIAN_TO_LATIN = {
  'آ': 'a', 'ا': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j',
  'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z',
  'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z', 'ط': 't', 'ظ': 'z',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l',
  'م': 'm', 'ن': 'n', 'و': 'v', 'ه': 'h', 'ی': 'y', 'ء': '', 'ة': 'h',
  'ۀ': 'h', 'ي': 'y', 'ك': 'k',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6',
  '۷': '7', '۸': '8', '۹': '9',
};

function slugify(text) {
  const transliterated = String(text || '')
    .split('')
    .map((ch) => (PERSIAN_TO_LATIN[ch] != null ? PERSIAN_TO_LATIN[ch] : ch))
    .join('');
  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/^-|-$/g, '');
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, '').trim();
}

/**
 * Injects semantic id attributes into an article's <h2>/<h3> headings and
 * builds a matching Table-of-Contents (jump-links) block, so Google can
 * surface Sitelinks for long-form blog posts. Headings that already carry
 * an id (from the editor) are left untouched.
 */
function buildArticleToc(contentHtml) {
  const usedIds = new Set();
  const headings = [];

  const contentWithIds = String(contentHtml || '').replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, tag, attrs, inner) => {
      const label = stripTags(inner);
      if (!label) return match;

      const existingIdMatch = attrs.match(/\sid=["']([^"']+)["']/i);
      let id = existingIdMatch ? existingIdMatch[1] : slugify(label);
      if (!id) id = `section-${headings.length + 1}`;
      let uniqueId = id;
      let n = 2;
      while (usedIds.has(uniqueId)) {
        uniqueId = `${id}-${n}`;
        n += 1;
      }
      usedIds.add(uniqueId);

      const newAttrs = existingIdMatch ? attrs : `${attrs} id="${uniqueId}"`;
      headings.push({ tag, id: uniqueId, label });
      return `<${tag}${newAttrs}>${inner}</${tag}>`;
    }
  );

  if (headings.length < 2) {
    return { content: contentHtml, tocHtml: '' };
  }

  const items = headings
    .map((h) => {
      const shortLabel = escapeHtml(
        h.label.split(/\s+/).slice(0, 6).join(' ')
      );
      return `<li><a href="#${escapeHtml(h.id)}">${shortLabel}</a></li>`;
    })
    .join('');

  const tocHtml =
    `<nav class="toc-nav" aria-label="فهرست مطالب مقاله">` +
    `<p class="toc-title">در این مقاله بخوانید:</p>` +
    `<ul class="toc-list">${items}</ul>` +
    `</nav>`;

  return { content: contentWithIds, tocHtml };
}

function toPublicArticle(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    meta_title: row.metaTitle,
    meta_description: row.metaDescription,
    content: row.content,
    featured_image_url: row.featuredImageUrl,
    author_id: row.authorId,
    author_name: row.authorName,
    author_credentials: row.authorCredentials,
    category_id: row.categoryId,
    published_at: row.publishedAt,
    related_service_slug: row.relatedServiceSlug,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function relatedServiceOptions() {
  let landings = {};
  try {
    landings = require('./serviceLanding').SERVICE_LANDINGS || {};
  } catch (_err) {
    landings = {};
  }
  return Object.keys(landings).map((slug) => ({
    slug,
    label: landings[slug].label || slug,
  }));
}

async function uniqueSlug(prisma, base, excludeId) {
  let slug = makeSlug(base);
  let n = 0;
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await prisma.article.findUnique({ where: { slug: candidate } });
    if (!existing || (excludeId != null && existing.id === excludeId)) {
      return candidate;
    }
    n += 1;
    if (n > 50) return `${slug}-${Date.now()}`;
  }
}

function articleJsonLd(article) {
  const url = `${SITE_BASE}/blog/${encodeURIComponent(article.slug)}`;
  const image = article.featuredImageUrl
    ? (article.featuredImageUrl.startsWith('http')
      ? article.featuredImageUrl
      : `${SITE_BASE}/${String(article.featuredImageUrl).replace(/^\//, '')}`)
    : DEFAULT_OG;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription || article.title,
    image: [image],
    datePublished: article.createdAt
      ? new Date(article.createdAt).toISOString()
      : undefined,
    dateModified: article.createdAt
      ? new Date(article.createdAt).toISOString()
      : undefined,
    author: {
      '@type': 'Person',
      name: article.authorName || 'تیم سلام دکتر',
      description: article.authorCredentials || undefined,
    },
    publisher: {
      '@type': 'Organization',
      name: 'سلام دکتر',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_BASE}/images/logo-heart.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    inLanguage: 'fa-IR',
  };
}

function breadcrumbJsonLd(article, category) {
  if (category && category.name && category.slug) {
    return buildArticleBreadcrumbJsonLd({
      siteBase: SITE_BASE,
      category,
      article,
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'خانه',
        item: `${SITE_BASE}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'بلاگ',
        item: `${SITE_BASE}/blog`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: `${SITE_BASE}/blog/${encodeURIComponent(article.slug)}`,
      },
    ],
  };
}

function createBlogArticleHandlers(deps) {
  const {
    rootDir,
    sendJson,
    sendHtml,
    sendText,
    injectHeadSeo,
    readJsonBody,
  } = deps;

  const listTemplatePath = path.join(rootDir, 'blog-list.html');
  const postTemplatePath = path.join(rootDir, 'blog-post.html');

  function readTemplate(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }

  async function handleCreateArticle(req, res) {
    const prisma = getPrisma();
    if (!prisma) {
      sendJson(res, 503, {
        error: 'PostgreSQL is not configured (DATABASE_URL). Blog articles require Prisma.',
      });
      return;
    }

    const data = await readJsonBody(req, res);
    if (!data) return;

    const title = trimOrNull(data.title);
    const content = cleanContent(data.content || data.body_html || '');
    if (!title) {
      sendJson(res, 400, { error: 'Missing required field: title' });
      return;
    }
    if (!content.trim()) {
      sendJson(res, 400, { error: 'Missing required field: content' });
      return;
    }

    try {
      const slug = await uniqueSlug(
        prisma,
        trimOrNull(data.slug) || title
      );
      const categoryIdRaw = data.category_id ?? data.categoryId;
      const categoryId =
        categoryIdRaw == null || categoryIdRaw === ''
          ? null
          : Number.parseInt(String(categoryIdRaw), 10);
      if (categoryIdRaw != null && categoryIdRaw !== '' && !Number.isInteger(categoryId)) {
        sendJson(res, 400, { error: 'Invalid category_id' });
        return;
      }
      const publishedAtRaw = trimOrNull(data.published_at || data.publishedAt);
      const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();
      if (publishedAtRaw && Number.isNaN(publishedAt.getTime())) {
        sendJson(res, 400, { error: 'Invalid published_at' });
        return;
      }

      const created = await prisma.article.create({
        data: {
          slug,
          title,
          metaTitle: trimOrNull(data.meta_title || data.metaTitle),
          metaDescription: trimOrNull(data.meta_description || data.summary),
          content,
          authorId: trimOrNull(data.author_id || data.authorId),
          categoryId,
          publishedAt,
          featuredImageUrl: trimOrNull(
            data.featured_image_url || data.cover_image
          ),
          authorName:
            trimOrNull(data.author_name || data.author) || 'تیم سلام دکتر',
          authorCredentials: trimOrNull(data.author_credentials),
          relatedServiceSlug: trimOrNull(data.related_service_slug),
        },
      });
      sendJson(res, 201, { success: true, article: toPublicArticle(created) });
    } catch (err) {
      console.error('[blog] create failed:', err);
      if (err && err.code === 'P2002') {
        sendJson(res, 409, { error: 'Slug already exists' });
        return;
      }
      sendJson(res, 500, { error: 'Failed to create article' });
    }
  }

  async function handleListArticlesApi(res) {
    const prisma = getPrisma();
    if (!prisma) {
      sendJson(res, 503, { error: 'PostgreSQL is not configured' });
      return;
    }
    try {
      const rows = await prisma.article.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          metaDescription: true,
          featuredImageUrl: true,
          authorName: true,
          authorCredentials: true,
          relatedServiceSlug: true,
          createdAt: true,
        },
      });
      sendJson(
        res,
        200,
        rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          meta_description: row.metaDescription,
          summary: row.metaDescription,
          featured_image_url: row.featuredImageUrl,
          cover_image: row.featuredImageUrl,
          author_name: row.authorName,
          author: row.authorName,
          author_credentials: row.authorCredentials,
          related_service_slug: row.relatedServiceSlug,
          created_at: row.createdAt,
          published_at: row.createdAt,
        }))
      );
    } catch (err) {
      console.error('[blog] list failed:', err);
      sendJson(res, 500, { error: 'Failed to list articles' });
    }
  }

  async function handleBlogListPage(res) {
    const prisma = getPrisma();
    let html;
    try {
      html = readTemplate(listTemplatePath);
    } catch (err) {
      console.error('[blog] missing blog-list.html:', err);
      sendText(res, 500, 'Blog list template unavailable');
      return;
    }

    let cards = '<p class="blog-empty">به‌زودی مقالات جدید منتشر می‌شوند.</p>';
    if (prisma) {
      try {
        const rows = await prisma.article.findMany({
          orderBy: { createdAt: 'desc' },
        });
        if (rows.length) {
          cards = `<div class="blog-grid">${rows
            .map((row) => {
              const href = `/blog/${encodeURIComponent(row.slug)}`;
              const img = row.featuredImageUrl
                ? `<img src="${escapeHtml(row.featuredImageUrl)}" alt="${escapeHtml(row.title)}" width="640" height="360" loading="lazy" decoding="async">`
                : '<span class="blog-card-placeholder" aria-hidden="true"></span>';
              const desc = row.metaDescription
                ? `<p>${escapeHtml(row.metaDescription)}</p>`
                : '';
              const author = row.authorName
                ? `<span class="blog-card-author">${escapeHtml(row.authorName)}</span>`
                : '';
              return (
                `<article class="blog-card">` +
                `<a class="blog-card-media" href="${href}">${img}</a>` +
                `<div class="blog-card-body">` +
                author +
                `<h2><a href="${href}">${escapeHtml(row.title)}</a></h2>` +
                desc +
                `<a class="btn btn-main" href="${href}">مطالعه مقاله</a>` +
                `</div></article>`
              );
            })
            .join('')}</div>`;
        }
      } catch (err) {
        console.error('[blog] list page query failed:', err);
        cards =
          '<p class="blog-empty">خطا در بارگذاری مقالات. لطفاً بعداً دوباره تلاش کنید.</p>';
      }
    } else {
      cards =
        '<p class="blog-empty">اتصال پایگاه‌داده PostgreSQL پیکربندی نشده است.</p>';
    }

    html = html.replace('<!-- BLOG_LIST_CARDS -->', cards);
    html = injectHeadSeo(html, {
      title: 'بلاگ و مقالات پزشکی و زیبایی | سلام دکتر',
      description:
        'مقالات تخصصی زیبایی و سلامت شیراز با نویسندگان دارای اعتبار علمی — راهنمای انتخاب کلینیک و درمان.',
      canonical: `${SITE_BASE}/blog`,
      ogImage: DEFAULT_OG,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'بلاگ سلام دکتر',
        url: `${SITE_BASE}/blog`,
        publisher: { '@type': 'Organization', name: 'سلام دکتر' },
      },
    });
    sendHtml(res, 200, html);
  }

  async function handleBlogPostPage(slug, res) {
    const prisma = getPrisma();
    let html;
    try {
      html = readTemplate(postTemplatePath);
    } catch (err) {
      console.error('[blog] missing blog-post.html:', err);
      sendText(res, 500, 'Blog post template unavailable');
      return;
    }

    if (!prisma) {
      sendHtml(
        res,
        503,
        injectHeadSeo(html, {
          title: 'بلاگ در دسترس نیست | سلام دکتر',
          description: 'اتصال پایگاه‌داده پیکربندی نشده است.',
          canonical: `${SITE_BASE}/blog`,
        }).replace(
          '<!-- BLOG_POST_BODY -->',
          '<p>اتصال PostgreSQL پیکربندی نشده است.</p>'
        )
      );
      return;
    }

    const cleanSlug = trimOrNull(slug);
    if (!cleanSlug) {
      sendText(res, 400, 'Missing slug');
      return;
    }

    try {
      const row = await prisma.article.findUnique({
        where: { slug: cleanSlug },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              metaTitle: true,
              metaDescription: true,
            },
          },
        },
      });
      if (!row) {
        const notFound = injectHeadSeo(html, {
          title: 'مقاله یافت نشد | سلام دکتر',
          description: 'مقاله مورد نظر پیدا نشد.',
          canonical: `${SITE_BASE}/blog`,
        }).replace(
          '<!-- BLOG_POST_BODY -->',
          '<p>مقاله یافت نشد. <a href="/blog">بازگشت به بلاگ</a></p>'
        );
        sendHtml(res, 404, notFound);
        return;
      }

      const article = toPublicArticle(row);
      const image = article.featured_image_url
        ? (article.featured_image_url.startsWith('http')
          ? article.featured_image_url
          : `${SITE_BASE}/${String(article.featured_image_url).replace(/^\//, '')}`)
        : DEFAULT_OG;

      const publishedLabel = formatPersianJalaliDate(article.created_at);
      const isoDate = article.created_at
        ? new Date(article.created_at).toISOString().slice(0, 10)
        : '';

      const verifiedIcon =
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M12 2.5l2.2 1.2 2.5-.2.9 2.3 2.3.9-.2 2.5L21.5 12l-1.2 2.2.2 2.5-2.3.9-.9 2.3-2.5-.2L12 21.5l-2.2-1.2-2.5.2-.9-2.3-2.3-.9.2-2.5L1.5 12l1.2-2.2-.2-2.5 2.3-.9.9-2.3 2.5.2L12 2.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>' +
        '<path d="M8.2 12.1l2.4 2.4 5.2-5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';

      const academicIcon =
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<path d="M3 9.5L12 4l9 5.5-9 5.5L3 9.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M6.5 12.2v4.3c0 .4.8 1.5 5.5 2.7 4.7-1.2 5.5-2.3 5.5-2.7v-4.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M20.2 10.2v5.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
        '</svg>';

      const authorIcon =
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<circle cx="12" cy="9" r="3.2" stroke="currentColor" stroke-width="1.7"/>' +
        '<path d="M5.5 19.2c1.2-3 3.5-4.5 6.5-4.5s5.3 1.5 6.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
        '</svg>';

      const credentials = article.author_credentials
        ? `<p class="author-credentials">${academicIcon}<span>${escapeHtml(article.author_credentials)}</span></p>`
        : '';

      const cover = article.featured_image_url
        ? `<figure class="blog-cover"><img src="${escapeHtml(article.featured_image_url)}" alt="${escapeHtml(`عکس مقاله ${article.title}`)}" width="1280" height="720" fetchpriority="high" decoding="async"></figure>`
        : '';

      let serviceCta = '';
      if (article.related_service_slug) {
        let serviceLabel = article.related_service_slug;
        try {
          const landings = require('./serviceLanding').SERVICE_LANDINGS || {};
          if (landings[article.related_service_slug]) {
            serviceLabel =
              landings[article.related_service_slug].label || serviceLabel;
          }
        } catch (_err) {
          /* ignore */
        }
        const href = `/services/${encodeURIComponent(article.related_service_slug)}`;
        serviceCta =
          `<aside class="blog-related-cta" aria-label="دعوت به مشاهده کلینیک‌های مرتبط">` +
          `<div class="blog-related-cta-inner">` +
          `<p class="blog-related-cta-eyebrow">مسیر رزرو و انتخاب مرکز</p>` +
          `<h2>مشاهده بهترین کلینیک‌های مرتبط</h2>` +
          `<p>مراکز منتخب سلام دکتر برای «${escapeHtml(serviceLabel)}» در شیراز را مقایسه کنید و مشاوره بگیرید.</p>` +
          `<a class="btn" href="${href}">` +
          `<span>مشاهده کلینیک‌های ${escapeHtml(serviceLabel)}</span>` +
          `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` +
          `</a>` +
          `</div></aside>`;
      }

      const { content: articleContentWithIds, tocHtml } = buildArticleToc(
        article.content
      );

      const body =
        `<header class="blog-post-header">` +
        `<span class="blog-kicker">مقاله تخصصی سلام دکتر</span>` +
        `<h1>${escapeHtml(article.title)}</h1>` +
        `<div class="blog-post-meta">` +
        (isoDate
          ? `<time datetime="${escapeHtml(isoDate)}">تاریخ انتشار: ${escapeHtml(publishedLabel)}</time>`
          : '') +
        `</div>` +
        `<section class="author-profile" aria-label="پروفایل نویسنده">` +
        `<div class="author-avatar" aria-hidden="true">${authorIcon}</div>` +
        `<div class="author-profile-body">` +
        `<p class="author-profile-label">${verifiedIcon}<span>نویسنده تأییدشده · E-E-A-T</span></p>` +
        `<h2 class="author-name">${escapeHtml(article.author_name || 'تیم سلام دکتر')}</h2>` +
        credentials +
        `</div>` +
        `</section>` +
        `</header>` +
        tocHtml +
        cover +
        `<div class="article-content">${articleContentWithIds}</div>` +
        serviceCta;

      html = html.replace('<!-- BLOG_POST_BODY -->', body);
      // Update breadcrumb current crumb with article title
      html = html.replace(
        'id="blog-crumb-current" class="seo-breadcrumb-current">مقاله</span>',
        `id="blog-crumb-current" class="seo-breadcrumb-current">${escapeHtml(article.title)}</span>`
      );
      html = injectHeadSeo(html, {
        title: `${article.title} | سلام دکتر`,
        description: article.meta_description || article.title,
        canonical: `${SITE_BASE}/blog/${encodeURIComponent(article.slug)}`,
        ogImage: image,
        jsonLd: [articleJsonLd(row), breadcrumbJsonLd(row, row.category)],
      });
      sendHtml(res, 200, html);
    } catch (err) {
      console.error('[blog] post page failed:', err);
      sendText(res, 500, 'Internal server error');
    }
  }

  return {
    handleCreateArticle,
    handleListArticlesApi,
    handleBlogListPage,
    handleBlogPostPage,
    relatedServiceOptions,
    getPrisma,
  };
}

module.exports = {
  createBlogArticleHandlers,
  relatedServiceOptions,
  SITE_BASE,
};
