'use strict';

/**
 * Silo SEO breadcrumb — strict path: Home > Category Name > Article Title
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */

const DEFAULT_HOME_LABEL = 'خانه';

function normalizeBase(siteBase) {
  return String(siteBase || 'https://salam-doctor.com').replace(/\/$/, '');
}

function joinUrl(siteBase, pathname) {
  const base = normalizeBase(siteBase);
  const path = String(pathname || '').replace(/^\//, '');
  return path ? `${base}/${path}` : `${base}/`;
}

/**
 * @param {object} params
 * @param {string} [params.siteBase]
 * @param {string} [params.homeLabel]
 * @param {{ name: string, slug: string }} params.category
 * @param {{ title: string, slug: string }} params.article
 * @returns {object} BreadcrumbList JSON-LD
 */
function buildArticleBreadcrumbJsonLd(params) {
  const siteBase = normalizeBase(params && params.siteBase);
  const homeLabel =
    (params && params.homeLabel) || DEFAULT_HOME_LABEL;
  const category = params && params.category;
  const article = params && params.article;

  if (!category || !category.name || !category.slug) {
    throw new Error('category with name and slug is required for silo breadcrumb');
  }
  if (!article || !article.title || !article.slug) {
    throw new Error('article with title and slug is required for silo breadcrumb');
  }

  const categoryUrl = joinUrl(
    siteBase,
    `blog/category/${encodeURIComponent(category.slug)}`
  );
  const articleUrl = joinUrl(
    siteBase,
    `blog/${encodeURIComponent(article.slug)}`
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: homeLabel,
        item: joinUrl(siteBase, '/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: category.name,
        item: categoryUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: articleUrl,
      },
    ],
  };
}

module.exports = {
  buildArticleBreadcrumbJsonLd,
  joinUrl,
  normalizeBase,
  DEFAULT_HOME_LABEL,
};
