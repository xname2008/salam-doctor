'use strict';

/**
 * Hub clinic sanitizer — drop English placeholder fixtures and dead /doctor/*
 * profile cards before SERP counts, cards, or JSON-LD see them.
 */

const PLACEHOLDER_NAME_RE = /Sample\s*Clinic|Test\s*Clinic|Dummy|کلینیک\s*نمونه/i;
const DEAD_DOCTOR_PATH_RE =
  /(?:^|https?:\/\/[^/]+)?\/doctor\/(?:\d+|sample-clinic(?:-\d+)?)\/?$/i;
const LEGACY_PROFILE_QUERY_RE = /profile\.html\?(?:[^#]*&)?(?:id|clinic_id)=\d+/i;

const DEFAULT_CLINIC_IMAGE = '/assets/images/defaults/clinic-default.webp';

function isPlaceholderClinicName(name) {
  return PLACEHOLDER_NAME_RE.test(String(name || ''));
}

function normalizeProfilePath(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      return u.pathname || '';
    }
  } catch (_err) {
    /* keep raw */
  }
  return raw.split('?')[0].split('#')[0];
}

/**
 * True when the profile URL is a known-dead stub (numeric /doctor/N,
 * sample-clinic-*, or legacy profile.html?id=).
 */
function isDeadDoctorProfileUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return true;
  if (LEGACY_PROFILE_QUERY_RE.test(raw)) return true;
  const path = normalizeProfilePath(raw);
  if (DEAD_DOCTOR_PATH_RE.test(path)) return true;
  // Bare numeric id used as path segment without /doctor/ prefix
  if (/^\/?\d+\/?$/.test(path)) return true;
  return false;
}

/**
 * @param {object} clinic shaped hub / catalog clinic
 * @returns {boolean}
 */
function isHubListableClinic(clinic) {
  if (!clinic || typeof clinic !== 'object') return false;
  if (isPlaceholderClinicName(clinic.name || clinic.sliderTitle)) return false;
  const profileUrl =
    clinic.profileUrl || clinic.link || clinic.url || clinic.href || '';
  if (profileUrl && isDeadDoctorProfileUrl(profileUrl)) return false;
  // Catalog rows often omit link; numeric-only ids map to dead /doctor/{id}
  if (!profileUrl && clinic.id != null && /^\d+$/.test(String(clinic.id))) {
    // Allow only when a clean non-sample slug is already present
    const slug = String(clinic.slug || '').trim().toLowerCase();
    if (!slug || slug.startsWith('sample-clinic') || /^\d+$/.test(slug)) {
      return false;
    }
  }
  return true;
}

/**
 * Public web path for a clinic media asset (leading slash; keep absolute URLs).
 * @param {string} raw
 * @returns {string}
 */
function publicClinicAssetPath(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s;
  return `/${s.replace(/^\/+/, '')}`;
}

/**
 * Resolve hero/cover/image for hub cards and featured banners.
 * Prefers explicit catalog fields, then /clinics/{id}/Hero.webp, then default.
 * @param {object} clinic
 * @returns {{ heroImage: string, coverImage: string, image: string }}
 */
function resolveClinicCardImages(clinic) {
  const id = clinic && clinic.id != null ? Number(clinic.id) : NaN;
  const explicit = publicClinicAssetPath(
    (clinic && (clinic.heroImage || clinic.coverImage || clinic.image)) || ''
  );
  // Skip low-signal sample placeholders so filesystem hero can win for real clinics.
  const usableExplicit =
    explicit && !/sample-clinic-services|clinic-placeholder/i.test(explicit)
      ? explicit
      : '';
  const byIdHero =
    Number.isInteger(id) && id > 0 ? `/clinics/${id}/Hero.webp` : '';
  const image = usableExplicit || byIdHero || DEFAULT_CLINIC_IMAGE;
  return {
    heroImage: image,
    coverImage: image,
    image,
  };
}

/**
 * @param {object} clinic
 * @returns {object}
 */
function withClinicCardImages(clinic) {
  if (!clinic || typeof clinic !== 'object') return clinic;
  return Object.assign({}, clinic, resolveClinicCardImages(clinic));
}

/**
 * @param {object[]} clinics
 * @returns {object[]}
 */
function sanitizeHubClinicList(clinics) {
  if (!Array.isArray(clinics) || !clinics.length) return [];
  return clinics.filter(isHubListableClinic).map(withClinicCardImages);
}

/**
 * Filter primary + related clinics and recompute thin-inventory stats.
 * Mutates and returns the same page payload object.
 * @param {object} data
 * @returns {object}
 */
function sanitizeHubPageData(data) {
  if (!data || typeof data !== 'object') return data;

  const clinics = sanitizeHubClinicList(data.clinics);
  const relatedClinics = sanitizeHubClinicList(data.relatedClinics);

  data.clinics = clinics;
  data.relatedClinics = relatedClinics;

  const active = clinics.filter((c) => c && c.isActive !== false).length;
  const withAuth = clinics.filter((c) => c && c.hasAuthenticBadge).length;
  const ratings = clinics
    .map((c) => (c && c.rating && Number(c.rating.value)) || 0)
    .filter((n) => n > 0);
  const reviewCount = clinics.reduce(
    (sum, c) => sum + ((c && c.rating && Number(c.rating.count)) || 0),
    0
  );
  const ratingValue = ratings.length
    ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
    : 4.8;

  data.stats = {
    ...(data.stats || {}),
    total: clinics.length,
    active: active > 0 ? active : clinics.length,
    withAuthenticDevice: withAuth,
    ratingValue,
    reviewCount: reviewCount || clinics.length,
  };

  return data;
}

module.exports = {
  PLACEHOLDER_NAME_RE,
  DEFAULT_CLINIC_IMAGE,
  isPlaceholderClinicName,
  isDeadDoctorProfileUrl,
  isHubListableClinic,
  publicClinicAssetPath,
  resolveClinicCardImages,
  withClinicCardImages,
  sanitizeHubClinicList,
  sanitizeHubPageData,
};
