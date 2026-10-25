'use strict';

// ==========================================================================
// seed-mock-clinics.js — fill THIN / EMPTY directory hub pages with realistic
// mock clinics so Googlebot sees content-rich pages (fixes "Crawled - currently
// not indexed" on /shiraz/<service> pages that only had 0-1 clinics).
//
// What it does (idempotent — safe to re-run):
//   1. Ensures the Shiraz districts exist (معالی‌آباد، عفیف‌آباد، قصرالدشت، زند …).
//   2. Ensures a pool of APPROVED medical devices exists (Candela, Doublo …).
//   3. (default) Ensures a service catalog exists — including the pages you
//      cited (/shiraz/dentistry, /shiraz/botox) — so they can be populated.
//   4. For every LEAF service with fewer than --min real clinics, generates
//      2-3 realistic mock clinics, wires them to the service (+ devices), and
//      spreads them across districts. Parent hubs (e.g. /shiraz/dentistry)
//      inherit richness because the repository aggregates their children.
//
// Idempotency: mock clinics use a deterministic unique license
//   "MOCK-<service-slug>-<n>", so re-runs UPSERT the same rows (no duplicates).
//
// ⚠️ Schema note: ContractStatus is ACTIVE | EXPIRED (there is NO "Pending" for
//   contracts — PENDING only exists on device VerificationStatus). To render a
//   rich premium+normal mix we set most mocks ACTIVE (gold "مرکز ویژه" cards,
//   sorted first) and some EXPIRED (normal cards). Both render full content.
//
// Usage (host):        node prisma/seed-mock-clinics.js [flags]
// Usage (docker):      bash scripts/seed-mock-clinics-docker.sh [flags]
//
// Flags:
//   --dry-run              Print the plan, write nothing.
//   --purge                Delete ALL mock clinics (license "MOCK-*") and exit.
//   --force                Seed even services that already meet the threshold.
//   --min=<n>              "Rich enough" threshold (default 3).
//   --no-ensure-services   Do NOT create the service catalog; only seed
//                          services that already exist in the DB.
//   --help
// ==========================================================================

const { PrismaClient } = require('@prisma/client');
const { buildClinicSlug } = require('../clinicSlug');
const prisma = new PrismaClient();
const usedClinicSlugs = new Set();

const CITY = 'شیراز';
const MOCK_PREFIX = 'MOCK-';

// --------------------------------------------------------------------------
// Reference data
// --------------------------------------------------------------------------

// User-named districts first, then a few more for variety. streets/coords make
// generated addresses land in the right part of the city.
const DISTRICTS = [
  { name: 'معالی‌آباد', slug: 'maaliabad', lat: 29.6335, lng: 52.4760, streets: ['بلوار دوستان', 'خیابان بحرالعلوم', 'بلوار میرزای شیرازی', 'کوچه ۹'] },
  { name: 'عفیف‌آباد', slug: 'afifabad', lat: 29.6262, lng: 52.5107, streets: ['خیابان عفیف‌آباد', 'کوچه باغ عفیف‌آباد', 'خیابان ارم'] },
  { name: 'قصرالدشت', slug: 'qasrodasht', lat: 29.6210, lng: 52.5030, streets: ['بلوار قصرالدشت', 'خیابان وصال', 'کوچه ۱۲'] },
  { name: 'زند', slug: 'zand', lat: 29.6180, lng: 52.5440, streets: ['خیابان زند', 'خیابان رودکی', 'خیابان فردوسی'] },
  { name: 'ستارخان', slug: 'sattarkhan', lat: 29.6400, lng: 52.4930, streets: ['بلوار ستارخان', 'خیابان همت شمالی', 'کوچه ۵'] },
  { name: 'فرهنگ‌شهر', slug: 'farhangshahr', lat: 29.6470, lng: 52.4820, streets: ['بلوار امیرکبیر', 'خیابان گلستان', 'کوچه ۲۲'] },
];

// APPROVED so the repository (which filters verificationStatus=APPROVED) shows
// them; brands recognised for the green "اصل" authenticity badge.
const DEVICES = [
  { brandName: 'Candela', deviceType: 'LASER' },
  { brandName: 'Cynosure', deviceType: 'LASER' },
  { brandName: 'Alma', deviceType: 'LASER' },
  { brandName: 'Fotona', deviceType: 'LASER' },
  { brandName: 'Ultherapy', deviceType: 'HIFU' },
  { brandName: 'Doublo Gold', deviceType: 'HIFU' },
  { brandName: 'Endolift', deviceType: 'ENDOLIFT' },
  { brandName: 'Morpheus8', deviceType: 'OTHER' },
];

// Service catalog (superset of prisma/seed.js) — includes the cited pages
// (dentistry, botox). Idempotent: upserted by slug. basePrice in Toman.
const SERVICE_CATALOG = [
  {
    parent: { serviceName: 'پوست و مو', slug: 'dermatology', basePrice: null },
    children: [
      { serviceName: 'کاشت مو', slug: 'hair-transplant', basePrice: 25000000 },
      { serviceName: 'کاشت ابرو', slug: 'eyebrow-transplant', basePrice: 12000000 },
      { serviceName: 'جوانسازی پوست', slug: 'skin-rejuvenation', basePrice: 4000000 },
    ],
  },
  {
    parent: { serviceName: 'لیزر و جراحی', slug: 'laser-surgery', basePrice: null },
    children: [
      { serviceName: 'لیزر موهای زائد', slug: 'laser-hair-removal', basePrice: 1500000 },
      { serviceName: 'جراحی زیبایی', slug: 'cosmetic-surgery', basePrice: 60000000 },
    ],
  },
  {
    parent: { serviceName: 'تناسب اندام', slug: 'body-contouring', basePrice: null },
    children: [
      { serviceName: 'لاغری و پیکرتراشی', slug: 'slimming', basePrice: 8000000 },
    ],
  },
  {
    parent: { serviceName: 'زیبایی و تزریقات', slug: 'injectables', basePrice: null },
    children: [
      { serviceName: 'بوتاکس', slug: 'botox', basePrice: 3000000 },
      { serviceName: 'فیلر و ژل', slug: 'fillers', basePrice: 5000000 },
      { serviceName: 'مزوتراپی', slug: 'mesotherapy', basePrice: 2500000 },
    ],
  },
  {
    parent: { serviceName: 'دندانپزشکی', slug: 'dentistry', basePrice: null },
    children: [
      { serviceName: 'ایمپلنت دندان', slug: 'dental-implant', basePrice: 35000000 },
      { serviceName: 'ارتودنسی', slug: 'orthodontics', basePrice: 40000000 },
      { serviceName: 'لمینت و کامپوزیت', slug: 'dental-veneer', basePrice: 6000000 },
    ],
  },
];

// --------------------------------------------------------------------------
// Long-tail SEO services (high-converting Shiraz keywords across 4 verticals:
// Hair Transplant, Laser, Skin Laser, HIFU). Nested under existing parents so
// the parent hub pages aggregate their clinics too. Exact titles/descriptions
// /FAQs for these slugs live in seo-config.js (used by seoRouter.buildSeo).
//   preferredDistricts — force mock clinics into these districts (SEO copy
//                        names them); forceDevice — guarantee the device the
//                        keyword promises (with the green authenticity badge).
// --------------------------------------------------------------------------
const LONGTAIL_SERVICES = [
  { slug: 'hair-transplant-installment', serviceName: 'کاشت مو اقساطی', parentSlug: 'hair-transplant', basePrice: 25000000, preferredDistricts: ['maaliabad', 'qasrodasht'] },
  { slug: 'micro-fit-hair-transplant', serviceName: 'کاشت مو Micro FIT', parentSlug: 'hair-transplant', basePrice: 28000000, preferredDistricts: ['maaliabad', 'qasrodasht'] },
  { slug: 'laser-candela-2026', serviceName: 'لیزر کندلا ۲۰۲۶', parentSlug: 'laser-hair-removal', basePrice: 1800000, preferredDistricts: ['maaliabad', 'qasrodasht'], forceDevice: 'Candela' },
  { slug: 'laser-titanium-2026', serviceName: 'لیزر تیتانیوم', parentSlug: 'laser-hair-removal', basePrice: 1800000, preferredDistricts: ['maaliabad', 'qasrodasht'], forceDevice: 'Alma' },
  { slug: 'mens-laser-shiraz', serviceName: 'لیزر موهای زائد آقایان', parentSlug: 'laser-hair-removal', basePrice: 2000000, preferredDistricts: ['maaliabad', 'qasrodasht'] },
  { slug: 'co2-fractional-laser', serviceName: 'لیزر CO2 فرکشنال', parentSlug: 'skin-rejuvenation', basePrice: 3500000, preferredDistricts: ['maaliabad', 'qasrodasht'] },
  { slug: 'hifu-doublo-gold', serviceName: 'هایفو دابلو گلد', parentSlug: 'skin-rejuvenation', basePrice: 8000000, preferredDistricts: ['maaliabad', 'qasrodasht'], forceDevice: 'Doublo Gold' },
  { slug: 'light-therapy', serviceName: 'لایت تراپی', parentSlug: 'skin-rejuvenation', basePrice: 2500000, preferredDistricts: ['maaliabad', 'qasrodasht'] },
];

// Persian brand/proper names for clinic naming.
const CLINIC_NAMES = [
  'نیلوفر', 'ارغوان', 'پارسیان', 'مهرگان', 'آریا', 'رویا', 'الوند', 'زیتون',
  'ماد', 'سپید', 'رخ', 'ترنج', 'دنا', 'آوان', 'رها', 'سلامت', 'پرشین', 'نگین',
];

// Clinic "kind" label by service category (keeps the name topically relevant).
const KIND_BY_CATEGORY = {
  dental: 'کلینیک دندانپزشکی',
  hair: 'کلینیک تخصصی کاشت مو',
  injection: 'کلینیک زیبایی و تزریقات',
  laser: 'کلینیک لیزر و پوست',
  slimming: 'کلینیک لاغری و تناسب اندام',
  skin: 'کلینیک پوست و زیبایی',
  surgery: 'کلینیک جراحی زیبایی',
  beauty: 'کلینیک زیبایی',
};

const BIO_TEMPLATES = [
  (o) => `«${o.name}» با بیش از ${o.years} سال سابقه در زمینه ${o.service}، از مراکز شناخته‌شده ${CITY} در منطقه ${o.district} است و با کادر مجرب و تجهیزات به‌روز خدمات تخصصی ارائه می‌دهد.`,
  (o) => `مرکز تخصصی ${o.service} در ${o.district}، ${CITY}. تیم پزشکی «${o.name}» با ${o.years} سال تجربه، مشاوره تخصصی و خدمات باکیفیت را با نرخ منصفانه ارائه می‌کند.`,
  (o) => `${o.name}، ارائه‌دهنده خدمات ${o.service} در ${CITY} (${o.district}). تمرکز ما بر رضایت مراجعان، رعایت اصول بهداشتی و استفاده از دستگاه‌های اصل و تأییدشده است.`,
  (o) => `«${o.name}» واقع در ${o.district}، ${CITY}، با سابقه ${o.years} ساله در ${o.service}، مشاوره رایگان اولیه و برنامه درمانی اختصاصی برای هر مراجع ارائه می‌دهد.`,
];

// --------------------------------------------------------------------------
// Deterministic PRNG so a given mock clinic gets STABLE generated attributes
// across runs (mulberry32 seeded from its license).
// --------------------------------------------------------------------------
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const intBetween = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

function categoryOf(slug, name) {
  const s = `${slug} ${name}`.toLowerCase();
  if (/dent|دندان|ایمپلنت|ارتودنسی|لمینت/.test(s)) return 'dental';
  if (/hifu|هایفو/.test(s)) return 'skin';
  // laser BEFORE hair: "لیزر موهای زائد" contains مو but is a laser clinic
  if (/laser|لیزر/.test(s)) return 'laser';
  if (/hair|مو|ابرو/.test(s)) return 'hair';
  if (/botox|بوتاکس|filler|فیلر|ژل|meso|مزو|تزریق|inject/.test(s)) return 'injection';
  if (/slim|لاغری|پیکر|body|اندام/.test(s)) return 'slimming';
  if (/skin|پوست|جوانساز|rejuven/.test(s)) return 'skin';
  if (/surg|جراحی/.test(s)) return 'surgery';
  return 'beauty';
}

function makePhone(rng) {
  if (rng() < 0.65) {
    // Shiraz landline: 071-3XXXXXXX (8 local digits starting with 3)
    return '071-3' + String(intBetween(rng, 1000000, 9999999));
  }
  // Iranian mobile
  const prefixes = ['0917', '0913', '0938', '0991'];
  return pick(rng, prefixes) + String(intBetween(rng, 1000000, 9999999));
}

function contractDates(status, rng) {
  const MONTH = 30 * 24 * 3600 * 1000;
  const now = Date.now();
  if (status === 'ACTIVE') {
    const start = new Date(now - intBetween(rng, 3, 10) * MONTH);
    return { start, end: new Date(start.getTime() + 14 * MONTH) };
  }
  const end = new Date(now - intBetween(rng, 1, 3) * MONTH);
  return { start: new Date(end.getTime() - 14 * MONTH), end };
}

// --------------------------------------------------------------------------
// Ensure reference rows
// --------------------------------------------------------------------------
async function ensureDistricts() {
  const out = [];
  for (const d of DISTRICTS) {
    const row = await prisma.district.upsert({
      where: { slug: d.slug },
      update: { name: d.name },
      create: { name: d.name, slug: d.slug },
    });
    out.push({ ...row, meta: d });
  }
  return out;
}

async function ensureDevices() {
  const map = new Map();
  for (const dev of DEVICES) {
    const row = await prisma.medicalDevice.upsert({
      where: { brandName_deviceType: { brandName: dev.brandName, deviceType: dev.deviceType } },
      update: { verificationStatus: 'APPROVED' },
      create: { brandName: dev.brandName, deviceType: dev.deviceType, verificationStatus: 'APPROVED' },
    });
    map.set(dev.brandName, row.id);
  }
  return map;
}

async function ensureServices() {
  for (const group of SERVICE_CATALOG) {
    const parent = await prisma.service.upsert({
      where: { slug: group.parent.slug },
      update: { serviceName: group.parent.serviceName },
      create: group.parent,
    });
    for (const child of group.children) {
      await prisma.service.upsert({
        where: { slug: child.slug },
        update: { serviceName: child.serviceName, basePrice: child.basePrice, parentId: parent.id },
        create: { ...child, parentId: parent.id },
      });
    }
  }

  // Long-tail keyword services, nested under their vertical's existing page.
  for (const lt of LONGTAIL_SERVICES) {
    const parent = await prisma.service.findUnique({ where: { slug: lt.parentSlug } });
    await prisma.service.upsert({
      where: { slug: lt.slug },
      update: { serviceName: lt.serviceName, basePrice: lt.basePrice, parentId: parent ? parent.id : null },
      create: { slug: lt.slug, serviceName: lt.serviceName, basePrice: lt.basePrice, parentId: parent ? parent.id : null },
    });
  }
}

// --------------------------------------------------------------------------
// Purge
// --------------------------------------------------------------------------
async function purgeMocks() {
  const res = await prisma.clinic.deleteMany({ where: { licenseNumber: { startsWith: MOCK_PREFIX } } });
  // clinic_services + clinic_devices rows cascade (onDelete: Cascade).
  console.log(`Purged ${res.count} mock clinic(s).`);
}

// --------------------------------------------------------------------------
// Seed one leaf service
// --------------------------------------------------------------------------
async function seedLeaf(service, ctx) {
  const { districts, deviceMap, dry, min, force } = ctx;

  const realCount = await prisma.clinic.count({
    where: {
      services: { some: { serviceId: service.id } },
      licenseNumber: { not: { startsWith: MOCK_PREFIX } },
    },
  });

  if (!force && realCount >= min) {
    console.log(`  skip   /shiraz/${service.slug}  (${realCount} real clinics ≥ ${min})`);
    return { created: 0, skipped: true };
  }

  // Aim for ~4 total; add between 2 and 3 mocks.
  const deficit = min + 1 - realCount;
  const mocks = Math.min(3, Math.max(2, deficit));
  const cat = categoryOf(service.slug, service.serviceName);
  const wantsDevices = cat !== 'dental';
  const statusPattern = ['ACTIVE', 'ACTIVE', 'EXPIRED'];
  const districtOffset = hashSeed(service.slug) % districts.length;

  // Long-tail slugs pin their first mocks to the districts the SEO copy
  // names (e.g. معالی‌آباد، قصرالدشت); remaining mocks rotate as usual.
  const ltConfig = LONGTAIL_SERVICES.find((s) => s.slug === service.slug) || {};
  const preferred = (ltConfig.preferredDistricts || [])
    .map((slug) => districts.find((d) => d.slug === slug))
    .filter(Boolean);

  let created = 0;
  for (let i = 1; i <= mocks; i++) {
    const license = `${MOCK_PREFIX}${service.slug}-${i}`;
    const rng = mulberry32(hashSeed(license));

    const district = preferred[i - 1] || districts[(districtOffset + i - 1) % districts.length];
    const dMeta = district.meta;
    const personName = CLINIC_NAMES[(hashSeed(license) + i) % CLINIC_NAMES.length];
    const name = `${KIND_BY_CATEGORY[cat]} ${personName}`;
    const status = statusPattern[(i - 1) % statusPattern.length];
    const { start, end } = contractDates(status, rng);
    const years = intBetween(rng, 5, 20);
    const street = pick(rng, dMeta.streets);
    const fullAddress = `${CITY}، ${district.name}، ${street}، پلاک ${intBetween(rng, 1, 240)}، طبقه ${intBetween(rng, 1, 5)}`;
    const biography = pick(rng, BIO_TEMPLATES)({ name, service: service.serviceName, district: district.name, years });
    const basePrice = service.basePrice != null ? Number(service.basePrice) : null;
    const customPrice = basePrice ? Math.round((basePrice * (0.9 + rng() * 0.25)) / 100000) * 100000 : null;

    if (dry) {
      console.log(`  would create  ${license}  "${name}"  [${status}]  ${district.name}`);
      created++;
      continue;
    }

    const clinic = await prisma.clinic.upsert({
      where: { licenseNumber: license },
      update: {
        name, phone: makePhone(rng), biography, fullAddress,
        latitude: dMeta.lat + (rng() - 0.5) * 0.01,
        longitude: dMeta.lng + (rng() - 0.5) * 0.01,
        contractStatus: status, startDate: start, endDate: end,
        districtId: district.id,
      },
      create: {
        name, licenseNumber: license, phone: makePhone(rng), biography, fullAddress,
        latitude: dMeta.lat + (rng() - 0.5) * 0.01,
        longitude: dMeta.lng + (rng() - 0.5) * 0.01,
        contractStatus: status, contractDurationMonths: 14, startDate: start, endDate: end,
        hasDedicatedWebsite: false, districtId: district.id,
        slug: `pending-${license.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+/g, '-').slice(0, 220),
      },
    });

    const prettySlug = buildClinicSlug(
      {
        id: clinic.id,
        name,
        englishName: null,
        specialty: service.serviceName,
      },
      usedClinicSlugs
    );
    usedClinicSlugs.add(prettySlug);
    if (clinic.slug !== prettySlug) {
      await prisma.clinic.update({
        where: { id: clinic.id },
        data: { slug: prettySlug },
      });
    }

    // Link to the service (idempotent via composite unique).
    await prisma.clinicService.upsert({
      where: { clinicId_serviceId: { clinicId: clinic.id, serviceId: service.id } },
      update: { customPrice },
      create: { clinicId: clinic.id, serviceId: service.id, customPrice },
    });

    // Attach 1-2 APPROVED authentic devices for relevant categories. When the
    // keyword promises a specific device (Candela, Doublo Gold), force it so
    // the page delivers exactly what the SERP snippet claims.
    if (wantsDevices) {
      const brands = DEVICES.map((d) => d.brandName);
      const first = ltConfig.forceDevice || brands[hashSeed(license) % brands.length];
      const second = brands[(hashSeed(license) + 3) % brands.length];
      const chosen = [...new Set([first, second])].slice(0, i === mocks ? 1 : 2);
      for (const brand of chosen) {
        const deviceId = deviceMap.get(brand);
        if (!deviceId) continue;
        await prisma.clinicDevice.upsert({
          where: { clinicId_deviceId: { clinicId: clinic.id, deviceId } },
          update: { isAuthenticBadge: true },
          create: { clinicId: clinic.id, deviceId, isAuthenticBadge: true },
        });
      }
    }

    created++;
  }

  console.log(`  seeded /shiraz/${service.slug}  +${created} mock (had ${realCount} real)`);
  return { created, skipped: false };
}

// --------------------------------------------------------------------------
// main
// --------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node prisma/seed-mock-clinics.js [--dry-run] [--purge] [--force] [--min=3] [--no-ensure-services]');
    return;
  }
  const dry = args.includes('--dry-run');
  const force = args.includes('--force');
  const noEnsure = args.includes('--no-ensure-services');
  const minArg = args.find((a) => a.startsWith('--min='));
  const min = minArg ? Math.max(1, parseInt(minArg.split('=')[1], 10) || 3) : 3;

  if (args.includes('--purge')) {
    await purgeMocks();
    return;
  }

  console.log(`\n=== Mock-clinic seeder ===  min=${min}${force ? ' force' : ''}${dry ? '  [DRY RUN]' : ''}\n`);

  try {
    const existing = await prisma.clinic.findMany({ select: { slug: true } });
    for (const row of existing) {
      if (row.slug) usedClinicSlugs.add(row.slug);
    }
  } catch (_err) {
    /* slug column may not exist until migrate */
  }

  const districts = await ensureDistricts();
  const deviceMap = await ensureDevices();
  if (!noEnsure) {
    await ensureServices();
    console.log(`Ensured ${SERVICE_CATALOG.length} service groups (incl. dentistry, botox).`);
  }

  const services = await prisma.service.findMany({ include: { children: true } });
  const leaves = services.filter((s) => s.children.length === 0);
  console.log(`Found ${services.length} services (${leaves.length} leaf pages to check).\n`);

  const ctx = { districts, deviceMap, dry, min, force };
  let totalCreated = 0;
  let seededPages = 0;
  let skipped = 0;

  for (const leaf of leaves) {
    const r = await seedLeaf(leaf, ctx);
    totalCreated += r.created;
    if (r.skipped) skipped++;
    else if (r.created) seededPages++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`  leaf pages seeded : ${seededPages}`);
  console.log(`  leaf pages skipped: ${skipped} (already had ≥ ${min} real clinics)`);
  console.log(`  mock clinics ${dry ? 'planned' : 'created/updated'}: ${totalCreated}`);
  if (!dry) {
    console.log(`\nNote: restart the backend to bust the 5-min page cache:`);
    console.log(`  docker compose restart backend`);
  }
}

// Only run against the DB when executed directly (keeps the module importable
// for unit tests / sample generation without opening a connection).
if (require.main === module) {
  main()
    .catch((err) => {
      console.error('Seeder failed:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  categoryOf, makePhone, contractDates, mulberry32, hashSeed,
  KIND_BY_CATEGORY, BIO_TEMPLATES, CLINIC_NAMES, DISTRICTS, SERVICE_CATALOG,
  LONGTAIL_SERVICES,
};
