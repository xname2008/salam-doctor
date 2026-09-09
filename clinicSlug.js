'use strict';

/**
 * SEO slugs for doctor/clinic profiles: /doctor/:slug
 *
 * Priority:
 *   1. Explicit clinic.slug (manual / admin)
 *   2. englishName / brandName (e.g. "Nahal Clinic" → nahal-clinic)
 *   3. Clean auto-generation from name (≤4 key words, fillers stripped)
 *
 * Legacy transliterated slugs and clinic-{id} still resolve → 301 to canonical.
 */

const fs = require('fs');
const path = require('path');

let slugify;
try {
  slugify = require('slugify');
} catch (_err) {
  slugify = function asciiSlugify(text, _opts) {
    return String(text || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };
}

const ROOT = path.join(__dirname);
const SLUG_JSON = path.join(ROOT, 'data', 'clinic-slugs.json');
const REDIRECT_JSON = path.join(ROOT, 'data', 'clinic-slug-redirects.json');

const MAX_SLUG_WORDS = 4;

/** Stop-words / filler tokens (Persian + translit + English) stripped from auto-slugs. */
const FILLER_WORDS = new Set([
  'clinic',
  'klinik',
  'klynyk',
  'center',
  'centre',
  'mrkz',
  'markaz',
  'doctor',
  'dr',
  'doktor',
  'specialized',
  'specialty',
  'tkhssy',
  'takhasosi',
  'beauty',
  'zybayy',
  'medical',
  'and',
  'the',
  'of',
  'in',
  'for',
  'with',
  'v',
  'va',
  'ba',
  'az',
  'dar',
  'shiraz',
  'tehran',
  'isfahan',
  'mashhad',
  'tabriz',
  // Persian fillers (pre-transliteration strip via regex below)
]);

const FA_FILLER_RE =
  /(?:^|[\s\-_/]+)(کلینیک|کلينيک|مرکز|مراکز|دکتر|دكتر|تخصصی|تخصصي|فوق\s*تخصصی|زیبایی|زيبايي|پوست|مو|لیزر|ليزر)(?=[\s\-_/]|$)/gi;

/** Known Persian brand tokens → short English brand (not full transliteration). */
const FA_BRAND_MAP = {
  نهال: 'nahal',
  ترنج: 'toranj',
  رخ: 'rokh',
  صالح: 'saleh',
  متقی: 'motaghi',
  متقي: 'motaghi',
  ایرسا: 'irsa',
  ايرسا: 'irsa',
  پارسه: 'parseh',
  آرمانی: 'armani',
  ارمانی: 'armani',
  بوژان: 'bozhan',
  دنسا: 'densa',
  ارغوان: 'arghavan',
  ورا: 'vera',
  مهسا: 'mahsa',
  ترنم: 'tarannom',
  مهدخت: 'mahdokht',
  نونا: 'nona',
  آتریسا: 'atrisa',
  اتریسا: 'atrisa',
  جلایی: 'jalaei',
  جلايي: 'jalaei',
  آریان: 'arian',
  اریان: 'arian',
  پرنیان: 'parnian',
  پرنيان: 'parnian',
  هیرا: 'hira',
  هير: 'hira',
  سمر: 'samar',
  سیب: 'sib',
  سيب: 'sib',
  دی: 'day',
  دي: 'day',
  ماه: 'mah',
  مون: 'moon',
  فیس: 'face',
  فيس: 'face',
};

/**
 * Manual overrides by clinic id (english brand + preferred slug).
 * Used when catalog/DB has no englishName yet.
 */
const MANUAL_BY_ID = {
  114: { englishName: 'Nahal Clinic', slug: 'nahal-clinic' },
};

const FA_TO_LATIN = {
  آ: 'a', ا: 'a', أ: 'a', إ: 'e', ب: 'b', پ: 'p', ت: 't', ث: 's',
  ج: 'j', چ: 'ch', ح: 'h', خ: 'kh', د: 'd', ذ: 'z', ر: 'r', ز: 'z',
  ژ: 'zh', س: 's', ش: 'sh', ص: 's', ض: 'z', ط: 't', ظ: 'z', ع: 'a',
  غ: 'gh', ف: 'f', ق: 'q', ک: 'k', ك: 'k', گ: 'g', ل: 'l', م: 'm',
  ن: 'n', و: 'v', ه: 'h', ی: 'y', ي: 'y', ئ: 'y', ؤ: 'v', ة: 'h',
  ء: '', '‌': '-', ' ': '-',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

let cache = {
  byId: new Map(),
  bySlug: new Map(),
  redirects: new Map(), // legacySlug → id
  loaded: false,
};

function transliterateFa(value) {
  return String(value || '')
    .split('')
    .map((ch) => (Object.prototype.hasOwnProperty.call(FA_TO_LATIN, ch) ? FA_TO_LATIN[ch] : ch))
    .join('');
}

function applyFaBrandMap(value) {
  let out = String(value || '');
  for (const [fa, en] of Object.entries(FA_BRAND_MAP)) {
    out = out.split(fa).join(` ${en} `);
  }
  return out;
}

/**
 * Sanitize any raw string into a short SEO slug (max 3–4 key words).
 */
function sanitizeSlug(raw, opts = {}) {
  const maxWords = opts.maxWords != null ? opts.maxWords : MAX_SLUG_WORDS;
  let text = String(raw || '').trim();
  if (!text) return 'clinic';

  text = text.replace(FA_FILLER_RE, ' ');
  text = applyFaBrandMap(text);
  text = transliterateFa(text);

  let slug = slugify(text, { lower: true, strict: true, trim: true });
  slug = slug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const parts = slug.split('-').filter(Boolean);
  const hasNumber = parts.some((p) => /^\d+$/.test(p));
  const kept = [];
  for (const part of parts) {
    if (FILLER_WORDS.has(part)) {
      // Keep "clinic" when paired with an id/number → sample-clinic-1
      if (!(part === 'clinic' && hasNumber)) continue;
    }
    if (part.length === 1 && !/^\d+$/.test(part)) continue;
    kept.push(part);
    if (kept.length >= maxWords) break;
  }

  let result = kept.join('-');
  if (!result) {
    // Fall back to first alphanumeric tokens even if fillers were everything.
    result = parts.filter((p) => /^[a-z0-9]+$/.test(p)).slice(0, maxWords).join('-');
  }
  // Digit-only leftovers → clinic-{n}
  if (/^\d+$/.test(result)) result = `clinic-${result}`;
  if (!result) result = 'clinic';

  // Single brand token → prefer "{brand}-clinic" for readability (nahal → nahal-clinic).
  if (
    !opts.noClinicSuffix &&
    kept.length === 1 &&
    !/^\d+$/.test(kept[0]) &&
    kept[0] !== 'clinic'
  ) {
    result = `${kept[0]}-clinic`;
  }

  return result.slice(0, 80);
}

function englishNameFromClinic(clinic) {
  if (!clinic || typeof clinic !== 'object') return '';
  const id = Number(clinic.id);
  const manual = Number.isInteger(id) ? MANUAL_BY_ID[id] : null;
  return (
    clinic.englishName ||
    clinic.english_name ||
    clinic.brandName ||
    clinic.brand_name ||
    clinic.brandEn ||
    (manual && manual.englishName) ||
    ''
  );
}

function manualSlugFromClinic(clinic) {
  if (!clinic || typeof clinic !== 'object') return '';
  const id = Number(clinic.id);
  const manual = Number.isInteger(id) ? MANUAL_BY_ID[id] : null;
  if (manual && manual.slug) {
    return String(manual.slug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
  const raw = String(clinic.slug || '').trim().toLowerCase();
  if (!raw) return '';
  if (/^[a-z0-9]+(?:-[a-z0-9]+){0,3}$/.test(raw) && raw.split('-').length <= MAX_SLUG_WORDS) {
    return raw;
  }
  return '';
}

function specialtyFromClinic(clinic) {
  if (!clinic || typeof clinic !== 'object') return '';
  const direct = clinic.medicalSpecialty || clinic.specialty || '';
  if (direct) return String(direct);
  const services = clinic.services;
  if (Array.isArray(services) && services[0]) {
    const first = services[0];
    if (typeof first === 'string') return first;
    return first.name || first.label || first.serviceName || '';
  }
  return '';
}

/** @deprecated kept for callers — specialty is no longer baked into slugs */
function slugifyClinicParts(name, specialty) {
  return sanitizeSlug([name, specialty].filter(Boolean).join(' '));
}

function uniqueSlug(base, id, used) {
  let candidate = base;
  if (!used.has(candidate)) return candidate;
  candidate = `${base}-${id}`;
  if (!used.has(candidate)) return candidate;
  let n = 2;
  while (used.has(`${base}-${id}-${n}`)) n += 1;
  return `${base}-${id}-${n}`;
}

/**
 * Build a clean canonical slug for a clinic.
 * Does NOT use specialty in the path (avoids long transliterated URLs).
 */
function buildClinicSlug(clinic, used) {
  const id = Number(clinic && clinic.id);
  const set = used || new Set();

  const manual = manualSlugFromClinic(clinic);
  if (manual) return uniqueSlug(manual, Number.isInteger(id) ? id : 'x', set);

  const english = englishNameFromClinic(clinic);
  if (english) {
    return uniqueSlug(sanitizeSlug(english), Number.isInteger(id) ? id : 'x', set);
  }

  const name =
    (clinic && (clinic.name || clinic.sliderTitle || clinic.brand)) ||
    (Number.isInteger(id) ? `clinic ${id}` : 'clinic');

  // Prefer brand-like short name; for "Shiraz Sample Clinic 12" → sample-clinic-12
  let base = sanitizeSlug(name);
  if (base === 'clinic' && Number.isInteger(id)) base = `clinic-${id}`;
  return uniqueSlug(base, Number.isInteger(id) ? id : 'x', set);
}

function loadJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function loadSlugFile() {
  return loadJsonFile(SLUG_JSON);
}

function loadRedirectFile() {
  return loadJsonFile(REDIRECT_JSON);
}

function remember(id, slug) {
  if (!Number.isInteger(id) || !slug) return;
  const key = String(slug).toLowerCase();
  cache.byId.set(id, slug);
  cache.bySlug.set(key, id);
}

function rememberRedirect(legacySlug, id) {
  if (!legacySlug || !Number.isInteger(id)) return;
  const key = String(legacySlug).trim().toLowerCase();
  if (!key) return;
  cache.redirects.set(key, id);
  // Also allow lookup via bySlug so routers resolve in one hop.
  if (!cache.bySlug.has(key)) cache.bySlug.set(key, id);
}

function hydrateFromObject(map) {
  for (const [key, slug] of Object.entries(map || {})) {
    const id = Number(key);
    if (Number.isInteger(id) && slug) remember(id, String(slug));
  }
}

function hydrateRedirects(map) {
  for (const [legacy, target] of Object.entries(map || {})) {
    if (!legacy) continue;
    if (typeof target === 'number' || /^\d+$/.test(String(target))) {
      rememberRedirect(legacy, Number(target));
      continue;
    }
    // legacy → newSlug: resolve after byId is filled
    const newSlug = String(target).toLowerCase();
    const id = cache.bySlug.get(newSlug);
    if (Number.isInteger(id)) rememberRedirect(legacy, id);
  }
}

function ensureCache() {
  if (cache.loaded) return cache;
  hydrateFromObject(loadSlugFile());
  hydrateRedirects(loadRedirectFile());
  // Manual overrides always win as the canonical clean slug.
  for (const [idStr, meta] of Object.entries(MANUAL_BY_ID)) {
    const id = Number(idStr);
    if (Number.isInteger(id) && meta.slug) remember(id, String(meta.slug).toLowerCase());
  }
  cache.loaded = true;
  return cache;
}

function registerClinics(clinics) {
  ensureCache();
  const used = new Set([...cache.byId.values()].map((s) => String(s).toLowerCase()));
  for (const clinic of clinics || []) {
    const id = Number(clinic && clinic.id);
    if (!Number.isInteger(id)) continue;

    const manual = MANUAL_BY_ID[id];
    if (manual && manual.slug) {
      const clean = String(manual.slug).toLowerCase();
      remember(id, clean);
      used.add(clean);
      continue;
    }

    if (clinic.slug && /^[a-z0-9]+(?:-[a-z0-9]+){0,3}$/i.test(clinic.slug)) {
      const clean = String(clinic.slug).toLowerCase();
      remember(id, clean);
      used.add(clean);
      continue;
    }
    if (cache.byId.has(id)) continue;
    const slug = buildClinicSlug(clinic, used);
    used.add(slug);
    remember(id, slug);
  }
  return cache;
}

function slugForClinic(clinicOrId) {
  ensureCache();
  if (clinicOrId && typeof clinicOrId === 'object') {
    const id = Number(clinicOrId.id != null ? clinicOrId.id : clinicOrId.clinic_id);
    if (Number.isInteger(id) && MANUAL_BY_ID[id] && MANUAL_BY_ID[id].slug) {
      return String(MANUAL_BY_ID[id].slug).toLowerCase();
    }
    const manual = manualSlugFromClinic(clinicOrId);
    if (manual) return manual;
    if (clinicOrId.slug && /^[a-z0-9]+(?:-[a-z0-9]+){0,3}$/i.test(clinicOrId.slug)) {
      return String(clinicOrId.slug).toLowerCase();
    }
    if (cache.byId.has(id)) return cache.byId.get(id);
    if (Number.isInteger(id)) return buildClinicSlug({ ...clinicOrId, id }, new Set(cache.bySlug.keys()));
    return null;
  }
  const id = Number(clinicOrId);
  if (Number.isInteger(id) && MANUAL_BY_ID[id] && MANUAL_BY_ID[id].slug) {
    return String(MANUAL_BY_ID[id].slug).toLowerCase();
  }
  if (cache.byId.has(id)) return cache.byId.get(id);
  if (Number.isInteger(id) && id > 0) return `clinic-${id}`;
  return null;
}

/**
 * Canonical absolute path for a clinic profile: /doctor/{clean-slug}
 * Never returns legacy/transliterated forms.
 */
function canonicalDoctorPath(clinicOrId) {
  const slug = slugForClinic(clinicOrId);
  if (!slug) return '/';
  // Clean ASCII slugs need no encoding; keep path stable for Location headers.
  return `/doctor/${slug}`;
}

function clinicProfilePath(clinicOrId) {
  return canonicalDoctorPath(clinicOrId);
}

/**
 * True when `requestedSlug` is already the canonical clean slug (case-insensitive).
 */
function isCanonicalSlug(clinicOrId, requestedSlug) {
  const canonical = slugForClinic(clinicOrId);
  const key = String(requestedSlug || '')
    .trim()
    .toLowerCase();
  return Boolean(canonical && key && canonical === key);
}

function isCleanCanonicalSlug(slug) {
  const key = String(slug || '')
    .trim()
    .toLowerCase();
  if (!key) return false;
  // Short English brand slugs only (≤4 tokens). Reject long transliterations.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+){0,3}$/.test(key)) return false;
  ensureCache();
  // Legacy redirect keys that are not the current canonical slug for that id.
  if (cache.redirects.has(key)) {
    const id = cache.redirects.get(key);
    const canonical = cache.byId.get(id);
    if (canonical && String(canonical).toLowerCase() !== key) return false;
  }
  return true;
}

/**
 * Absolute canonical profile URL for sitemap / SEO.
 * Returns null when the clinic has no clean slug (never emits profile.html).
 */
function canonicalDoctorUrl(clinicOrId, siteBase) {
  const slug = slugForClinic(clinicOrId);
  if (!isCleanCanonicalSlug(slug)) return null;
  const base = String(siteBase || '')
    .trim()
    .replace(/\/$/, '');
  const path = `/doctor/${slug}`;
  return base ? base + path : path;
}

function idFromSlug(slug) {
  ensureCache();
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return null;
  if (cache.bySlug.has(key)) return cache.bySlug.get(key);
  if (cache.redirects.has(key)) return cache.redirects.get(key);
  const fallback = key.match(/^clinic-(\d+)$/);
  if (fallback) return Number(fallback[1]);
  // Only treat trailing -{id} as id when the slug looks like a collision suffix.
  const trailing = key.match(/^(?:[a-z0-9]+-)+(\d+)$/);
  if (trailing) return Number(trailing[1]);
  return null;
}

/**
 * Write canonical slug map + legacy redirect map.
 * @param {Map|object} byIdMap id → newSlug
 * @param {object} [redirectMap] legacySlug → id|newSlug
 */
function writeSlugArtifacts(byIdMap, redirectMap) {
  const dir = path.dirname(SLUG_JSON);
  fs.mkdirSync(dir, { recursive: true });

  const json = {};
  const entries =
    byIdMap instanceof Map ? byIdMap.entries() : Object.entries(byIdMap || {});
  for (const [id, slug] of entries) json[String(id)] = slug;

  fs.writeFileSync(SLUG_JSON, JSON.stringify(json, null, 2) + '\n', 'utf8');

  const redirects = { ...(redirectMap || {}) };
  fs.writeFileSync(REDIRECT_JSON, JSON.stringify(redirects, null, 2) + '\n', 'utf8');

  const jsPath = path.join(ROOT, 'assets', 'js', 'clinic-slugs.js');
  fs.mkdirSync(path.dirname(jsPath), { recursive: true });
  fs.writeFileSync(
    jsPath,
    `window.CLINIC_SLUGS = ${JSON.stringify(json)};\n` +
      `window.CLINIC_SLUG_REDIRECTS = ${JSON.stringify(redirects)};\n`,
    'utf8'
  );

  cache = { byId: new Map(), bySlug: new Map(), redirects: new Map(), loaded: false };
  hydrateFromObject(json);
  hydrateRedirects(redirects);
  cache.loaded = true;
  return { slugs: json, redirects };
}

/**
 * Build redirect map: every previous slug for an id that differs from the new one.
 */
function buildRedirectMap(oldById, newById) {
  const redirects = {};
  const old = oldById instanceof Map ? Object.fromEntries(oldById) : oldById || {};
  const neu = newById instanceof Map ? Object.fromEntries(newById) : newById || {};

  for (const [idStr, oldSlug] of Object.entries(old)) {
    const next = neu[idStr];
    if (!oldSlug || !next) continue;
    if (String(oldSlug).toLowerCase() === String(next).toLowerCase()) continue;
    redirects[String(oldSlug).toLowerCase()] = Number(idStr);
  }

  // Always keep clinic-{id} as soft alias (handled in idFromSlug too).
  for (const idStr of Object.keys(neu)) {
    redirects[`clinic-${idStr}`] = Number(idStr);
  }

  // Merge previously recorded redirects so multi-generation history survives.
  const prior = loadRedirectFile();
  for (const [legacy, target] of Object.entries(prior)) {
    if (redirects[legacy] != null) continue;
    if (typeof target === 'number' || /^\d+$/.test(String(target))) {
      redirects[legacy] = Number(target);
    } else if (neu[String(target)] || Object.values(neu).includes(target)) {
      // old→newSlug where newSlug may itself have changed again
      const id =
        Object.keys(neu).find((k) => neu[k] === target) ||
        Object.keys(old).find((k) => old[k] === target);
      if (id) redirects[legacy] = Number(id);
    }
  }

  return redirects;
}

module.exports = {
  SLUG_JSON,
  REDIRECT_JSON,
  MAX_SLUG_WORDS,
  MANUAL_BY_ID,
  FA_BRAND_MAP,
  transliterateFa,
  sanitizeSlug,
  englishNameFromClinic,
  specialtyFromClinic,
  slugifyClinicParts,
  buildClinicSlug,
  registerClinics,
  slugForClinic,
  canonicalDoctorPath,
  clinicProfilePath,
  isCanonicalSlug,
  isCleanCanonicalSlug,
  canonicalDoctorUrl,
  idFromSlug,
  writeSlugArtifacts,
  buildRedirectMap,
  loadSlugFile,
  loadRedirectFile,
  ensureCache,
};
