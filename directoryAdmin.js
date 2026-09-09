'use strict';

/**
 * Admin API for Shiraz directory: clinic activation + service hub publish toggles.
 */

const { HUB_SLUGS, PARENT_SLUGS } = require('./hub-slugs');
const { hubLabelFa, isParentHubSlug } = require('./hub-labels');
const { syncCatalogClinicToPostgres, loadClinicsData } = require('./catalogClinicSync');

function createDirectoryAdminHandlers(deps) {
  const { sendJson, readJsonBody, trimOrNull, getDb } = deps;
  let prismaSingleton = null;

  function getPrisma() {
    if (prismaSingleton) return prismaSingleton;
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured');
    }
    const { PrismaClient } = require('@prisma/client');
    prismaSingleton = new PrismaClient();
    return prismaSingleton;
  }

  function parseBool(value, fallback) {
    if (value === true || value === false) return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return fallback;
  }

  function loadCatalogList() {
    return loadClinicsData()
      .filter((c) => c && Number.isInteger(c.id))
      .map((c) => ({
        id: c.id,
        name: trimOrNull(c.name) || trimOrNull(c.sliderTitle) || `مرکز ${c.id}`,
      }))
      .sort((a, b) => a.id - b.id);
  }

  function getClinicProfile(clinicId) {
    const db = typeof getDb === 'function' ? getDb() : null;
    if (!db) return null;
    try {
      return db.prepare('SELECT * FROM clinic_profiles WHERE clinic_id = ?').get(clinicId) || null;
    } catch (_err) {
      return null;
    }
  }

  async function handleAdminList(res, method, citySlug) {
    const city = String(citySlug || 'shiraz').trim().toLowerCase();
    try {
      const prisma = getPrisma();
      const catalog = loadCatalogList();
      const dbRows = await prisma.clinic.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          contractStatus: true,
          services: { include: { service: { select: { slug: true, serviceName: true } } } },
        },
        orderBy: { id: 'asc' },
      });
      const byId = new Map(dbRows.map((r) => [r.id, r]));

      const clinics = catalog.map((c) => {
        const row = byId.get(c.id);
        const active = row ? row.contractStatus === 'ACTIVE' : false;
        return {
          id: c.id,
          name: row ? row.name : c.name,
          slug: row ? row.slug : null,
          active,
          inDatabase: Boolean(row),
          contractStatus: row ? row.contractStatus : null,
          serviceCount: row ? row.services.length : 0,
        };
      });

      for (const row of dbRows) {
        if (catalog.some((c) => c.id === row.id)) continue;
        clinics.push({
          id: row.id,
          name: row.name,
          slug: row.slug,
          active: row.contractStatus === 'ACTIVE',
          inDatabase: true,
          contractStatus: row.contractStatus,
          serviceCount: row.services.length,
        });
      }
      clinics.sort((a, b) => a.id - b.id);

      const publishRows = await prisma.localHubSeo.findMany({
        where: { citySlug: city },
        select: { serviceSlug: true, isPublished: true },
      });
      const publishMap = new Map(
        publishRows.map((r) => [String(r.serviceSlug).toLowerCase(), r.isPublished])
      );

      const hubs = HUB_SLUGS.map((slug) => ({
        slug,
        name: hubLabelFa(slug),
        isParent: isParentHubSlug(slug) || PARENT_SLUGS.has(slug),
        isPublished: publishMap.has(slug) ? publishMap.get(slug) : true,
      }));

      sendJson(
        res,
        200,
        {
          city,
          clinics,
          hubs,
          stats: {
            clinicCount: clinics.length,
            activeClinics: clinics.filter((c) => c.active).length,
            hubCount: hubs.length,
            publishedHubs: hubs.filter((h) => h.isPublished).length,
          },
        },
        method
      );
    } catch (err) {
      console.error('[directory-admin] list failed:', err && err.message);
      const status = err.message && err.message.includes('DATABASE_URL') ? 503 : 500;
      sendJson(res, status, { error: 'Failed to load directory admin data' }, method);
    }
  }

  async function handleClinicStatus(req, res, clinicId) {
    const data = await readJsonBody(req, res);
    if (!data) return;

    const id = Number.parseInt(String(clinicId), 10);
    if (!Number.isInteger(id) || id < 1) {
      sendJson(res, 400, { error: 'Invalid clinic id' });
      return;
    }

    const active = parseBool(data.active ?? data.isActive, null);
    const contractStatus =
      data.contractStatus === 'EXPIRED' || data.contractStatus === 'ACTIVE'
        ? data.contractStatus
        : active === true
          ? 'ACTIVE'
          : active === false
            ? 'EXPIRED'
            : null;

    if (!contractStatus) {
      sendJson(res, 400, { error: 'Provide active (boolean) or contractStatus (ACTIVE|EXPIRED)' });
      return;
    }

    try {
      const prisma = getPrisma();
      const profile = getClinicProfile(id);
      let row = await prisma.clinic.findUnique({ where: { id } });

      if (!row && contractStatus === 'ACTIVE') {
        const synced = await syncCatalogClinicToPostgres(prisma, id, {
          profile,
          contractStatus: 'ACTIVE',
        });
        row = synced.clinic;
      } else if (row) {
        row = await prisma.clinic.update({
          where: { id },
          data: { contractStatus },
        });
      } else {
        sendJson(res, 404, { error: 'Clinic not in catalog; cannot activate' });
        return;
      }

      sendJson(res, 200, {
        success: true,
        clinic: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          active: row.contractStatus === 'ACTIVE',
          contractStatus: row.contractStatus,
        },
      });
    } catch (err) {
      console.error('[directory-admin] clinic status failed:', err && err.message);
      sendJson(res, 500, { error: err.message || 'Failed to update clinic status' });
    }
  }

  async function handleHubStatus(req, res) {
    const data = await readJsonBody(req, res);
    if (!data) return;

    const citySlug = String(data.citySlug || data.city || 'shiraz').trim().toLowerCase();
    const serviceSlug = String(data.serviceSlug || data.slug || '').trim().toLowerCase();
    const isPublished = parseBool(data.isPublished ?? data.active ?? data.published, null);

    if (!serviceSlug || !HUB_SLUGS.includes(serviceSlug)) {
      sendJson(res, 400, { error: 'Invalid or unknown serviceSlug' });
      return;
    }
    if (isPublished === null) {
      sendJson(res, 400, { error: 'Provide isPublished (boolean)' });
      return;
    }

    const label = hubLabelFa(serviceSlug);
    const h1Title = `بهترین مراکز ${label} در شیراز`;

    try {
      const prisma = getPrisma();
      const service = await prisma.service.findUnique({
        where: { slug: serviceSlug },
        select: { id: true },
      });

      const row = await prisma.localHubSeo.upsert({
        where: {
          citySlug_serviceSlug: { citySlug, serviceSlug },
        },
        update: { isPublished },
        create: {
          citySlug,
          serviceSlug,
          h1Title,
          seoDescription: `<p>صفحه ${label} در شیراز.</p>`,
          metaTitle: `${label} در شیراز | سلام دکتر`,
          metaDescription: `مراکز ${label} در شیراز.`,
          serviceId: service ? service.id : null,
          isPublished,
        },
      });

      sendJson(res, 200, {
        success: true,
        hub: {
          citySlug: row.citySlug,
          serviceSlug: row.serviceSlug,
          name: label,
          isPublished: row.isPublished,
        },
      });
    } catch (err) {
      console.error('[directory-admin] hub status failed:', err && err.message);
      sendJson(res, 500, { error: 'Failed to update hub status' });
    }
  }

  function tryHandle(req, res, pathname, method) {
    const clinicMatch = pathname.match(/^\/api\/admin\/directory\/clinics\/(\d+)$/);
    if (clinicMatch && (method === 'PATCH' || method === 'PUT' || method === 'POST')) {
      handleClinicStatus(req, res, clinicMatch[1]);
      return true;
    }

    if (pathname === '/api/admin/directory/hubs' && (method === 'PATCH' || method === 'PUT' || method === 'POST')) {
      handleHubStatus(req, res);
      return true;
    }

    if (pathname === '/api/admin/directory' && (method === 'GET' || method === 'HEAD')) {
      const url = new URL(req.url || '/', 'http://local');
      handleAdminList(res, method, url.searchParams.get('city') || 'shiraz');
      return true;
    }

    return false;
  }

  return { tryHandle, handleAdminList, handleClinicStatus, handleHubStatus };
}

module.exports = { createDirectoryAdminHandlers };
