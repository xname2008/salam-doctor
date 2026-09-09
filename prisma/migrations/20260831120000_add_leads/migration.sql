-- Leads table (PostgreSQL) — synced from SQLite leads.db worker
CREATE TABLE IF NOT EXISTS "leads" (
    "id" TEXT NOT NULL,
    "external_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "service" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "clinic_id" INTEGER,
    "landing_path" VARCHAR(255),
    "package_slug" VARCHAR(80),
    "utm_source" VARCHAR(255),
    "utm_medium" VARCHAR(255),
    "utm_campaign" VARCHAR(255),
    "utm_term" VARCHAR(255),
    "utm_content" VARCHAR(255),
    "source" VARCHAR(40) NOT NULL DEFAULT 'sqlite',
    "captured_at" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "leads_external_id_key" ON "leads"("external_id");
CREATE INDEX IF NOT EXISTS "leads_phone_idx" ON "leads"("phone");
CREATE INDEX IF NOT EXISTS "leads_clinic_id_idx" ON "leads"("clinic_id");
CREATE INDEX IF NOT EXISTS "leads_captured_at_idx" ON "leads"("captured_at");

ALTER TABLE "leads" ADD CONSTRAINT "leads_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
