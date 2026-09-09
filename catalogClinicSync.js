'use strict';

/**
 * Sync clinics from the static catalog (data.js / data.min.js) into PostgreSQL
 * so city/service hub pages list real ACTIVE clinics.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildClinicSlug } = require('./clinicSlug');

const ROOT = path.join(__dirname);

/** Map catalog service slugs → hub taxonomy slugs (HUB_SLUGS). */
const CATALOG_TO_HUB = Object.freeze({
  'hair-transplant-fit': ['hair-transplant', 'micro-fit-hair-transplant', 'hair-transplant-installment'],
  'eyebrow-beard-transplant': ['eyebrow-transplant'],
  'fotona-laser': ['laser-hair-removal', 'skin-rejuvenation'],
  'q-switch-laser': ['laser-hair-removal', 'co2-fractional-laser'],
  'co2-laser': ['co2-fractional-laser', 'laser-hair-removal'],
  'rf-virtue-endolift': ['skin-rejuvenation'],
  'hifu-doublo-gold': ['hifu-doublo-gold'],
  'botox-filler': ['botox', 'fillers'],
  'candela-laser': ['laser-candela-2026', 'laser-hair-removal', 'mens-laser-shiraz'],
  'deka-laser': ['laser-hair-removal', 'mens-laser-shiraz'],
  'light-therapy': ['light-therapy'],
});

function loadClinicsData() {
  try {
    const file = path.join(ROOT, 'data.min.js');
    const code = fs.readFileSync(file, 'utf8');
    const sandbox = { clinicsData: [] };
    vm.runInNewContext(code.replace(/^const clinicsData/, 'clinicsData'), sandbox);
    return Array.isArray(sandbox.clinicsData) ? sandbox.clinicsData : [];
  } catch (err) {
    console.warn('[catalog-sync] loadClinicsData:', err && err.message);
    return [];
  }
}

function catalogClinicById(clinicId) {
  const id = Number.parseInt(String(clinicId), 10);
  if (!Number.isInteger(id) || id < 1) return null;
  return loadClinicsData().find((c) => c && c.id === id) || null;
}

function normalizeCatalogServices(catalog) {
  const raw = catalog && Array.isArray(catalog.services) ? catalog.services : [];
  const slugs = new Set();
  for (const item of raw) {
    if (!item) continue;
    const slug =
      typeof item === 'string'
        ? item
        : String(item.slug || item.service_slug || '').trim().toLowerCase();
    if (!slug) continue;
    const hubs = CATALOG_TO_HUB[slug] || [];
    if (hubs.length) hubs.forEach((h) => slugs.add(h));
    else slugs.add(slug);
  }
  return [...slugs];
}

function pickPhone(catalog, profile) {
  const contact = (catalog && catalog.contact_info) || {};
  const profileContact =
    profile && profile.contact_info
      ? typeof profile.contact_info === 'string'
        ? JSON.parse(profile.contact_info)
        : profile.contact_info
      : {};
  return (
    profile && profile.dept1_phone ||
    profileContact.phone ||
    contact.phone ||
    '00000000000'
  );
}

function pickAddress(catalog, profile) {
  return (
    (profile && profile.address) ||
    (profile && profile.contact_info && typeof profile.contact_info === 'object' && profile.contact_info.address) ||
    catalog.address ||
    'شیراز'
  );
}

/**
 * Upsert a catalog clinic into Postgres and wire hub service links.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {number} clinicId
 * @param {object} [opts]
 * @param {object} [opts.profile] SQLite clinic_profiles row
 * @param {'ACTIVE'|'EXPIRED'} [opts.contractStatus]
 */
async function syncCatalogClinicToPostgres(prisma, clinicId, opts = {}) {
  const id = Number.parseInt(String(clinicId), 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('Invalid clinic id');
  }

  const catalog = catalogClinicById(id);
  if (!catalog) {
    throw new Error(`Catalog clinic not found: ${id}`);
  }

  const profile = opts.profile || null;
  const name =
    catalog.name ||
    catalog.sliderTitle ||
    `مرکز ${id}`;
  const phone = String(pickPhone(catalog, profile)).slice(0, 40);
  const fullAddress = String(pickAddress(catalog, profile)).slice(0, 2000);
  const lat = profile && profile.latitude != null ? profile.latitude : catalog.latitude;
  const lng = profile && profile.longitude != null ? profile.longitude : catalog.longitude;
  const englishName =
    (catalog.englishName || catalog.sliderTitle || name).replace(/^کلینیک\s+/i, '').trim() || name;
  const slug = buildClinicSlug({ id, name, englishName });
  const licenseNumber = `CATALOG-${id}`;
  const contractStatus = opts.contractStatus === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE';

  const district = await prisma.district.findFirst({
    where: { slug: 'sattarkhan' },
  });

  const existing = await prisma.clinic.findUnique({ where: { id } });
  const data = {
    name,
    licenseNumber,
    phone,
    fullAddress,
    biography: null,
    latitude: lat != null ? lat : null,
    longitude: lng != null ? lng : null,
    contractStatus,
    slug,
    englishName: englishName.slice(0, 120),
    districtId: district ? district.id : null,
    dept1Title: profile && profile.dept1_title || null,
    dept1Phone: profile && profile.dept1_phone || null,
    dept1Whatsapp: profile && profile.dept1_whatsapp || null,
    dept2Title: profile && profile.dept2_title || null,
    dept2Phone: profile && profile.dept2_phone || null,
    dept2Whatsapp: profile && profile.dept2_whatsapp || null,
  };

  let clinic;
  if (existing) {
    clinic = await prisma.clinic.update({
      where: { id },
      data: {
        ...data,
        licenseNumber: existing.licenseNumber || licenseNumber,
      },
    });
  } else {
    clinic = await prisma.clinic.create({
      data: { id, ...data },
    });
  }

  const hubSlugs = normalizeCatalogServices(catalog);
  const services = hubSlugs.length
    ? await prisma.service.findMany({
        where: { slug: { in: hubSlugs } },
        select: { id: true, slug: true },
      })
    : [];

  if (services.length) {
    await prisma.clinicService.deleteMany({ where: { clinicId: id } });
    await prisma.clinicService.createMany({
      data: services.map((s) => ({ clinicId: id, serviceId: s.id })),
      skipDuplicates: true,
    });
  }

  return { clinic, serviceSlugs: services.map((s) => s.slug) };
}

module.exports = {
  CATALOG_TO_HUB,
  loadClinicsData,
  catalogClinicById,
  normalizeCatalogServices,
  syncCatalogClinicToPostgres,
};
