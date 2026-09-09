-- Unique SEO slug for clinic/doctor profile URLs (/doctor/:slug)
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(220);

UPDATE "clinics"
SET "slug" = 'clinic-' || "id"::text
WHERE "slug" IS NULL OR btrim("slug") = '';

CREATE UNIQUE INDEX IF NOT EXISTS "clinics_slug_key" ON "clinics"("slug");
CREATE INDEX IF NOT EXISTS "clinics_slug_idx" ON "clinics"("slug");

ALTER TABLE "clinics" ALTER COLUMN "slug" SET NOT NULL;
