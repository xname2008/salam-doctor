/**
 * Salam-Doctor — Prisma seed script
 * Usage: npx prisma db seed
 */

import { PrismaClient, DeviceType, VerificationStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const districts = [
    { name: 'معالی‌آباد', slug: 'maaliabad' },
    { name: 'عفیف‌آباد', slug: 'afifabad' },
    { name: 'قصرالدشت', slug: 'ghasrodasht' },
    { name: 'زند', slug: 'zand' },
    { name: 'ستارخان', slug: 'sattarkhan' },
    { name: 'قدوسی غربی', slug: 'ghodosi-gharbi' },
    { name: 'فرهنگ‌شهر', slug: 'farhangshahr' },
    { name: 'شهرک گلستان', slug: 'shahrak-golestan' },
    { name: 'چمران', slug: 'chamran' },
    { name: 'آزادی', slug: 'azadi' },
  ];

  for (const d of districts) {
    await prisma.district.upsert({
      where: { slug: d.slug },
      update: { name: d.name },
      create: d,
    });
  }

  const dermatology = await prisma.service.upsert({
    where: { slug: 'dermatology' },
    update: {},
    create: { serviceName: 'پوست و مو', slug: 'dermatology', sortOrder: 1 },
  });

  const laserSurgery = await prisma.service.upsert({
    where: { slug: 'laser-surgery' },
    update: {},
    create: { serviceName: 'لیزر و جراحی', slug: 'laser-surgery', sortOrder: 2 },
  });

  const slimming = await prisma.service.upsert({
    where: { slug: 'slimming' },
    update: {},
    create: { serviceName: 'تناسب اندام', slug: 'slimming', sortOrder: 3 },
  });

  const childServices = [
    { parentId: dermatology.id, serviceName: 'کاشت مو و ابرو', slug: 'hair-transplant', basePrice: 45000000, sortOrder: 1 },
    { parentId: dermatology.id, serviceName: 'جوانسازی و پوست', slug: 'skin-rejuvenation', basePrice: 3500000, sortOrder: 2 },
    { parentId: dermatology.id, serviceName: 'تزریقات زیبایی', slug: 'beauty-injections', basePrice: 2800000, sortOrder: 3 },
    { parentId: laserSurgery.id, serviceName: 'لیزر موهای زائد', slug: 'laser-hair-removal', basePrice: 1200000, sortOrder: 1 },
    { parentId: laserSurgery.id, serviceName: 'جراحی زیبایی', slug: 'cosmetic-surgery', basePrice: 25000000, sortOrder: 2 },
    { parentId: slimming.id, serviceName: 'لاغری و پیکرتراشی', slug: 'body-contouring', basePrice: 8000000, sortOrder: 1 },
  ];

  for (const s of childServices) {
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: {
        parentId: s.parentId,
        serviceName: s.serviceName,
        basePrice: s.basePrice,
        sortOrder: s.sortOrder,
      },
      create: s,
    });
  }

  const devices = [
    { brandName: 'Candela', deviceType: DeviceType.LASER, modelName: 'GentleMax Pro', verificationStatus: VerificationStatus.APPROVED },
    { brandName: 'Cynosure', deviceType: DeviceType.LASER, modelName: 'Elite iQ', verificationStatus: VerificationStatus.APPROVED },
    { brandName: 'Doublo', deviceType: DeviceType.HIFU, modelName: 'S', verificationStatus: VerificationStatus.APPROVED },
    { brandName: 'Fotona', deviceType: DeviceType.LASER, modelName: 'SP Dynamis', verificationStatus: VerificationStatus.APPROVED },
    { brandName: 'Quanta', deviceType: DeviceType.ENDOLIFT, modelName: 'YouLaser MT', verificationStatus: VerificationStatus.PENDING },
    { brandName: 'Titanium', deviceType: DeviceType.LASER, modelName: '2023', verificationStatus: VerificationStatus.APPROVED },
  ];

  for (const device of devices) {
    await prisma.medicalDevice.upsert({
      where: {
        brandName_deviceType_modelName: {
          brandName: device.brandName,
          deviceType: device.deviceType,
          modelName: device.modelName,
        },
      },
      update: { verificationStatus: device.verificationStatus },
      create: device,
    });
  }

  // Sample clinic in معالی‌آباد with authentic Candela badge
  const maaliabad = await prisma.district.findUniqueOrThrow({ where: { slug: 'maaliabad' } });
  const candela = await prisma.medicalDevice.findFirstOrThrow({
    where: { brandName: 'Candela', modelName: 'GentleMax Pro' },
  });
  const hairTx = await prisma.service.findUniqueOrThrow({ where: { slug: 'hair-transplant' } });

  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 14);

  const clinic = await prisma.clinic.upsert({
    where: { licenseNumber: 'SHZ-DEMO-001' },
    update: {},
    create: {
      name: 'کلینیک نمونه سلام دکتر',
      licenseNumber: 'SHZ-DEMO-001',
      phone: '07136340000',
      biography: 'کلینیک نمونه برای تست اسکیما و جریان رزرو.',
      fullAddress: 'شیراز، معالی‌آباد، خیابان نمونه',
      latitude: 29.6700000,
      longitude: 52.4500000,
      contractStatus: 'ACTIVE',
      contractDurationMonths: 14,
      startDate: start,
      endDate: end,
      hasDedicatedWebsite: true,
      dedicatedDomain: 'demo.salamdoctor.ir',
      districtId: maaliabad.id,
    },
  });

  await prisma.clinicDevice.upsert({
    where: { clinicId_deviceId: { clinicId: clinic.id, deviceId: candela.id } },
    update: { isAuthenticBadge: true },
    create: {
      clinicId: clinic.id,
      deviceId: candela.id,
      isAuthenticBadge: true,
      certifiedAt: new Date(),
    },
  });

  await prisma.clinicService.upsert({
    where: { clinicId_serviceId: { clinicId: clinic.id, serviceId: hairTx.id } },
    update: { isFeatured: true },
    create: {
      clinicId: clinic.id,
      serviceId: hairTx.id,
      customPrice: 42000000,
      isFeatured: true,
    },
  });

  console.log('Seed completed: districts, services, devices, demo clinic.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
