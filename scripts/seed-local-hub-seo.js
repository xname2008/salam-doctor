#!/usr/bin/env node
'use strict';

/**
 * Upsert rich city+service SEO copy into local_hub_seo (thin-content fix).
 *
 * Usage:
 *   node scripts/seed-local-hub-seo.js
 *   node scripts/seed-local-hub-seo.js --dry-run
 */

const { PrismaClient } = require('@prisma/client');

const ENTRIES = [
  {
    citySlug: 'shiraz',
    serviceSlug: 'botox',
    h1Title: 'بهترین مراکز تزریق بوتاکس در شیراز',
    metaTitle: 'بوتاکس در شیراز | لیست مراکز معتبر + رزرو نوبت | سلام دکتر',
    metaDescription:
      'لیست بهترین مراکز تزریق بوتاکس در شیراز. مقایسه کلینیک‌های معتبر، مشاهده آدرس و درخواست مشاوره رایگان از سلام دکتر.',
    seoDescription: `
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
`.trim(),
  },
  {
    citySlug: 'shiraz',
    serviceSlug: 'hair-transplant',
    h1Title: 'بهترین مراکز کاشت مو در شیراز',
    metaTitle: 'کاشت مو در شیراز | لیست کلینیک‌های معتبر + مشاوره | سلام دکتر',
    metaDescription:
      'معرفی بهترین مراکز کاشت مو در شیراز با امکان مقایسه روش‌ها، قیمت تقریبی و رزرو مشاوره رایگان.',
    seoDescription: `
<p><strong>کاشت مو در شیراز</strong> یکی از پرتقاضاترین خدمات زیبایی است. انتخاب کلینیک با تیم مجرب، تراکم مناسب گرافت و پیگیری پس از عمل، نتیجه طبیعی‌تری می‌سازد.</p>
<h2>نکات مهم قبل از کاشت مو</h2>
<ul>
  <li>مشاوره حضوری و بررسی بانک مو</li>
  <li>آشنایی با روش‌های FIT / FUE و Micro FIT</li>
  <li>بررسی نمونه‌کارهای واقعی همان مرکز</li>
  <li>برنامه مراقبت و داروهای پس از عمل</li>
</ul>
<p>در فهرست زیر، مراکز فعال شیراز را مقایسه کنید و برای راهنمایی رایگان با سلام دکتر تماس بگیرید.</p>
`.trim(),
  },
];

async function main() {
  const dry = process.argv.includes('--dry-run');
  const prisma = new PrismaClient();
  try {
    for (const entry of ENTRIES) {
      const service = await prisma.service.findUnique({ where: { slug: entry.serviceSlug } });
      console.log(
        `${dry ? '[dry] ' : ''}${entry.citySlug}/${entry.serviceSlug}` +
          (service ? ` (service#${service.id})` : ' (service missing)')
      );
      if (dry) continue;
      await prisma.localHubSeo.upsert({
        where: {
          citySlug_serviceSlug: {
            citySlug: entry.citySlug,
            serviceSlug: entry.serviceSlug,
          },
        },
        update: {
          h1Title: entry.h1Title,
          seoDescription: entry.seoDescription,
          metaTitle: entry.metaTitle,
          metaDescription: entry.metaDescription,
          serviceId: service ? service.id : null,
          isPublished: true,
        },
        create: {
          citySlug: entry.citySlug,
          serviceSlug: entry.serviceSlug,
          h1Title: entry.h1Title,
          seoDescription: entry.seoDescription,
          metaTitle: entry.metaTitle,
          metaDescription: entry.metaDescription,
          serviceId: service ? service.id : null,
          isPublished: true,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
