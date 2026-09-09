-- Blog articles (PostgreSQL) for SEO /blog routes
CREATE TABLE IF NOT EXISTS "articles" (
    "id" SERIAL NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "meta_description" VARCHAR(320),
    "content" TEXT NOT NULL,
    "featured_image_url" VARCHAR(500),
    "author_name" VARCHAR(160) NOT NULL DEFAULT 'تیم سلام دکتر',
    "author_credentials" VARCHAR(400),
    "related_service_slug" VARCHAR(220),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "articles_slug_key" ON "articles"("slug");
CREATE INDEX IF NOT EXISTS "articles_created_at_idx" ON "articles"("created_at");
CREATE INDEX IF NOT EXISTS "articles_related_service_slug_idx" ON "articles"("related_service_slug");
