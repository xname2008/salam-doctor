'use strict';

/**
 * Sync confirmed leads from SQLite (leads.db) → PostgreSQL (Prisma Lead model).
 *
 * Standalone:  node syncWorker.js
 * Cron (server): started from server.js via startLeadSyncCron()
 *
 * Env:
 *   DATABASE_URL          — required for Postgres sync
 *   LEADS_DB_PATH         — default ./leads.db
 *   LEAD_SYNC_CRON        — cron expression (default: every 5 minutes)
 *   LEAD_SYNC_BATCH_SIZE  — max leads per run (default 50)
 *   LEAD_SYNC_ENABLED     — set to "0" to disable cron in server.js
 */

const path = require('path');
const Database = require('better-sqlite3');
const { ensureLeadsTrackingColumns } = require('./commercialLandingLeads');

const DEFAULT_CRON = '*/5 * * * *';
const DEFAULT_BATCH = 50;
const LOG_PREFIX = '[lead-sync]';

let cronJob = null;
let prismaSingleton = null;

function log(level, message, extra) {
  const ts = new Date().toISOString();
  const suffix = extra != null ? ` ${JSON.stringify(extra)}` : '';
  const line = `${ts} ${LOG_PREFIX} ${message}${suffix}`;
  if (level === 'error') console.error(line);
  else console.log(line);
}

function openSqlite(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  ensureLeadsTrackingColumns(db);
  return db;
}

function getPrisma() {
  if (prismaSingleton) return prismaSingleton;
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — Postgres sync disabled');
  }
  const { PrismaClient } = require('@prisma/client');
  prismaSingleton = new PrismaClient();
  return prismaSingleton;
}

function parseCapturedAt(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function mapSqliteLeadToPrisma(row) {
  const clinicId = row.clinic_id != null ? Number(row.clinic_id) : null;
  return {
    externalId: String(row.id),
    name: String(row.name).slice(0, 120),
    phone: String(row.phone).slice(0, 20),
    service: String(row.service).slice(0, 200),
    description: row.desc ? String(row.desc).slice(0, 5000) : null,
    clinicId: Number.isFinite(clinicId) ? clinicId : null,
    landingPath: row.landing_path ? String(row.landing_path).slice(0, 255) : null,
    packageSlug: row.package_slug ? String(row.package_slug).slice(0, 80) : null,
    utmSource: row.utm_source || null,
    utmMedium: row.utm_medium || null,
    utmCampaign: row.utm_campaign || null,
    utmTerm: row.utm_term || null,
    utmContent: row.utm_content || null,
    source: 'sqlite',
    capturedAt: parseCapturedAt(row.timestamp),
  };
}

function fetchPendingLeads(db, limit) {
  return db
    .prepare(
      `SELECT *
       FROM leads
       WHERE COALESCE(is_synced, 0) = 0
         AND COALESCE(is_confirmed, 1) = 1
       ORDER BY timestamp ASC
       LIMIT ?`
    )
    .all(limit);
}

function markLeadSynced(db, leadId) {
  db.prepare(
    `UPDATE leads
     SET is_synced = 1,
         synced_at = @syncedAt,
         sync_error = NULL
     WHERE id = @id AND COALESCE(is_synced, 0) = 0`
  ).run({
    id: leadId,
    syncedAt: new Date().toISOString(),
  });
}

function markLeadSyncError(db, leadId, errorMessage) {
  db.prepare(
    `UPDATE leads
     SET sync_error = @syncError
     WHERE id = @id`
  ).run({
    id: leadId,
    syncError: String(errorMessage || 'unknown').slice(0, 500),
  });
}

/**
 * Sync one lead: Postgres insert first, then SQLite is_synced=1.
 * @returns {'synced'|'duplicate'|'failed'}
 */
async function syncOneLead(db, prisma, row) {
  const data = mapSqliteLeadToPrisma(row);

  try {
    await prisma.lead.create({ data });
  } catch (err) {
    if (err && err.code === 'P2002') {
      log('info', 'Lead already exists in Postgres — marking SQLite synced', {
        externalId: data.externalId,
      });
      markLeadSynced(db, row.id);
      return 'duplicate';
    }
    markLeadSyncError(db, row.id, err && err.message);
    throw err;
  }

  const update = db
    .prepare(
      `UPDATE leads SET is_synced = 1, synced_at = @syncedAt, sync_error = NULL
       WHERE id = @id AND COALESCE(is_synced, 0) = 0`
    )
    .run({ id: row.id, syncedAt: new Date().toISOString() });

  if (update.changes !== 1) {
    log('error', 'Postgres insert succeeded but SQLite is_synced update failed', {
      externalId: data.externalId,
    });
    return 'failed';
  }

  return 'synced';
}

/**
 * Run one sync batch. Safe to call from cron or CLI.
 */
async function runLeadSync(options = {}) {
  const dbPath = options.dbPath || process.env.LEADS_DB_PATH || path.join(__dirname, 'leads.db');
  const batchSize = Number(options.batchSize || process.env.LEAD_SYNC_BATCH_SIZE || DEFAULT_BATCH);
  const limit = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : DEFAULT_BATCH;

  if (!process.env.DATABASE_URL) {
    log('info', 'Skipped — DATABASE_URL not configured');
    return { synced: 0, duplicate: 0, failed: 0, skipped: true };
  }

  const started = Date.now();
  const db = openSqlite(dbPath);
  let prisma;

  const stats = { synced: 0, duplicate: 0, failed: 0, total: 0 };

  try {
    prisma = getPrisma();
    const pending = fetchPendingLeads(db, limit);
    stats.total = pending.length;

    if (!pending.length) {
      log('info', 'No pending leads to sync');
      return stats;
    }

    log('info', `Starting sync run — ${pending.length} lead(s) queued`);

    for (const row of pending) {
      try {
        const result = await syncOneLead(db, prisma, row);
        if (result === 'synced') stats.synced += 1;
        else if (result === 'duplicate') stats.duplicate += 1;
        else stats.failed += 1;
      } catch (err) {
        stats.failed += 1;
        log('error', 'Lead sync failed', {
          id: row.id,
          error: err && err.message,
        });
      }
    }

    const elapsed = Date.now() - started;
    log('info', 'Sync run finished', {
      ...stats,
      elapsedMs: elapsed,
    });
    return stats;
  } catch (err) {
    log('error', 'Sync run aborted', { error: err && err.message });
    throw err;
  } finally {
    db.close();
    if (options.disconnectPrisma && prismaSingleton) {
      await prismaSingleton.$disconnect();
      prismaSingleton = null;
    }
  }
}

let syncInFlight = false;

async function runLeadSyncGuarded(options = {}) {
  if (syncInFlight) {
    log('info', 'Skipped — previous sync still running');
    return { skipped: true, reason: 'in_flight' };
  }
  syncInFlight = true;
  try {
    return await runLeadSync(options);
  } finally {
    syncInFlight = false;
  }
}

/**
 * Schedule periodic sync with node-cron.
 */
function startLeadSyncCron(options = {}) {
  const cronExpr = options.cron || process.env.LEAD_SYNC_CRON || DEFAULT_CRON;
  let cron;
  try {
    cron = require('node-cron');
  } catch (err) {
    log('error', 'node-cron not installed — run: npm install node-cron', {
      error: err && err.message,
    });
    return null;
  }

  if (!cron.validate(cronExpr)) {
    log('error', 'Invalid LEAD_SYNC_CRON expression', { cron: cronExpr });
    return null;
  }

  if (cronJob) cronJob.stop();

  cronJob = cron.schedule(cronExpr, () => {
    runLeadSyncGuarded({
      dbPath: options.dbPath,
      batchSize: options.batchSize,
    }).catch((err) => {
      log('error', 'Scheduled sync uncaught error', { error: err && err.message });
    });
  });

  log('info', 'Cron scheduler started', { cron: cronExpr });
  return cronJob;
}

function stopLeadSyncCron() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    log('info', 'Cron scheduler stopped');
  }
}

async function shutdownLeadSync() {
  stopLeadSyncCron();
  if (prismaSingleton) {
    await prismaSingleton.$disconnect();
    prismaSingleton = null;
  }
}

if (require.main === module) {
  runLeadSync({ disconnectPrisma: true })
    .then((stats) => {
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = {
  runLeadSync,
  runLeadSyncGuarded,
  startLeadSyncCron,
  stopLeadSyncCron,
  shutdownLeadSync,
  mapSqliteLeadToPrisma,
};
