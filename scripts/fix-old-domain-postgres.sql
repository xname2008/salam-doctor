-- Rewrites any hardcoded old .ir domain to the new .com domain across the
-- Prisma/Postgres schema's link-bearing columns (Clinic + Article models).
-- schema.prisma has no Banner/Ad/Slider model — those live in SQLite
-- (leads.db, tables `ads` + `featured_clinics`); see fix-old-domain-sqlite.js.

BEGIN;

UPDATE clinics
SET
  dedicated_domain = REPLACE(dedicated_domain, 'salam-doctor.ir', 'salam-doctor.com'),
  rubika_link       = REPLACE(rubika_link, 'salam-doctor.ir', 'salam-doctor.com'),
  bale_link         = REPLACE(bale_link, 'salam-doctor.ir', 'salam-doctor.com')
WHERE dedicated_domain ILIKE '%salam-doctor.ir%'
   OR rubika_link ILIKE '%salam-doctor.ir%'
   OR bale_link ILIKE '%salam-doctor.ir%';

UPDATE articles
SET
  featured_image_url = REPLACE(featured_image_url, 'salam-doctor.ir', 'salam-doctor.com'),
  content             = REPLACE(content, 'salam-doctor.ir', 'salam-doctor.com')
WHERE featured_image_url ILIKE '%salam-doctor.ir%'
   OR content ILIKE '%salam-doctor.ir%';

COMMIT;
