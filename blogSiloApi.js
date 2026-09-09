'use strict';

/**
 * Public blog silo API — category clusters + single article with breadcrumb JSON-LD.
 * Routes:
 *   GET /api/blog/category/:slug
 *   GET /api/blog/article/:slug
 */

const { buildArticleBreadcrumbJsonLd } = require('./blogBreadcrumb');

const SITE_BASE = (
  process.env.SITE_BASE || 'https://salam-doctor.com'
).replace(/\/$/, '');

const ARTICLE_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  metaTitle: true,
  metaDescription: true,
  featuredImageUrl: true,
  authorId: true,
  authorName: true,
  authorCredentials: true,
  publishedAt: true,
  createdAt: true,
  categoryId: true,
};

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  metaTitle: true,
  metaDescription: true,
};

let prismaSingleton = null;
let prismaUnavailable = false;

function getPrisma() {
  if (prismaUnavailable) return null;
  if (prismaSingleton) return prismaSingleton;
  if (!process.env.DATABASE_URL) {
    prismaUnavailable = true;
    return null;
  }
  try {
    const { PrismaClient } = require('@prisma/client');
    prismaSingleton = new PrismaClient();
    return prismaSingleton;
  } catch (err) {
    console.warn('[blog-silo] Prisma unavailable:', err && err.message);
    prismaUnavailable = true;
    return null;
  }
}

function trimOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function publishedWhere() {
  return {
    publishedAt: {
      not: null,
      lte: new Date(),
    },
  };
}

function serializeCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
  };
}

function serializeArticle(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    content: row.content,
    authorId: row.authorId,
    authorName: row.authorName,
    authorCredentials: row.authorCredentials,
    categoryId: row.categoryId,
    publishedAt: row.publishedAt,
    featuredImageUrl: row.featuredImageUrl,
    relatedServiceSlug: row.relatedServiceSlug,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeArticleSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    featuredImageUrl: row.featuredImageUrl,
    authorId: row.authorId,
    authorName: row.authorName,
    publishedAt: row.publishedAt || row.createdAt,
    categoryId: row.categoryId,
  };
}

function parseSlugFromPath(pathname, prefix) {
  if (!pathname || !pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length).replace(/^\/+/, '');
  if (!rest || rest.includes('/')) return null;
  try {
    return decodeURIComponent(rest);
  } catch (_err) {
    return rest;
  }
}

function createBlogSiloHandlers(deps) {
  const { sendJson } = deps;

  async function handleCategoryArticles(res, slug, method) {
    const prisma = getPrisma();
    if (!prisma) {
      sendJson(res, 503, { error: 'PostgreSQL is not configured' }, method);
      return;
    }

    const cleanSlug = trimOrNull(slug);
    if (!cleanSlug) {
      sendJson(res, 400, { error: 'Missing category slug' }, method);
      return;
    }

    try {
      const category = await prisma.category.findUnique({
        where: { slug: cleanSlug },
        select: CATEGORY_SELECT,
      });
      if (!category) {
        sendJson(res, 404, { error: 'Category not found' }, method);
        return;
      }

      const articles = await prisma.article.findMany({
        where: {
          categoryId: category.id,
          ...publishedWhere(),
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        select: ARTICLE_LIST_SELECT,
      });

      res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
      sendJson(
        res,
        200,
        {
          category: serializeCategory(category),
          articles: articles.map(serializeArticleSummary),
        },
        method
      );
    } catch (err) {
      console.error('[blog-silo] category list failed:', err && err.message);
      sendJson(res, 500, { error: 'Failed to load category articles' }, method);
    }
  }

  async function handleArticleBySlug(res, slug, method) {
    const prisma = getPrisma();
    if (!prisma) {
      sendJson(res, 503, { error: 'PostgreSQL is not configured' }, method);
      return;
    }

    const cleanSlug = trimOrNull(slug);
    if (!cleanSlug) {
      sendJson(res, 400, { error: 'Missing article slug' }, method);
      return;
    }

    try {
      const row = await prisma.article.findFirst({
        where: {
          slug: cleanSlug,
          ...publishedWhere(),
        },
        include: { category: { select: CATEGORY_SELECT } },
      });

      if (!row) {
        sendJson(res, 404, { error: 'Article not found' }, method);
        return;
      }
      if (!row.category) {
        sendJson(res, 404, { error: 'Article category not configured' }, method);
        return;
      }

      const article = serializeArticle(row);
      const category = serializeCategory(row.category);
      const breadcrumbJsonLd = buildArticleBreadcrumbJsonLd({
        siteBase: SITE_BASE,
        category,
        article,
      });

      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
      sendJson(
        res,
        200,
        {
          article,
          category,
          breadcrumbJsonLd,
        },
        method
      );
    } catch (err) {
      console.error('[blog-silo] article fetch failed:', err && err.message);
      sendJson(res, 500, { error: 'Failed to load article' }, method);
    }
  }

  function tryHandle(req, res, pathname, method) {
    if (method !== 'GET' && method !== 'HEAD') return false;

    const categorySlug = parseSlugFromPath(pathname, '/api/blog/category/');
    if (categorySlug) {
      handleCategoryArticles(res, categorySlug, method);
      return true;
    }

    const articleSlug = parseSlugFromPath(pathname, '/api/blog/article/');
    if (articleSlug) {
      handleArticleBySlug(res, articleSlug, method);
      return true;
    }

    return false;
  }

  return {
    tryHandle,
    handleCategoryArticles,
    handleArticleBySlug,
    getPrisma,
    serializeCategory,
    serializeArticle,
    buildArticleBreadcrumbJsonLd,
  };
}

module.exports = {
  createBlogSiloHandlers,
  SITE_BASE,
};
