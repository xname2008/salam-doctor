'use strict';

// Seed reference data: Shiraz districts + a small hierarchical service tree.
// Run:  node prisma/seed.js   (or wire into package.json "prisma": { "seed": ... })

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DISTRICTS = [
  { name: 'معالی‌آباد', slug: 'maaliabad' },
  { name: 'عفیف‌آباد', slug: 'afifabad' },
  { name: 'قصرالدشت', slug: 'qasrodasht' },
  { name: 'زند', slug: 'zand' },
  { name: 'ستارخان', slug: 'sattarkhan' },
  { name: 'فرهنگ‌شهر', slug: 'farhangshahr' },
];

// [parent, [children...]] — demonstrates the self-referencing hierarchy.
const SERVICE_TREE = [
  {
    parent: { serviceName: 'پوست و مو', slug: 'dermatology', basePrice: null },
    children: [
      { serviceName: 'کاشت مو', slug: 'hair-transplant', basePrice: 25000000 },
      { serviceName: 'کاشت ابرو', slug: 'eyebrow-transplant', basePrice: 12000000 },
      { serviceName: 'جوانسازی پوست', slug: 'skin-rejuvenation', basePrice: 4000000 },
    ],
  },
  {
    parent: { serviceName: 'لیزر و جراحی', slug: 'laser-surgery', basePrice: null },
    children: [
      { serviceName: 'لیزر موهای زائد', slug: 'laser-hair-removal', basePrice: 1500000 },
      { serviceName: 'جراحی زیبایی', slug: 'cosmetic-surgery', basePrice: 60000000 },
    ],
  },
  {
    parent: { serviceName: 'تناسب اندام', slug: 'body-contouring', basePrice: null },
    children: [
      { serviceName: 'لاغری و پیکرتراشی', slug: 'slimming', basePrice: 8000000 },
    ],
  },
];

async function main() {
  for (const d of DISTRICTS) {
    await prisma.district.upsert({
      where: { slug: d.slug },
      update: { name: d.name },
      create: d,
    });
  }

  for (const group of SERVICE_TREE) {
    const parent = await prisma.service.upsert({
      where: { slug: group.parent.slug },
      update: { serviceName: group.parent.serviceName },
      create: group.parent,
    });

    for (const child of group.children) {
      await prisma.service.upsert({
        where: { slug: child.slug },
        update: { serviceName: child.serviceName, basePrice: child.basePrice, parentId: parent.id },
        create: { ...child, parentId: parent.id },
      });
    }
  }

  console.log('Seed complete: districts + hierarchical services.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
