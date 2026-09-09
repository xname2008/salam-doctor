FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY server.js seoRouter.js DirectoryRepository.js articleTemplate.js seo-config.js leads.json data.min.js profile.html ./
COPY views ./views
COPY prisma/seed.js ./prisma/seed.js
COPY scripts/reset-featured-slots.js ./scripts/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
