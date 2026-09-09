-- Ensure clean, concise SEO slugs (not long transliterations).
-- Nahal Clinic: canonical /doctor/nahal-clinic

UPDATE "clinics"
SET
  "slug" = 'nahal-clinic',
  "english_name" = COALESCE(NULLIF(btrim("english_name"), ''), 'Nahal Clinic')
WHERE "id" = 114;

-- Keep english_name for any clinic that already has a short brand slug
UPDATE "clinics"
SET "english_name" = 'Nahal Clinic'
WHERE "id" = 114
  AND ("english_name" IS NULL OR btrim("english_name") = '');
