'use strict';

// ==========================================================================
// update-sitemap-articles.js — write articles-only sitemap-articles.xml
//
// NEVER writes to sitemap.xml (pages sitemap). That regression wiped hubs
// on 2026-09-10 when articles were merged into a truncated pages file.
//
// Usage:
//   node scripts/update-sitemap-articles.js
//   node scripts/update-sitemap-articles.js --dry-run
//   node scripts/update-sitemap-articles.js --out=sitemap-articles.xml
// ==========================================================================

const fs = require('fs');
const path = require('path');
const {
  scanStaticArticles,
  buildArticleUrlBlocks,
  canonicalOrigin,
} = require('./lib/static-articles-sitemap');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    articlesDir: path.join(__dirname, '..', 'articles'),
    out: path.join(__dirname, '..', 'sitemap-articles.xml'),
    lastmodMode: 'mtime',
  };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--articles-dir=')) args.articlesDir = path.resolve(arg.split('=')[1]);
    else if (arg.startsWith('--out=')) args.out = path.resolve(arg.split('=')[1]);
    else if (arg.startsWith('--lastmod=')) {
      const mode = arg.split('=')[1];
      if (mode === 'mtime' || mode === 'today') args.lastmodMode = mode;
      else throw new Error(`Unknown --lastmod value: ${mode}`);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  process.stdout.write(`update-sitemap-articles.js — build sitemap-articles.xml only

Options:
  --dry-run                 Print XML to stdout; do not write
  --articles-dir=PATH       Source directory (default: ./articles)
  --out=PATH                Output path (default: ./sitemap-articles.xml)
  --lastmod=today|mtime     lastmod source (default: mtime)
  -h, --help                Show help

IMPORTANT: This script NEVER writes sitemap.xml (pages).
`);
}

function buildArticlesSitemapXml(blocks) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...(blocks || []),
    '</urlset>',
    '',
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const outBase = path.basename(args.out).toLowerCase();
  if (outBase === 'sitemap.xml') {
    throw new Error(
      'Refusing to write articles into sitemap.xml — use sitemap-articles.xml (pages sitemap is separate).'
    );
  }

  const articles = scanStaticArticles(args.articlesDir, {
    origin: process.env.SITE_BASE || 'https://salam-doctor.com',
  }).filter((row) => {
    // Skip prompt / non-published markdown companions; only real article HTML.
    return row && row.filename && !/^\d{4}-\d{2}-\d{2}-/.test(row.filename);
  });

  // Prefer the curated 5 public articles; if filter emptied everything, fall back.
  let list = articles;
  if (!list.length) {
    list = scanStaticArticles(args.articlesDir, {
      origin: process.env.SITE_BASE || 'https://salam-doctor.com',
    });
  }

  // Drop dated SEO prompt HTML if any slipped in (*.md companions are already skipped).
  list = list.filter((row) => !String(row.filename).includes('consolidation') && !String(row.filename).includes('sitemap-rebuild'));

  const blocks = buildArticleUrlBlocks(list, { lastmodMode: args.lastmodMode });
  const xml = buildArticlesSitemapXml(blocks);

  if (args.dryRun) {
    process.stdout.write(xml);
    process.stderr.write(
      `\n[dry-run] ${list.length} article(s) → ${args.out}\n` +
        `          origin: ${canonicalOrigin(process.env.SITE_BASE)}\n`
    );
    return;
  }

  fs.writeFileSync(args.out, xml, 'utf8');
  console.log(`Wrote ${args.out}`);
  console.log(`  ${list.length} article URL(s) from ${args.articlesDir}`);
  console.log(`  Canonical origin: ${canonicalOrigin(process.env.SITE_BASE)}`);
  list.forEach((a) => console.log(`    • ${a.loc}`));
  console.log('\nDid NOT touch sitemap.xml (pages).');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('update-sitemap-articles failed:', err.message || err);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, main, buildArticlesSitemapXml };
