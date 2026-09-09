-- AlterTable: Rubika / Bale title + link fields on clinics
ALTER TABLE "clinics" ADD COLUMN "rubika_title" VARCHAR(120);
ALTER TABLE "clinics" ADD COLUMN "rubika_link" VARCHAR(500);
ALTER TABLE "clinics" ADD COLUMN "bale_title" VARCHAR(120);
ALTER TABLE "clinics" ADD COLUMN "bale_link" VARCHAR(500);
