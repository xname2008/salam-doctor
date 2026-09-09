-- =============================================================================
-- Salam-Doctor — Seed: Shiraz districts + sample hierarchy / devices
-- Run AFTER 001_init_schema.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Shiraz hyper-local districts (SEO anchors)
-- ---------------------------------------------------------------------------

INSERT INTO districts (name, slug) VALUES
  ('معالی‌آباد',   'maaliabad'),
  ('عفیف‌آباد',    'afifabad'),
  ('قصرالدشت',     'ghasrodasht'),
  ('زند',          'zand'),
  ('ستارخان',      'sattarkhan'),
  ('قدوسی غربی',   'ghodosi-gharbi'),
  ('فرهنگ‌شهر',    'farhangshahr'),
  ('شهرک گلستان',  'shahrak-golestan'),
  ('چمران',        'chamran'),
  ('آزادی',        'azadi');

-- ---------------------------------------------------------------------------
-- Service hierarchy (parent → children)
-- ---------------------------------------------------------------------------

INSERT INTO services (parent_id, service_name, slug, base_price, sort_order) VALUES
  (NULL, 'پوست و مو',           'dermatology',          NULL, 1),
  (NULL, 'لیزر و جراحی',        'laser-surgery',        NULL, 2),
  (NULL, 'تناسب اندام',         'slimming',             NULL, 3);

-- Children of پوست و مو (id = 1)
INSERT INTO services (parent_id, service_name, slug, base_price, sort_order) VALUES
  (1, 'کاشت مو و ابرو',        'hair-transplant',      45000000, 1),
  (1, 'جوانسازی و پوست',       'skin-rejuvenation',    3500000,  2),
  (1, 'تزریقات زیبایی',        'beauty-injections',    2800000,  3);

-- Children of لیزر و جراحی (id = 2)
INSERT INTO services (parent_id, service_name, slug, base_price, sort_order) VALUES
  (2, 'لیزر موهای زائد',       'laser-hair-removal',   1200000,  1),
  (2, 'جراحی زیبایی',          'cosmetic-surgery',     25000000, 2);

-- Children of تناسب اندام (id = 3)
INSERT INTO services (parent_id, service_name, slug, base_price, sort_order) VALUES
  (3, 'لاغری و پیکرتراشی',     'body-contouring',      8000000,  1);

-- ---------------------------------------------------------------------------
-- Certified medical devices catalogue
-- ---------------------------------------------------------------------------

INSERT INTO medical_devices (brand_name, device_type, model_name, verification_status) VALUES
  ('Candela',   'LASER',    'GentleMax Pro',  'APPROVED'),
  ('Cynosure',  'LASER',    'Elite iQ',       'APPROVED'),
  ('Doublo',    'HIFU',     'S',              'APPROVED'),
  ('Fotona',    'LASER',    'SP Dynamis',     'APPROVED'),
  ('Quanta',    'ENDOLIFT', 'YouLaser MT',    'PENDING'),
  ('Titanium',  'LASER',    '2023',           'APPROVED');

COMMIT;
