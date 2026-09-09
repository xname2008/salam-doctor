'use strict';

/**
 * City registry for multi-city local SEO hubs: /{city_slug}/{service_slug}
 * Keep in sync with python/local_seo/registry.py when adding cities.
 */

const CITIES = Object.freeze({
  shiraz: {
    slug: 'shiraz',
    nameFa: 'شیراز',
    nameEn: 'Shiraz',
    regionFa: 'فارس',
    latitude: 29.5918,
    longitude: 52.5837,
    country: 'IR',
  },
  tehran: {
    slug: 'tehran',
    nameFa: 'تهران',
    nameEn: 'Tehran',
    regionFa: 'تهران',
    latitude: 35.6892,
    longitude: 51.389,
    country: 'IR',
  },
  isfahan: {
    slug: 'isfahan',
    nameFa: 'اصفهان',
    nameEn: 'Isfahan',
    regionFa: 'اصفهان',
    latitude: 32.6539,
    longitude: 51.666,
    country: 'IR',
  },
  mashhad: {
    slug: 'mashhad',
    nameFa: 'مشهد',
    nameEn: 'Mashhad',
    regionFa: 'خراسان رضوی',
    latitude: 36.2605,
    longitude: 59.6168,
    country: 'IR',
  },
  tabriz: {
    slug: 'tabriz',
    nameFa: 'تبریز',
    nameEn: 'Tabriz',
    regionFa: 'آذربایجان شرقی',
    latitude: 38.08,
    longitude: 46.2919,
    country: 'IR',
  },
});

/** First path segments that must never match /:city/:service */
const RESERVED_PREFIXES = new Set([
  'api',
  'assets',
  'images',
  'clinics',
  'uploads',
  'blog',
  'services',
  'article',
  'socket.io',
  'backups',
  'public',
  'admin',
  'doctor',
  'sitemap',
  'html-sitemap',
  'category.html',
  'profile.html',
  'profiles.html',
]);

function getCity(slug) {
  if (!slug) return null;
  return CITIES[String(slug).trim().toLowerCase()] || null;
}

function isKnownCitySlug(slug) {
  return Boolean(getCity(slug));
}

function isReservedHubPrefix(segment) {
  return RESERVED_PREFIXES.has(String(segment || '').toLowerCase());
}

function localHubPath(citySlug, serviceSlug) {
  return `/${String(citySlug).toLowerCase()}/${String(serviceSlug).toLowerCase()}`;
}

function parseLocalHubPath(pathname) {
  const raw = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  const m = raw.match(/^\/([^/]+)\/([^/]+)$/);
  if (!m) return null;
  const citySlug = m[1].toLowerCase();
  const serviceSlug = m[2].toLowerCase();
  if (isReservedHubPrefix(citySlug)) return null;
  if (!isKnownCitySlug(citySlug)) return null;
  if (/\.[a-z0-9]+$/i.test(serviceSlug)) return null;
  return { citySlug, serviceSlug, city: getCity(citySlug) };
}

function isLocalHubPath(pathname) {
  return Boolean(parseLocalHubPath(pathname));
}

module.exports = {
  CITIES,
  RESERVED_PREFIXES,
  getCity,
  isKnownCitySlug,
  isReservedHubPrefix,
  localHubPath,
  parseLocalHubPath,
  isLocalHubPath,
};
