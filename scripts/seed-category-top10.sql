-- Seed category top clinics with the real contracted clinic only (Nahal / 114).
DELETE FROM category_top_clinics;

INSERT INTO category_top_clinics (id, category_id, clinic_id, rank, name, tagline, image, link, badge, active, clicks, created_at) VALUES
('cat-hair-r1-seed', 'hair', 114, 1, 'کلینیک نهال', 'کلینیک کاشت مو،پوست،لیزر و زیبایی', 'clinics/114/Hero.webp', '/doctor/nahal-clinic', 'ویژه', 1, 0, datetime('now')),
('cat-skin-r1-seed', 'skin', 114, 1, 'کلینیک نهال', 'کلینیک کاشت مو،پوست،لیزر و زیبایی', 'clinics/114/Hero.webp', '/doctor/nahal-clinic', 'ویژه', 1, 0, datetime('now')),
('cat-laser-r1-seed', 'laser', 114, 1, 'کلینیک نهال', 'کلینیک کاشت مو،پوست،لیزر و زیبایی', 'clinics/114/Hero.webp', '/doctor/nahal-clinic', 'ویژه', 1, 0, datetime('now')),
('cat-injection-r1-seed', 'injection', 114, 1, 'کلینیک نهال', 'کلینیک کاشت مو،پوست،لیزر و زیبایی', 'clinics/114/Hero.webp', '/doctor/nahal-clinic', 'ویژه', 1, 0, datetime('now'));
