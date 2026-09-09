'use strict';

// ==========================================================================
// update-sitemap-articles.js — sync static articles/*.html into sitemap.xml
//
// Scans the articles/ directory for .html files and merges canonical <url>
// entries into the root sitemap.xml (no database required).
//
// Usage (host):
//   node scripts/update-sitemap-articles.js
//   node scripts/update-sitemap-articles.js --dry-run
//   node scripts/update-sitemap-articles.js --articles-dir=articles --out=sitemap.xml
//   node scripts/update-sitemap-articles.js --lastmod=mtime   # use file mtime
//
// Usage (Docker):
//   bash scripts/update-sitemap-articles-docker.sh
//
// Deploy integration:
//   • npm run sitemap:articles          — articles-only (fast, no Prisma)
//   • npm run sitemap                   — full regen + article merge
//   • Run either script before nginx picks up the static sitemap.xml volume.
// ==========================================================================

const fs = require('fs');
const path = require('path');
const {
  scanStaticArticles,
  buildArticleUrlBlocks,
  mergeArticlesIntoSitemap,
  canonicalOrigin,
} = require('./lib/static-articles-sitemap');

function parseArgs(argv) {
  const args = {
    dryRun: false,
    articlesDir: path.join(__dirname, '..', 'articles'),
    out: path.join(__dirname, '..', 'sitemap.xml'),
    lastmodMode: 'today',
  };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--articles-dir=')) args.articlesDir = path.resolve(arg.split('=')[1]);
    else if (arg.startsWith('--out=')) args.out = path.resolve(arg.split('=')[1]);
    else if (arg.startsWith('--lastmod=')) {
      const mode = arg.split('=')[1];
      if (mode === 'mtime' || mode === 'today') args.lastmodMode = mode;
      else throw new Error(`Unknown --lastmod value: ${mode} (use "today" or "mtime")`);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  process.stdout.write(`update-sitemap-articles.js — merge articles/*.html into sitemap.xml

Options:
  --dry-run                 Print resulting XML to stdout; do not write file
  --articles-dir=PATH       Source directory (default: ./articles)
  --out=PATH                Target sitemap path (default: ./sitemap.xml)
  --lastmod=today|mtime     lastmod date: run date (default) or file mtime
  -h, --help                Show this help

Environment:
  SITE_BASE                 Canonical origin (default: https://salam-doctor.ir)
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const articles = scanStaticArticles(args.articlesDir, {
    origin: process.env.SITE_BASE,
  });
  const blocks = buildArticleUrlBlocks(articles, { lastmodMode: args.lastmodMode });

  let baseXml = '';
  if (fs.existsSync(args.out)) {
    baseXml = fs.readFileSync(args.out, 'utf8');
  } else {
    process.stderr.write(
      `[sitemap-articles] Warning: ${args.out} not found — creating a minimal sitemap with article URLs only.\n`,
    );
  }

  const xml = mergeArticlesIntoSitemap(baseXml, blocks);

  if (args.dryRun) {
    process.stdout.write(xml);
    process.stderr.write(
      `\n[dry-run] ${articles.length} static article(s) from ${args.articlesDir}\n` +
        `          origin: ${canonicalOrigin()}\n`,
    );
    return;
  }

  fs.writeFileSync(args.out, xml, 'utf8');
  console.log(`Updated ${args.out}`);
  console.log(`  ${articles.length} static article URL(s) from ${args.articlesDir}`);
  console.log(`  Canonical origin: ${canonicalOrigin()}`);
  if (articles.length) {
    for (const article of articles) {
      console.log(`    • ${article.loc}`);
    }
  } else {
    console.log('  (no .html files found — removed stale /articles/*.html entries if any)');
  }
  console.log('\nIf a CDN caches /sitemap.xml, purge it after deploy.');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('update-sitemap-articles failed:', err.message || err);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, main };
