'use strict';

// ==========================================================================
// DirectoryRepository
// --------------------------------------------------------------------------
// Data-access layer for the programmatic-SEO "hub" pages (/shiraz/:service).
// Backed by the Prisma/PostgreSQL schema (see prisma/schema.prisma).
//
// Design goals:
//   * ONE round-trip per page (relations eager-loaded).
//   * Premium (contract_status = ACTIVE) clinics ranked first.
//   * In-memory TTL cache + in-flight de-duplication (cache-stampede guard)
//     so Googlebot hammering many URLs never melts the DB.
// ==========================================================================

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LIMIT = 60;
const CITY = 'شیراز';
const { getCity, localHubPath } = require('./local-seo-registry');
const { clinicProfilePath, slugForClinic } = require('./clinicSlug');
const { resolveHubServiceSlug } = require('./serviceSlugMap');
const { HUB_SLUGS, PARENT_SLUGS } = require('./hub-slugs');
const { hubLabelFa, isParentHubSlug } = require('./hub-labels');
const { sanitizeHubPageData, sanitizeHubClinicList } = require('./hubClinicSanitize');

class DirectoryRepository {
  /**
   * @param {object}  [opts]
   * @param {import('@prisma/client').PrismaClient} [opts.prisma] injected client (recommended)
   * @param {number}  [opts.cacheTtlMs]
   * @param {number}  [opts.limit]  max clinics per page
   */
  constructor(opts = {}) {
    this.cacheTtlMs = opts.cacheTtlMs != null ? opts.cacheTtlMs : DEFAULT_TTL_MS;
    this.limit = opts.limit != null ? opts.limit : DEFAULT_LIMIT;
    this.city = opts.city || CITY;

    this._prisma = opts.prisma || null;
    this._cache = new Map(); // slug -> { expires:number, data:object|null }
    this._inflight = new Map(); // slug -> Promise
  }

  // Lazily resolve a Prisma client so the rest of the (SQLite) server can boot
  // even when the Postgres client hasn't been generated yet.
  _getPrisma() {
    if (this._prisma) return this._prisma;
    // eslint-disable-next-line global-require
    const { PrismaClient } = require('@prisma/client');
    this._prisma = new PrismaClient();
    return this._prisma;
  }

  /**
   * Public API. Returns a fully-shaped page payload, or `null` when the
   * service slug does not exist (router should answer 404).
   * @param {string} serviceSlug
   */
  /**
   * Multi-city local hub: /{city_slug}/{service_slug}
   * Reuses the same optimized Prisma queries as Shiraz hubs.
   * @param {string} citySlug
   * @param {string} serviceSlug
   */
  async getLocalHubPageData(citySlug, serviceSlug) {
    const city = getCity(citySlug);
    const slug = String(serviceSlug || '').trim().toLowerCase();
    if (!city || !slug) return null;

    const published = await this._isHubPublished(city.slug, slug);
    if (!published) return null;

    const cacheKey = `${city.slug}:${slug}`;
    const now = Date.now();
    const cached = this._cache.get(cacheKey);
    if (cached && cached.expires > now) return cached.data;

    if (this._inflight.has(cacheKey)) return this._inflight.get(cacheKey);

    const promise = this._load(slug, city)
      .then(async (data) => {
        if (data) {
          data.hubSeo = await this._loadHubSeo(city.slug, slug, data.service && data.service.id);
        }
        this._cache.set(cacheKey, { expires: Date.now() + this.cacheTtlMs, data });
        return data;
      })
      .finally(() => {
        this._inflight.delete(cacheKey);
      });

    this._inflight.set(cacheKey, promise);
    return promise;
  }

  async getDirectoryPageData(serviceSlug) {
    return this.getLocalHubPageData('shiraz', serviceSlug);
  }

  /**
   * City hub landing: /shiraz — services index + featured clinics.
   * @param {string} citySlug
   */
  async getCityHubPageData(citySlug) {
    const city = getCity(citySlug);
    if (!city) return null;

    const cacheKey = `city:${city.slug}`;
    const now = Date.now();
    const cached = this._cache.get(cacheKey);
    if (cached && cached.expires > now) return cached.data;

    if (this._inflight.has(cacheKey)) return this._inflight.get(cacheKey);

    const promise = this._loadCityHub(city)
      .then((data) => {
        this._cache.set(cacheKey, { expires: Date.now() + this.cacheTtlMs, data });
        return data;
      })
      .finally(() => {
        this._inflight.delete(cacheKey);
      });

    this._inflight.set(cacheKey, promise);
    return promise;
  }

  /** Bust in-memory hub cache (after admin directory changes). */
  clearCache() {
    this._cache.clear();
    this._inflight.clear();
  }

  async _loadHubPublishMap(citySlug) {
    const city = String(citySlug || 'shiraz').trim().toLowerCase();
    const map = new Map();
    try {
      const prisma = this._getPrisma();
      if (!prisma.localHubSeo || typeof prisma.localHubSeo.findMany !== 'function') {
        return map;
      }
      const rows = await prisma.localHubSeo.findMany({
        where: { citySlug: city },
        select: { serviceSlug: true, isPublished: true },
      });
      for (const row of rows) {
        map.set(String(row.serviceSlug).toLowerCase(), row.isPublished);
      }
    } catch (err) {
      console.warn('[seo] hub publish map skipped:', (err && err.message) || err);
    }
    return map;
  }

  async _isHubPublished(citySlug, serviceSlug) {
    const slug = String(serviceSlug || '').trim().toLowerCase();
    if (!slug) return false;
    const map = await this._loadHubPublishMap(citySlug);
    if (!map.has(slug)) return true;
    return map.get(slug) !== false;
  }

  /** Public wrapper for router guards. */
  async isHubPublished(citySlug, serviceSlug) {
    return this._isHubPublished(citySlug, serviceSlug);
  }

  async _resolveService(prisma, rawSlug) {
    const slug = resolveHubServiceSlug(rawSlug) || String(rawSlug || '').trim().toLowerCase();
    if (!slug) return null;

    let service = await prisma.service.findUnique({
      where: { slug },
      include: { parent: true, children: true },
    });
    if (!service) {
      service = await prisma.service.findFirst({
        where: { slug: { equals: slug, mode: 'insensitive' } },
        include: { parent: true, children: true },
      });
    }
    return service;
  }

  async _loadCityHub(cityInfo) {
    const city = cityInfo || getCity('shiraz');
    const prisma = this._getPrisma();

    let services = [];
    try {
      const rows = await prisma.service.findMany({
        select: {
          id: true,
          slug: true,
          serviceName: true,
          parentId: true,
          parent: { select: { slug: true, serviceName: true } },
        },
        orderBy: { serviceName: 'asc' },
      });
      if (rows.length) {
        const bySlug = new Map();
        for (const row of rows) {
          const slug = String(row.slug || '').trim().toLowerCase();
          if (!slug) continue;
          bySlug.set(slug, {
            slug,
            name: hubLabelFa(slug, row.serviceName),
            parentSlug: row.parent && row.parent.slug
              ? String(row.parent.slug).toLowerCase()
              : null,
            isParent: isParentHubSlug(slug) || PARENT_SLUGS.has(slug),
            href: localHubPath(city.slug, slug),
          });
        }
        services = HUB_SLUGS.map((slug) => bySlug.get(slug) || {
          slug,
          name: hubLabelFa(slug),
          parentSlug: null,
          isParent: isParentHubSlug(slug),
          href: localHubPath(city.slug, slug),
        });
      }
    } catch (err) {
      console.warn('[seo] city hub services query skipped:', (err && err.message) || err);
    }

    if (!services.length) {
      services = HUB_SLUGS.map((slug) => ({
        slug,
        name: hubLabelFa(slug),
        parentSlug: null,
        isParent: isParentHubSlug(slug),
        href: localHubPath(city.slug, slug),
      }));
    }

    const parentServices = services.filter((s) => s.isParent);
    const leafServices = services.filter((s) => !s.isParent);

    const publishMap = await this._loadHubPublishMap(city.slug);
    const isPublished = (slug) => {
      if (!publishMap.has(slug)) return true;
      return publishMap.get(slug) !== false;
    };
    services = services.filter((s) => isPublished(s.slug));
    const publishedParentServices = parentServices.filter((s) => isPublished(s.slug));
    const publishedLeafServices = leafServices.filter((s) => isPublished(s.slug));

    let clinics = [];
    try {
      const rows = await prisma.clinic.findMany({
        where: { contractStatus: 'ACTIVE' },
        include: {
          district: true,
          services: { include: { service: true }, take: 3 },
        },
        orderBy: [{ contractStatus: 'asc' }, { createdAt: 'asc' }],
        take: 12,
      });
      clinics = rows.map((c) => this._shapeClinic(c));
    } catch (err) {
      console.warn('[seo] city hub clinics query skipped:', (err && err.message) || err);
    }

    return {
      citySlug: city.slug,
      cityInfo: city,
      city: city.nameFa,
      canonicalPath: `/${city.slug}`,
      services,
      parentServices: publishedParentServices,
      leafServices: publishedLeafServices,
      clinics,
      stats: {
        serviceCount: services.length,
        clinicCount: clinics.length,
        activeClinics: clinics.filter((c) => c.isActive).length,
      },
    };
  }

  async _loadHubSeo(citySlug, serviceSlug, serviceId) {
    try {
      const prisma = this._getPrisma();
      if (!prisma.localHubSeo || typeof prisma.localHubSeo.findFirst !== 'function') {
        return null;
      }
      const row = await prisma.localHubSeo.findFirst({
        where: {
          isPublished: true,
          OR: [
            { citySlug: String(citySlug).toLowerCase(), serviceSlug: String(serviceSlug).toLowerCase() },
            ...(serviceId
              ? [{ citySlug: String(citySlug).toLowerCase(), serviceId: Number(serviceId) }]
              : []),
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (!row) return null;
      return {
        h1Title: row.h1Title,
        seoDescription: row.seoDescription,
        metaTitle: row.metaTitle || null,
        metaDescription: row.metaDescription || null,
        citySlug: row.citySlug,
        serviceSlug: row.serviceSlug,
      };
    } catch (err) {
      // Table may not exist until migrate deploy — hub still renders with defaults.
      console.warn('[seo] local_hub_seo lookup skipped:', (err && err.message) || err);
      return null;
    }
  }

  async _load(slug, cityInfo) {
    const city = cityInfo || getCity('shiraz');
    const prisma = this._getPrisma();

    // 1) Resolve the service (+ one level of children so a parent hub such as
    //    /shiraz/dermatology also lists sub-service clinics).
    const service = await this._resolveService(prisma, slug);
    if (!service) return null;

    const serviceIds = [service.id, ...service.children.map((c) => c.id)];

    // 2) Clinics offering the service (or any child), premium-first.
    //    Enum sort order is ACTIVE < EXPIRED, so ascending = premium on top.
    const clinics = await prisma.clinic.findMany({
      where: {
        contractStatus: 'ACTIVE',
        services: { some: { serviceId: { in: serviceIds } } },
      },
      include: {
        district: true,
        devices: {
          where: { device: { verificationStatus: 'APPROVED' } },
          include: { device: true },
        },
        services: {
          where: { serviceId: { in: serviceIds } },
          include: { service: true },
        },
      },
      orderBy: [{ contractStatus: 'asc' }, { createdAt: 'asc' }],
      take: this.limit,
    });

    const mapped = clinics.map((c) => this._shapeClinic(c));

    // Defensive, stable re-sort: guarantees premium-first regardless of driver.
    mapped.sort((a, b) => Number(b.isActive) - Number(a.isActive));

    const primary = sanitizeHubClinicList(mapped);

    let relatedClinics = [];
    if (!primary.length && service.parent) {
      relatedClinics = await this._loadRelatedClinics(service.parent.id, service.id);
    }

    return sanitizeHubPageData(this._shapePage(service, primary, city, relatedClinics));
  }

  async _loadRelatedClinics(parentServiceId, excludeServiceId) {
    const prisma = this._getPrisma();
    const parent = await prisma.service.findUnique({
      where: { id: Number(parentServiceId) },
      include: { children: true },
    });
    if (!parent) return [];

    const serviceIds = [parent.id, ...(parent.children || []).map((c) => c.id)]
      .filter((id) => id !== Number(excludeServiceId));

    const clinics = await prisma.clinic.findMany({
      where: {
        contractStatus: 'ACTIVE',
        services: { some: { serviceId: { in: serviceIds } } },
      },
      include: {
        district: true,
        devices: {
          where: { device: { verificationStatus: 'APPROVED' } },
          include: { device: true },
        },
        services: {
          where: { serviceId: { in: serviceIds } },
          include: { service: true },
        },
      },
      orderBy: [{ contractStatus: 'asc' }, { createdAt: 'asc' }],
      take: 4,
    });

    const mapped = clinics.map((c) => this._shapeClinic(c));
    mapped.sort((a, b) => Number(b.isActive) - Number(a.isActive));
    return mapped.slice(0, 4);
  }

  _shapeClinic(c) {
    const isActive = c.contractStatus === 'ACTIVE';
    const devices = (c.devices || []).map((cd) => ({
      brandName: cd.device.brandName,
      deviceType: cd.device.deviceType,
      isAuthentic: Boolean(cd.isAuthenticBadge),
    }));
    const rating = pseudoRating(c.id); // TODO: replace with real reviews table

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      address: c.fullAddress,
      biography: c.biography || '',
      isActive,
      contractStatus: c.contractStatus,
      hasDedicatedWebsite: Boolean(c.hasDedicatedWebsite),
      dedicatedDomain: c.dedicatedDomain || null,
      district: c.district ? { id: c.district.id, name: c.district.name, slug: c.district.slug } : null,
      devices,
      hasAuthenticBadge: devices.some((d) => d.isAuthentic),
      services: (c.services || []).map((cs) => cs.service.serviceName),
      slug: c.slug || slugForClinic(c.id),
      profileUrl: c.hasDedicatedWebsite && c.dedicatedDomain
        ? `https://${c.dedicatedDomain}`
        : clinicProfilePath(c),
      rating,
    };
  }

  _shapePage(service, clinics, cityInfo, relatedClinics) {
    const city = cityInfo || getCity('shiraz');
    // Distinct districts represented (powers internal-linking blocks + SEO copy).
    const districtMap = new Map();
    for (const c of clinics) {
      if (c.district && !districtMap.has(c.district.slug)) districtMap.set(c.district.slug, c.district);
    }
    const districts = Array.from(districtMap.values());

    // Aggregate rating from the (per-clinic) ratings actually shown on-page.
    const ratings = clinics.map((c) => c.rating.value);
    const reviewCount = clinics.reduce((sum, c) => sum + c.rating.count, 0);
    const ratingValue = ratings.length
      ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
      : 4.8;

    const prices = [service, ...(service.children || [])]
      .map((s) => (s.basePrice != null ? Number(s.basePrice) : null))
      .filter((n) => n != null && n > 0);
    const minPrice = prices.length ? Math.min(...prices) : null;

    return {
      citySlug: city.slug,
      cityInfo: city,
      city: city.nameFa,
      canonicalPath: `/${city.slug}/${service.slug}`,
      hubSeo: null,
      service: {
        id: service.id,
        name: service.serviceName,
        slug: service.slug,
        parent: service.parent ? { name: service.parent.serviceName, slug: service.parent.slug } : null,
        children: (service.children || []).map((s) => ({ name: s.serviceName, slug: s.slug })),
        basePrice: service.basePrice != null ? Number(service.basePrice) : null,
        minPrice,
      },
      clinics,
      relatedClinics: relatedClinics || [],
      districts,
      stats: {
        total: clinics.length,
        active: clinics.filter((c) => c.isActive).length,
        withAuthenticDevice: clinics.filter((c) => c.hasAuthenticBadge).length,
        ratingValue,
        reviewCount: reviewCount || clinics.length,
      },
    };
  }

  clearCache(key) {
    if (!key) {
      this._cache.clear();
      return;
    }
    const k = String(key).toLowerCase();
    this._cache.delete(k);
    // Legacy single-slug keys (shiraz-only) still used by some callers.
    if (!k.includes(':')) this._cache.delete(`shiraz:${k}`);
  }
}

// --------------------------------------------------------------------------
// Deterministic placeholder rating (stable per clinic id) so the on-page
// stars and the AggregateRating JSON-LD always agree.
//
// ⚠️ SEO/compliance: Google requires review markup to reflect REAL reviews
// visible on the page. Swap `pseudoRating` for a real `reviews`/`ratings`
// table before go-live to avoid a structured-data manual action.
// --------------------------------------------------------------------------
function pseudoRating(seed) {
  const n = Number(seed) || 1;
  const value = Number((4.5 + ((n * 37) % 5) / 10).toFixed(1)); // 4.5 .. 4.9
  const count = 28 + ((n * 17) % 220); // 28 .. 247
  return { value, count };
}

module.exports = { DirectoryRepository };
