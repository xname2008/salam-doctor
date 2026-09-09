FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY server.js doctorProfileRouter.js clinicSlug.js serviceSlugMap.js faqPageJsonLd.js \
     seoInfra.js breadcrumb.js persianDate.js articleCatalog.js staticArticles.js ./
COPY jsonLdMedicalEntity.js local-seo-registry.js htmlSitemap.js blogBreadcrumb.js blogSiloApi.js \
     heroSlides.js syncWorker.js commercialLandingLeads.js commercialLandingRouter.js \
     commercialLandingSkag.js commercial-landing-config.js \
     seoRouter.js searchRouter.js search-index.js DirectoryRepository.js \
     articleTemplate.js blogArticles.js uploadApp.js seo-config.js \
     categoryMonetize.js serviceLanding.js siteSettings.js \
     hub-slugs.js leads.json data.min.js \
     profile.html blog-list.html blog-post.html category.html \
     hair-transplant.html skin-rejuvenation.html laser-hair.html injection.html \
     cosmetic-surgery.html slimming.html rhinoplasty.html lasik.html femto-lasik.html prk.html \
     products.html pharmacy.html eye.html ./
COPY data ./data
COPY articles ./articles
COPY utils ./utils
COPY views ./views
COPY public/uploads ./public/uploads
COPY prisma/seed.js ./prisma/seed.js
COPY scripts/reset-featured-slots.js scripts/gtm-snippets.js ./scripts/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
