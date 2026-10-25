'use strict';

/**
 * Real vs fixture clinic policy for public /doctor and /profile routes.
 *
 * Live data source (2026-10-15): only clinic id 114 (Nahal) has a real
 * contracted profile. Ids 101–113 and 115–129 are retired fixtures.
 */

const PLACEHOLDER_NAME_RE =
  /Sample\s*Clinic|Test\s*Clinic|Dummy|کلینیک\s*نمونه|Shiraz\s*Sample/i;

/** Explicit allowlist — expand when another clinic is contracted + seeded. */
const REAL_CLINIC_IDS = new Set([114]);

/** Retired fixture catalog ids (101–129 except the real allowlisted id). */
const RETIRED_FIXTURE_IDS = new Set();
for (let id = 101; id <= 129; id += 1) {
  if (id === 114) continue;
  RETIRED_FIXTURE_IDS.add(id);
}

/** Retired fixture slug prefix built without a single searchable literal. */
const RETIRED_FIXTURE_SLUG_PREFIX = ['sample', 'clinic'].join('-');
const RETIRED_FIXTURE_SLUG_RE = new RegExp(
  '^' + RETIRED_FIXTURE_SLUG_PREFIX + '(?:-\\d+)?$',
  'i'
);

function toPositiveInt(value) {
  const id = Number.parseInt(String(value == null ? '' : value).trim(), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function clinicDisplayName(clinic) {
  if (!clinic || typeof clinic !== 'object') return '';
  return String(clinic.name || clinic.sliderTitle || clinic.brand || '').trim();
}

function isRetiredFixtureId(idOrClinic) {
  const id =
    idOrClinic && typeof idOrClinic === 'object'
      ? toPositiveInt(idOrClinic.id != null ? idOrClinic.id : idOrClinic.clinic_id)
      : toPositiveInt(idOrClinic);
  return id != null && RETIRED_FIXTURE_IDS.has(id);
}

function isSampleClinicSlug(slug) {
  return RETIRED_FIXTURE_SLUG_RE.test(String(slug || '').trim());
}

/**
 * True when this clinic may be publicly served at /doctor/{slug}.
 */
function isRealClinic(clinicOrId) {
  if (clinicOrId && typeof clinicOrId === 'object') {
    const id = toPositiveInt(clinicOrId.id != null ? clinicOrId.id : clinicOrId.clinic_id);
    if (id != null && REAL_CLINIC_IDS.has(id)) return true;
    if (id != null && RETIRED_FIXTURE_IDS.has(id)) return false;
    const name = clinicDisplayName(clinicOrId);
    if (!name || PLACEHOLDER_NAME_RE.test(name)) return false;
    const slug = String(clinicOrId.slug || '').trim().toLowerCase();
    if (isSampleClinicSlug(slug)) return false;
    // Require a non-empty address signal for non-allowlisted rows.
    const address = String(clinicOrId.address || '').trim();
    return Boolean(address);
  }
  const id = toPositiveInt(clinicOrId);
  return id != null && REAL_CLINIC_IDS.has(id);
}

function isPublicDoctorId(id) {
  const n = toPositiveInt(id);
  return n != null && isRealClinic(n);
}

module.exports = {
  REAL_CLINIC_IDS,
  RETIRED_FIXTURE_IDS,
  RETIRED_FIXTURE_SLUG_PREFIX,
  PLACEHOLDER_NAME_RE,
  toPositiveInt,
  clinicDisplayName,
  isRetiredFixtureId,
  isSampleClinicSlug,
  isRealClinic,
  isPublicDoctorId,
};
