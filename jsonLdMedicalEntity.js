'use strict';

/**
 * Build schema.org JSON-LD for Physician or MedicalClinic entities.
 *
 * Pure helper — no DB or HTTP dependencies. Used by seoInfra, server.js,
 * and commercial landing routes.
 *
 * @example
 * const schema = buildMedicalEntityJsonLd({
 *   entityType: 'MedicalClinic',
 *   name: 'کلینیک نهال',
 *   medicalSpecialty: 'Dermatology',
 *   address: { street: 'بلوار معالی‌آباد', city: 'شیراز' },
 *   telephone: '+989121234567',
 *   latitude: 29.5918,
 *   longitude: 52.5837,
 *   ratingValue: 4.8,
 *   reviewCount: 124,
 *   url: 'https://salam-doctor.com/doctor/klinik-nahal',
 * });
 */

const ALLOWED_TYPES = new Set(['MedicalClinic', 'Physician']);

function toFiniteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function trimOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function clampRating(value, min = 1, max = 5) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {object} params
 * @param {'MedicalClinic'|'Physician'} [params.entityType='MedicalClinic']
 * @param {string} params.name
 * @param {string} [params.medicalSpecialty]
 * @param {{ street?: string, city?: string, region?: string, country?: string }} [params.address]
 * @param {string} [params.telephone]
 * @param {number|string} [params.latitude]
 * @param {number|string} [params.longitude]
 * @param {number|string} [params.ratingValue]
 * @param {number|string} [params.reviewCount]
 * @param {string} [params.url]
 * @param {string} [params.image]
 * @param {string} [params.description]
 * @param {number} [params.bestRating=5]
 * @param {number} [params.worstRating=1]
 * @returns {Record<string, unknown>|null}
 */
function buildMedicalEntityJsonLd(params = {}) {
  const name = trimOrNull(params.name);
  if (!name) return null;

  const entityType = ALLOWED_TYPES.has(params.entityType)
    ? params.entityType
    : 'MedicalClinic';

  const schema = {
    '@context': 'https://schema.org',
    '@type': entityType,
    name,
  };

  const specialty = trimOrNull(params.medicalSpecialty);
  if (specialty) schema.medicalSpecialty = specialty;

  const addressInput = params.address && typeof params.address === 'object' ? params.address : {};
  const street = trimOrNull(addressInput.street);
  const city = trimOrNull(addressInput.city);
  const region = trimOrNull(addressInput.region);
  const country = trimOrNull(addressInput.country) || 'IR';

  if (street || city || region || country) {
    const postal = { '@type': 'PostalAddress' };
    if (street) postal.streetAddress = street;
    if (city) postal.addressLocality = city;
    if (region) postal.addressRegion = region;
    if (country) postal.addressCountry = country;
    schema.address = postal;
  }

  const telephone = trimOrNull(params.telephone);
  if (telephone) schema.telephone = telephone;

  const latitude = toFiniteNumber(params.latitude);
  const longitude = toFiniteNumber(params.longitude);
  if (latitude != null && longitude != null) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude,
      longitude,
    };
  }

  const url = trimOrNull(params.url);
  if (url) schema.url = url;

  const image = trimOrNull(params.image);
  if (image) schema.image = image;

  const description = trimOrNull(params.description);
  if (description) schema.description = description;

  const ratingValue = toFiniteNumber(params.ratingValue);
  const reviewCount = toFiniteNumber(params.reviewCount);
  const bestRating = toFiniteNumber(params.bestRating) ?? 5;
  const worstRating = toFiniteNumber(params.worstRating) ?? 1;

  if (ratingValue != null && reviewCount != null && reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: clampRating(ratingValue, worstRating, bestRating),
      reviewCount: Math.round(reviewCount),
      bestRating,
      worstRating,
    };
  }

  return schema;
}

module.exports = {
  buildMedicalEntityJsonLd,
  ALLOWED_ENTITY_TYPES: ALLOWED_TYPES,
};
