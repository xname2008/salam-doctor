#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'clinics', '114');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'media.json'), 'utf8'));

function check(rel) {
  const full = path.join(ROOT, rel);
  const ok = fs.existsSync(full);
  console.log((ok ? '✓' : '✗') + ' ' + rel);
  return ok;
}

let ok = true;
console.log('Nahal assets (clinics/114):\n');
ok = check(manifest.logo) && ok;
ok = check(manifest.hero) && ok;
(manifest.gallery || []).forEach((item) => {
  ok = check(typeof item === 'string' ? item : item.src) && ok;
});
(manifest.beforeAfter || []).forEach((pair) => {
  ok = check(pair.before) && ok;
  ok = check(pair.after) && ok;
});
if (manifest.video) {
  if (manifest.video.src) ok = check(manifest.video.src) && ok;
  if (manifest.video.poster) ok = check(manifest.video.poster) && ok;
}
const videoPath = manifest.video && manifest.video.src
  ? path.join(ROOT, manifest.video.src)
  : null;
if (videoPath && fs.existsSync(videoPath)) {
  const mb = (fs.statSync(videoPath).size / (1024 * 1024)).toFixed(1);
  console.log('\nVideo size: ' + mb + ' MB');
}
console.log(ok ? '\nAll assets found.' : '\nMissing files — fix before deploy.');
process.exit(ok ? 0 : 1);
