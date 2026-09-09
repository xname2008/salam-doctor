-- Blog silo categories + article cluster fields
CREATE TABLE IF NOT EXISTS "blog_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "meta_title" VARCHAR(300),
    "meta_description" VARCHAR(320),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "blog_categories_slug_key" ON "blog_categories"("slug");
CREATE INDEX IF NOT EXISTS "blog_categories_slug_idx" ON "blog_categories"("slug");

ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "meta_title" VARCHAR(300);
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "author_id" VARCHAR(64);
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "category_id" INTEGER;
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3);
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "articles_published_at_idx" ON "articles"("published_at");
CREATE INDEX IF NOT EXISTS "articles_category_id_idx" ON "articles"("category_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_category_id_fkey'
  ) THEN
    ALTER TABLE "articles"
      ADD CONSTRAINT "articles_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill publish date for legacy rows
UPDATE "articles" SET "published_at" = "created_at" WHERE "published_at" IS NULL;
