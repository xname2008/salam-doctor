#!/usr/bin/env node
'use strict';

/**
 * Sync article publication dates in articles/*.html and regenerate the
 * browser catalog used by latest-articles.js (homepage, articles.html, sidebars).
 *
 * Usage: npm run articles:sync
 */

const path = require('path');
const {
  scanArticleCatalog,
  writeGeneratedCatalogJs,
} = require('../articleCatalog');

const ROOT = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const CATALOG_OUT = path.join(ROOT, 'assets/js/articles-catalog.generated.js');

function main() {
  const entries = scanArticleCatalog(ARTICLES_DIR, { syncHtml: true });
  writeGeneratedCatalogJs(entries, CATALOG_OUT);

  console.log(`[articles:sync] ${entries.length} article(s) synced → ${path.relative(ROOT, CATALOG_OUT)}`);
  entries.forEach((row) => {
    console.log(`  · ${row.slug}  ${row.datePublished}`);
  });
}

main();
