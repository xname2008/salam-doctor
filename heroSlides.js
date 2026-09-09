'use strict';

/**
 * Hero slide CRUD (admin) + public list for homepage VIP slider.
 * Backed by Prisma / PostgreSQL HeroSlide model.
 */

const PUBLIC_SELECT = {
  id: true,
  mediaUrl: true,
  mediaType: true,
  title: true,
  ctaLink: true,
  order: true,
};

const MEDIA_TYPES = new Set(['VIDEO', 'IMAGE']);

function createHeroSlidesHandlers(deps) {
  const { sendJson, readJsonBody, trimOrNull } = deps;
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

  function serializeSlide(row) {
    if (!row) return null;
    return {
      id: row.id,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType,
      title: row.title,
      ctaLink: row.ctaLink,
      order: row.order,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  function parseMediaType(value) {
    const t = String(value || '').trim().toUpperCase();
    return MEDIA_TYPES.has(t) ? t : null;
  }

  function parseOrder(value, fallback) {
    const n = Number.parseInt(String(value == null ? fallback : value), 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  }

  function parseBool(value, fallback) {
    if (value === true || value === false) return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return fallback;
  }

  async function handlePublicList(res, method) {
    try {
      const prisma = getPrisma();
      const slides = await prisma.heroSlide.findMany({
        where: { isActive: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: PUBLIC_SELECT,
      });
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      sendJson(res, 200, { slides }, method);
    } catch (err) {
      console.error('[hero-slides] public list failed:', err && err.message);
      const status = err.message && err.message.includes('DATABASE_URL') ? 503 : 500;
      sendJson(res, status, { error: 'Failed to load hero slides' }, method);
    }
  }

  async function handleAdminList(res, method) {
    try {
      const prisma = getPrisma();
      const slides = await prisma.heroSlide.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
      sendJson(res, 200, { slides: slides.map(serializeSlide) }, method);
    } catch (err) {
      console.error('[hero-slides] admin list failed:', err && err.message);
      sendJson(res, 500, { error: 'Failed to list hero slides' }, method);
    }
  }

  async function handleAdminUpsert(req, res) {
    const data = await readJsonBody(req, res);
    if (!data) return;

    const mediaUrl = trimOrNull(data.mediaUrl || data.media_url);
    const mediaType = parseMediaType(data.mediaType || data.media_type);
    const title = trimOrNull(data.title);
    const ctaLink = trimOrNull(data.ctaLink || data.cta_link);
    const order = parseOrder(data.order, 0);
    const isActive = parseBool(data.isActive ?? data.is_active, true);
    const bodyId = trimOrNull(data.id);

    if (!mediaUrl) {
      sendJson(res, 400, { error: 'Missing required field: mediaUrl' });
      return;
    }
    if (!mediaType) {
      sendJson(res, 400, { error: 'Invalid mediaType: must be VIDEO or IMAGE' });
      return;
    }
    if (order == null) {
      sendJson(res, 400, { error: 'Invalid order: must be a non-negative integer' });
      return;
    }

    try {
      const prisma = getPrisma();
      let saved;

      if (bodyId) {
        const existing = await prisma.heroSlide.findUnique({ where: { id: bodyId } });
        if (existing) {
          saved = await prisma.heroSlide.update({
            where: { id: bodyId },
            data: { mediaUrl, mediaType, title, ctaLink, order, isActive },
          });
          sendJson(res, 200, { success: true, slide: serializeSlide(saved) });
          return;
        }
      }

      saved = await prisma.heroSlide.create({
        data: {
          id: bodyId || undefined,
          mediaUrl,
          mediaType,
          title,
          ctaLink,
          order,
          isActive,
        },
      });
      sendJson(res, 201, { success: true, slide: serializeSlide(saved) });
    } catch (err) {
      console.error('[hero-slides] upsert failed:', err && err.message);
      sendJson(res, 500, { error: 'Failed to save hero slide' });
    }
  }

  async function handleAdminDelete(req, res) {
    const id = trimOrNull(new URL(req.url, 'http://local').searchParams.get('id'));
    if (!id) {
      sendJson(res, 400, { error: 'Missing required query parameter: id' });
      return;
    }

    try {
      const prisma = getPrisma();
      const result = await prisma.heroSlide.delete({ where: { id } });
      sendJson(res, 200, { success: true, slide: serializeSlide(result) });
    } catch (err) {
      if (err && err.code === 'P2025') {
        sendJson(res, 404, { error: 'Hero slide not found' });
        return;
      }
      console.error('[hero-slides] delete failed:', err && err.message);
      sendJson(res, 500, { error: 'Failed to delete hero slide' });
    }
  }

  async function handleAdminReorder(req, res) {
    const data = await readJsonBody(req, res);
    if (!data) return;

    const items = Array.isArray(data.items) ? data.items : data.order;
    if (!Array.isArray(items) || !items.length) {
      sendJson(res, 400, { error: 'Body must include items: [{ id, order }, ...]' });
      return;
    }

    const normalized = [];
    for (const item of items) {
      const id = trimOrNull(item && item.id);
      const order = parseOrder(item && item.order, null);
      if (!id || order == null) {
        sendJson(res, 400, { error: 'Each item requires id and non-negative integer order' });
        return;
      }
      normalized.push({ id, order });
    }

    try {
      const prisma = getPrisma();
      await prisma.$transaction(
        normalized.map((item) =>
          prisma.heroSlide.update({
            where: { id: item.id },
            data: { order: item.order },
          })
        )
      );
      const slides = await prisma.heroSlide.findMany({
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
      sendJson(res, 200, { success: true, slides: slides.map(serializeSlide) });
    } catch (err) {
      if (err && err.code === 'P2025') {
        sendJson(res, 404, { error: 'One or more hero slides not found' });
        return;
      }
      console.error('[hero-slides] reorder failed:', err && err.message);
      sendJson(res, 500, { error: 'Failed to reorder hero slides' });
    }
  }

  function tryHandle(req, res, pathname, method) {
    if ((method === 'GET' || method === 'HEAD') && pathname === '/api/hero-slides') {
      handlePublicList(res, method);
      return true;
    }

    if (pathname === '/api/admin/hero-slides/reorder' && method === 'PUT') {
      handleAdminReorder(req, res);
      return true;
    }

    if (pathname === '/api/admin/hero-slides') {
      if (method === 'GET' || method === 'HEAD') {
        handleAdminList(res, method);
        return true;
      }
      if (method === 'POST' || method === 'PUT') {
        handleAdminUpsert(req, res);
        return true;
      }
      if (method === 'DELETE') {
        handleAdminDelete(req, res);
        return true;
      }
    }

    return false;
  }

  return {
    tryHandle,
    handlePublicList,
    handleAdminList,
    handleAdminUpsert,
    handleAdminDelete,
    handleAdminReorder,
  };
}

module.exports = { createHeroSlidesHandlers, PUBLIC_SELECT, MEDIA_TYPES };
