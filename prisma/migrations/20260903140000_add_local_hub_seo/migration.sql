-- Rich SEO copy for city + service hub landings (/:city/:service)
CREATE TABLE IF NOT EXISTS "local_hub_seo" (
    "id" SERIAL NOT NULL,
    "city_slug" VARCHAR(80) NOT NULL,
    "service_slug" VARCHAR(220) NOT NULL,
    "service_id" INTEGER,
    "h1_title" VARCHAR(300) NOT NULL,
    "seo_description" TEXT NOT NULL,
    "meta_title" VARCHAR(300),
    "meta_description" VARCHAR(320),
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "local_hub_seo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "local_hub_seo_city_slug_service_slug_key"
  ON "local_hub_seo"("city_slug", "service_slug");

CREATE INDEX IF NOT EXISTS "local_hub_seo_city_slug_idx" ON "local_hub_seo"("city_slug");
CREATE INDEX IF NOT EXISTS "local_hub_seo_service_slug_idx" ON "local_hub_seo"("service_slug");
CREATE INDEX IF NOT EXISTS "local_hub_seo_service_id_idx" ON "local_hub_seo"("service_id");
CREATE INDEX IF NOT EXISTS "local_hub_seo_is_published_idx" ON "local_hub_seo"("is_published");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'local_hub_seo_service_id_fkey'
  ) THEN
    ALTER TABLE "local_hub_seo"
      ADD CONSTRAINT "local_hub_seo_service_id_fkey"
      FOREIGN KEY ("service_id") REFERENCES "services"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed example: Shiraz + botox (thin-content enrichment)
INSERT INTO "local_hub_seo" (
  "city_slug", "service_slug", "h1_title", "seo_description",
  "meta_title", "meta_description", "is_published"
)
SELECT
  'shiraz',
  'botox',
  'بهترین مراکز تزریق بوتاکس در شیراز',
  $html$
<p>اگر به‌دنبال <strong>بوتاکس در شیراز</strong> هستید، انتخاب مرکز معتبر با پزشک مجرب و مواد اصل اهمیت بالایی دارد. در این صفحه، مراکز فعال ارائه‌دهنده تزریق بوتاکس را کنار هم می‌بینید تا بتوانید بر اساس منطقه، امتیاز و تجهیزات تصمیم بگیرید.</p>
<p>بوتاکس معمولاً برای کاهش چین‌وچروک‌های دینامیک پیشانی، خط اخم و اطراف چشم استفاده می‌شود. نتیجه نهایی به دوز تزریق، آناتومی صورت و تجربه پزشک بستگی دارد؛ به همین دلیل مقایسه چند مرکز قبل از نوبت‌گیری توصیه می‌شود.</p>
<h2>چطور مرکز بوتاکس مناسب در شیراز انتخاب کنیم؟</h2>
<ul>
  <li>مجوز رسمی و حضور پزشک متخصص پوست یا جراح پلاستیک</li>
  <li>شفافیت قیمت و توضیح عوارض احتمالی قبل از تزریق</li>
  <li>نمونه‌کار واقعی و رضایت مراجعان</li>
  <li>دسترسی آسان به محله‌هایی مثل معالی‌آباد، عفیف‌آباد و قصرالدشت</li>
</ul>
<p>از طریق سلام دکتر می‌توانید پروفایل هر مرکز را ببینید و برای مشاوره رایگان اقدام کنید.</p>
$html$,
  'بوتاکس در شیراز | لیست مراکز معتبر + رزرو نوبت | سلام دکتر',
  'لیست بهترین مراکز تزریق بوتاکس در شیراز. مقایسه کلینیک‌های معتبر، مشاهده آدرس و درخواست مشاوره رایگان از سلام دکتر.',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "local_hub_seo"
  WHERE "city_slug" = 'shiraz' AND "service_slug" = 'botox'
);

UPDATE "local_hub_seo" lhs
SET "service_id" = s."id"
FROM "services" s
WHERE s."slug" = lhs."service_slug"
  AND lhs."service_id" IS NULL;
