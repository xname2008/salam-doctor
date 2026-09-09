-- Optional Latin brand name for clean /doctor/:slug generation
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "english_name" VARCHAR(120);

UPDATE "clinics"
SET "english_name" = 'Nahal Clinic'
WHERE "id" = 114
  AND ("english_name" IS NULL OR btrim("english_name") = '');

-- Prefer clean brand slug when still on placeholder clinic-{id}
UPDATE "clinics"
SET "slug" = 'nahal-clinic'
WHERE "id" = 114
  AND ("slug" IS NULL OR btrim("slug") = '' OR "slug" = 'clinic-114' OR "slug" LIKE 'klynyk-%');
