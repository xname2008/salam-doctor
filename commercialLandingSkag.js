'use strict';

/**
 * SKAG (Single Keyword Ad Group) copy resolution from UTM / query params.
 * Port of python/clinic_landing/utm_skag.py for Node.js commercial landings.
 */

const DEFAULT_SKAG_PRESETS = Object.freeze({
  candela: {
    h1: 'لیزر کندلا تیتانیوم در {city} — {clinic}',
    cta_primary: 'رزرو فوری لیزر کندلا',
    cta_secondary: 'مشاوره رایگان کندلا',
  },
  'candela-laser': {
    h1: 'لیزر کندلا تیتانیوم در {city} — {clinic}',
    cta_primary: 'رزرو فوری لیزر کندلا',
    cta_secondary: 'مشاوره رایگان کندلا',
  },
  'hair-transplant': {
    h1: 'کاشت مو {technique} در {city} — {clinic}',
    cta_primary: 'رزرو مشاوره کاشت مو',
    cta_secondary: 'برآورد هزینه کاشت مو',
  },
  botox: {
    h1: 'تزریق بوتاکس تخصصی در {city} — {clinic}',
    cta_primary: 'رزرو نوبت بوتاکس',
    cta_secondary: 'مشاهده تعرفه بوتاکس',
  },
  fotona: {
    h1: 'لیزر فوتونا در {city} — {clinic}',
    cta_primary: 'رزرو لیزر فوتونا',
    cta_secondary: 'مشاوره قبل از درمان',
  },
  hifu: {
    h1: 'هایفوتراپی دابلو گلد در {city} — {clinic}',
    cta_primary: 'رزرو جلسه هایفو',
    cta_secondary: 'مقایسه پکیج‌ها',
  },
});

const UTM_KEYS = Object.freeze([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
]);

const SKAG_PARAM_KEYS = Object.freeze([
  'skag',
  'utm_term',
  'keyword',
  'device',
  'service',
  'utm_content',
  'utm_campaign',
]);

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function firstParam(params, keys) {
  for (const key of keys) {
    const raw = params[key];
    if (raw == null) continue;
    const text = decodeURIComponent(String(Array.isArray(raw) ? raw[0] : raw)).trim();
    if (text) return text;
  }
  return null;
}

function formatTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] || '');
}

/**
 * Extract standard UTM + SKAG params from Express req.query or plain object.
 */
function parseUtmFromRequest(query) {
  const params = query && typeof query === 'object' ? query : {};
  const utm = {};
  for (const key of UTM_KEYS) {
    const val = firstParam(params, [key]);
    if (val) utm[key] = val;
  }
  const skagKeyword = firstParam(params, SKAG_PARAM_KEYS);
  return {
    utm,
    skagKeyword,
    raw: params,
  };
}

/**
 * Resolve H1 + CTA labels for a landing visit.
 */
function resolveSkagCopy(params, opts = {}) {
  const presets = opts.presets || DEFAULT_SKAG_PRESETS;
  const clinicName = String(opts.clinicName || 'کلینیک').trim();
  const city = String(opts.city || 'شیراز').trim();
  const defaultH1 = opts.defaultH1 || `کلینیک ${clinicName} — ${city}`;
  const defaultCtaPrimary = opts.defaultCtaPrimary || 'رزرو فوری نوبت';
  const defaultCtaSecondary = opts.defaultCtaSecondary || 'مشاوره رایگان';

  const keyword = firstParam(params, SKAG_PARAM_KEYS);
  let presetKey = keyword ? slugify(keyword) : null;
  let preset = presetKey ? presets[presetKey] : null;

  if (!preset && presetKey) {
    for (const [k, v] of Object.entries(presets)) {
      if (presetKey.includes(k) || k.includes(presetKey)) {
        preset = v;
        presetKey = k;
        break;
      }
    }
  }

  const fmt = {
    clinic: clinicName,
    city,
    keyword: keyword || clinicName,
    technique: firstParam(params, ['technique']) || 'FIT',
    device: firstParam(params, ['device']) || keyword || '',
  };

  let h1;
  let ctaPrimary;
  let ctaSecondary;

  if (preset) {
    h1 = formatTemplate(preset.h1, fmt);
    ctaPrimary = formatTemplate(preset.cta_primary, fmt);
    ctaSecondary = formatTemplate(preset.cta_secondary, fmt);
  } else if (keyword) {
    h1 = `${keyword} در ${city} — ${clinicName}`;
    ctaPrimary = `رزرو فوری ${keyword}`;
    ctaSecondary = defaultCtaSecondary;
  } else {
    h1 = defaultH1;
    ctaPrimary = defaultCtaPrimary;
    ctaSecondary = defaultCtaSecondary;
  }

  return {
    keyword,
    presetKey,
    h1,
    ctaPrimary,
    ctaSecondary,
    technique: fmt.technique,
    device: fmt.device || null,
    utm: parseUtmFromRequest(params).utm,
  };
}

module.exports = {
  DEFAULT_SKAG_PRESETS,
  UTM_KEYS,
  SKAG_PARAM_KEYS,
  slugify,
  parseUtmFromRequest,
  resolveSkagCopy,
  formatTemplate,
};
