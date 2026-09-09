'use strict';

// ==========================================================================
// audit-gtm.js — verify / fix Google Tag Manager on static HTML pages
//
// Checks:
//   1. GTM <script> as high as possible inside <head> (right after <head> tag)
//   2. GTM <noscript> iframe immediately after opening <body>
//
// Usage:
//   node scripts/audit-gtm.js                    # audit public pages
//   node scripts/audit-gtm.js --all              # include docs/python templates
//   node scripts/audit-gtm.js --fix              # inject missing snippets
//   node scripts/audit-gtm.js --fix --path=articles
// ==========================================================================

const fs = require('fs');
const path = require('path');
const {
  GTM_ID,
  GTM_HEAD_HTML,
  GTM_BODY_HTML,
  GTM_HEAD_MARKER,
  GTM_BODY_MARKER,
} = require('./gtm-snippets');

const GTM_HEAD_INCLUDE = "<%- include('partials/gtm-head') %>";
const GTM_BODY_INCLUDE = "<%- include('partials/gtm-body') %>";
const GTM_HEAD_INCLUDE_RE = /include\(['"]partials\/gtm-head['"]\)/;
const GTM_BODY_INCLUDE_RE = /include\(['"]partials\/gtm-body['"]\)/;
const TEMPLATE_EXTENSIONS = new Set(['.html', '.ejs']);

const ROOT = path.join(__dirname, '..');

const DEFAULT_SCAN_DIRS = ['.', 'articles', 'services', 'views'];
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '_parked',
  '.git',
  'uploads',
  'shirazbeauty-app',
  'fonts',
]);
const SKIP_FILE_RE = /(^google[0-9a-f]+\.html$|^versions\.html$|^\._)/i;
const VERIFICATION_FILE_RE = /^google[0-9a-f]+\.html$/i;

function parseArgs(argv) {
  const args = {
    fix: false,
    all: false,
    paths: [...DEFAULT_SCAN_DIRS],
    json: false,
  };
  for (const arg of argv) {
    if (arg === '--fix') args.fix = true;
    else if (arg === '--all') args.all = true;
    else if (arg === '--json') args.json = true;
    else if (arg.startsWith('--path=')) args.paths = [arg.split('=')[1]];
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  if (args.all) {
    args.paths = ['.', 'articles', 'services', 'views', 'python/templates'];
  }
  return args;
}

function shouldSkipFile(relPath, baseName) {
  if (SKIP_FILE_RE.test(baseName)) return true;
  if (VERIFICATION_FILE_RE.test(baseName)) return true;
  if (relPath.includes('/partials/')) return true;
  if (relPath.includes('/examples/')) return true;
  if (relPath.startsWith('docs/') && !relPath.includes('editable')) return true;
  return false;
}

function collectTemplateFiles(scanPaths) {
  const files = [];

  function walk(absDir, relDir) {
    if (!fs.existsSync(absDir)) return;
    for (const ent of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (ent.name.startsWith('.')) continue;
      if (ent.isDirectory()) {
        if (SKIP_DIR_NAMES.has(ent.name)) continue;
        walk(path.join(absDir, ent.name), path.join(relDir, ent.name));
        continue;
      }
      const ext = path.extname(ent.name);
      if (!TEMPLATE_EXTENSIONS.has(ext)) continue;
      const rel = relDir === '.' ? ent.name : path.join(relDir, ent.name);
      if (shouldSkipFile(rel.replace(/\\/g, '/'), ent.name)) continue;
      files.push({
        abs: path.join(absDir, ent.name),
        rel: rel.replace(/\\/g, '/'),
        ext,
      });
    }
  }

  for (const scanPath of scanPaths) {
    const abs = path.isAbsolute(scanPath) ? scanPath : path.join(ROOT, scanPath);
    const rel = scanPath === '.' ? '.' : scanPath.replace(/\\/g, '/');
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      const ext = path.extname(abs);
      if (TEMPLATE_EXTENSIONS.has(ext)) {
        files.push({ abs, rel: path.basename(abs), ext });
      }
    } else {
      walk(abs, rel === '.' ? '.' : rel);
    }
  }

  const seen = new Set();
  return files.filter((f) => {
    if (seen.has(f.rel)) return false;
    seen.add(f.rel);
    return true;
  });
}

/** @deprecated use collectTemplateFiles */
function collectHtmlFiles(scanPaths) {
  return collectTemplateFiles(scanPaths);
}

function hasEjsGtmIncludes(html) {
  return GTM_HEAD_INCLUDE_RE.test(html) && GTM_BODY_INCLUDE_RE.test(html);
}

function ejsHeadGtmNearTop(html) {
  const headOpen = html.match(/<head[^>]*>/i);
  if (!headOpen) return false;
  const start = html.indexOf(headOpen[0]);
  const window = html.slice(start, start + 400);
  return GTM_HEAD_INCLUDE_RE.test(window);
}

function ejsBodyGtmImmediate(html) {
  const bodyOpen = html.match(/<body[^>]*>/i);
  if (!bodyOpen) return false;
  const start = html.indexOf(bodyOpen[0]);
  const after = html.slice(start + bodyOpen[0].length, start + bodyOpen[0].length + 200);
  return GTM_BODY_INCLUDE_RE.test(after);
}

function hasValidHeadGtm(html, ext) {
  if (ext === '.ejs') {
    return GTM_HEAD_INCLUDE_RE.test(html) || (
      html.includes(GTM_HEAD_MARKER)
      && html.includes('googletagmanager.com/gtm.js')
      && html.includes(GTM_ID)
    );
  }
  return html.includes(GTM_HEAD_MARKER)
    && html.includes('googletagmanager.com/gtm.js')
    && html.includes(GTM_ID);
}

function hasValidBodyGtm(html, ext) {
  if (ext === '.ejs') {
    return GTM_BODY_INCLUDE_RE.test(html) || (
      html.includes(GTM_BODY_MARKER)
      && html.includes('googletagmanager.com/ns.html')
      && html.includes(GTM_ID)
    );
  }
  return html.includes(GTM_BODY_MARKER)
    && html.includes('googletagmanager.com/ns.html')
    && html.includes(GTM_ID);
}

function headGtmNearTop(html, ext) {
  if (ext === '.ejs' && GTM_HEAD_INCLUDE_RE.test(html)) return ejsHeadGtmNearTop(html);
  const headOpen = html.match(/<head[^>]*>/i);
  if (!headOpen) return false;
  const start = html.indexOf(headOpen[0]);
  const window = html.slice(start, start + 1200);
  return window.includes(GTM_HEAD_MARKER) && window.includes('googletagmanager.com/gtm.js');
}

function bodyGtmImmediate(html, ext) {
  if (ext === '.ejs' && GTM_BODY_INCLUDE_RE.test(html)) return ejsBodyGtmImmediate(html);
  const bodyOpen = html.match(/<body[^>]*>/i);
  if (!bodyOpen) return false;
  const start = html.indexOf(bodyOpen[0]);
  const after = html.slice(start + bodyOpen[0].length, start + bodyOpen[0].length + 200).trim();
  return after.startsWith(GTM_BODY_MARKER);
}

function stripExistingGtm(html) {
  let out = html;
  out = out.replace(
    /<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->\s*/g,
    '',
  );
  out = out.replace(
    /<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->\s*/g,
    '',
  );
  return out;
}

function injectGtm(html, ext = '.html') {
  if (!/<head[^>]*>/i.test(html) || !/<body[^>]*>/i.test(html)) {
    return { html, changed: false, skipped: 'not a full HTML document' };
  }

  const useIncludes = ext === '.ejs';
  const headSnippet = useIncludes ? GTM_HEAD_INCLUDE : GTM_HEAD_HTML;
  const bodySnippet = useIncludes ? GTM_BODY_INCLUDE : GTM_BODY_HTML;

  let next = stripExistingGtm(html);
  if (useIncludes) {
    next = next.replace(/\s*<%- include\(['"]partials\/gtm-head['"]\) %>\s*/g, '\n');
    next = next.replace(/\s*<%- include\(['"]partials\/gtm-body['"]\) %>\s*/g, '\n');
  }
  let changed = next !== html;

  if (!hasValidHeadGtm(next, ext)) {
    next = next.replace(/(<head[^>]*>)/i, `$1\n${headSnippet}\n`);
    changed = true;
  }

  if (!hasValidBodyGtm(next, ext)) {
    next = next.replace(/(<body[^>]*>)/i, `$1\n${bodySnippet}\n`);
    changed = true;
  }

  if (hasValidHeadGtm(next, ext) && !headGtmNearTop(next, ext)) {
    next = stripExistingGtm(next);
    if (useIncludes) {
      next = next.replace(/\s*<%- include\(['"]partials\/gtm-head['"]\) %>\s*/g, '\n');
      next = next.replace(/\s*<%- include\(['"]partials\/gtm-body['"]\) %>\s*/g, '\n');
    }
    next = next.replace(/(<head[^>]*>)/i, `$1\n${headSnippet}\n`);
    changed = true;
  }

  if (hasValidBodyGtm(next, ext) && !bodyGtmImmediate(next, ext)) {
    next = stripExistingGtm(next);
    if (useIncludes) {
      next = next.replace(/\s*<%- include\(['"]partials\/gtm-head['"]\) %>\s*/g, '\n');
      next = next.replace(/\s*<%- include\(['"]partials\/gtm-body['"]\) %>\s*/g, '\n');
    }
    if (!hasValidHeadGtm(next, ext)) {
      next = next.replace(/(<head[^>]*>)/i, `$1\n${headSnippet}\n`);
    }
    next = next.replace(/(<body[^>]*>)/i, `$1\n${bodySnippet}\n`);
    changed = true;
  }

  return { html: next, changed, skipped: null };
}

function auditFile(file) {
  const html = fs.readFileSync(file.abs, 'utf8');
  const ext = file.ext || path.extname(file.abs);
  const issues = [];

  if (!/<head[^>]*>/i.test(html) || !/<body[^>]*>/i.test(html)) {
    return { ...file, issues: ['not a full HTML document'], ok: false, skipped: true };
  }

  if (!hasValidHeadGtm(html, ext)) issues.push('missing head GTM snippet');
  else if (!headGtmNearTop(html, ext)) issues.push('head GTM not at top of <head>');

  if (!hasValidBodyGtm(html, ext)) issues.push('missing body noscript GTM');
  else if (!bodyGtmImmediate(html, ext)) issues.push('body noscript not immediately after <body>');

  return { ...file, issues, ok: issues.length === 0, skipped: false };
}

function printHelp() {
  process.stdout.write(`audit-gtm.js — verify/fix GTM (${GTM_ID}) on HTML/EJS pages

Options:
  --fix              Inject or reposition canonical GTM snippets
  --all              Also scan python/templates (excludes partials/examples)
  --path=DIR         Scan a single directory (default: ., articles, services, views)
  --json             Machine-readable report
  -h, --help         Show help
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const files = collectTemplateFiles(args.paths);
  const results = files.map(auditFile);
  const failures = results.filter((r) => !r.ok && !r.skipped);

  if (args.fix) {
    let fixed = 0;
    for (const row of failures) {
      const html = fs.readFileSync(row.abs, 'utf8');
      const ext = row.ext || path.extname(row.abs);
      const { html: updated, changed, skipped } = injectGtm(html, ext);
      if (skipped) continue;
      if (changed) {
        fs.writeFileSync(row.abs, updated, 'utf8');
        fixed += 1;
      }
    }
    if (!args.json) {
      console.log(`Fixed ${fixed} file(s). Re-run without --fix to verify.`);
    }
  }

  const report = {
    containerId: GTM_ID,
    scanned: results.length,
    passed: results.filter((r) => r.ok).length,
    failed: failures.length,
    failures: failures.map((r) => ({ file: r.rel, issues: r.issues })),
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(`GTM audit (${GTM_ID})`);
    console.log(`  Scanned: ${report.scanned}`);
    console.log(`  Passed:  ${report.passed}`);
    console.log(`  Failed:  ${report.failed}`);
    if (failures.length) {
      console.log('\nIssues:');
      for (const row of failures) {
        console.log(`  ${row.rel}`);
        for (const issue of row.issues) console.log(`    - ${issue}`);
      }
    }
    if (!args.fix && failures.length) {
      console.log('\nRun: node scripts/audit-gtm.js --fix');
    }
  }

  if (failures.length && !args.fix) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
  collectTemplateFiles,
  collectHtmlFiles,
  auditFile,
  injectGtm,
  hasValidHeadGtm,
  hasValidBodyGtm,
};
