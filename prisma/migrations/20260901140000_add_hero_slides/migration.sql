-- Hero slides for dynamic homepage / VIP clinic promotional media
CREATE TYPE "HeroMediaType" AS ENUM ('VIDEO', 'IMAGE');

CREATE TABLE IF NOT EXISTS "hero_slides" (
    "id" TEXT NOT NULL,
    "media_url" VARCHAR(500) NOT NULL,
    "media_type" "HeroMediaType" NOT NULL,
    "title" VARCHAR(200),
    "cta_link" VARCHAR(500),
    "slide_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "hero_slides_is_active_slide_order_idx" ON "hero_slides"("is_active", "slide_order");
