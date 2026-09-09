-- AlterTable: department consultation fields on clinics
ALTER TABLE "clinics" ADD COLUMN "dept1_title" VARCHAR(200);
ALTER TABLE "clinics" ADD COLUMN "dept1_phone" VARCHAR(40);
ALTER TABLE "clinics" ADD COLUMN "dept1_whatsapp" VARCHAR(40);
ALTER TABLE "clinics" ADD COLUMN "dept2_title" VARCHAR(200);
ALTER TABLE "clinics" ADD COLUMN "dept2_phone" VARCHAR(40);
ALTER TABLE "clinics" ADD COLUMN "dept2_whatsapp" VARCHAR(40);
