-- ==========================================================================
-- Salam-Doctor — initial schema (PostgreSQL)
-- Equivalent to prisma/schema.prisma. Run standalone or via `prisma migrate`.
-- ==========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Enum types
-- --------------------------------------------------------------------------
CREATE TYPE "ContractStatus"     AS ENUM ('ACTIVE', 'EXPIRED');
CREATE TYPE "DeviceType"         AS ENUM ('LASER', 'HIFU', 'ENDOLIFT', 'OTHER');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED');

-- --------------------------------------------------------------------------
-- districts
-- --------------------------------------------------------------------------
CREATE TABLE "districts" (
  "id"         SERIAL       PRIMARY KEY,
  "name"       VARCHAR(120) NOT NULL,
  "slug"       VARCHAR(140) NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "districts_name_key" UNIQUE ("name"),
  CONSTRAINT "districts_slug_key" UNIQUE ("slug")
);
CREATE INDEX "districts_slug_idx" ON "districts" ("slug");

-- --------------------------------------------------------------------------
-- clinics (clinics / doctors + subscription contract)
-- --------------------------------------------------------------------------
CREATE TABLE "clinics" (
  "id"                       SERIAL           PRIMARY KEY,
  "name"                     VARCHAR(200)     NOT NULL,
  "license_number"           VARCHAR(80)      NOT NULL,
  "phone"                    VARCHAR(40)      NOT NULL,
  "biography"                TEXT,
  "full_address"             TEXT             NOT NULL,
  "latitude"                 DECIMAL(9, 6),
  "longitude"                DECIMAL(9, 6),
  "contract_status"          "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
  "contract_duration_months" INTEGER          NOT NULL DEFAULT 14,
  "start_date"               DATE,
  "end_date"                 DATE,
  "has_dedicated_website"    BOOLEAN          NOT NULL DEFAULT false,
  "dedicated_domain"         VARCHAR(255),
  "created_at"               TIMESTAMPTZ      NOT NULL DEFAULT now(),
  "updated_at"               TIMESTAMPTZ      NOT NULL DEFAULT now(),
  "district_id"              INTEGER,
  CONSTRAINT "clinics_license_number_key"   UNIQUE ("license_number"),
  CONSTRAINT "clinics_dedicated_domain_key" UNIQUE ("dedicated_domain"),
  CONSTRAINT "clinics_district_id_fkey"
    FOREIGN KEY ("district_id") REFERENCES "districts" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "clinics_district_id_idx"              ON "clinics" ("district_id");
CREATE INDEX "clinics_contract_status_idx"          ON "clinics" ("contract_status");
CREATE INDEX "clinics_contract_status_end_date_idx" ON "clinics" ("contract_status", "end_date");

-- --------------------------------------------------------------------------
-- medical_devices (core revenue feature)
-- --------------------------------------------------------------------------
CREATE TABLE "medical_devices" (
  "id"                  SERIAL               PRIMARY KEY,
  "brand_name"          VARCHAR(150)         NOT NULL,
  "device_type"         "DeviceType"         NOT NULL,
  "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "created_at"          TIMESTAMPTZ          NOT NULL DEFAULT now(),
  CONSTRAINT "medical_devices_brand_type_key" UNIQUE ("brand_name", "device_type")
);
CREATE INDEX "medical_devices_verification_status_idx" ON "medical_devices" ("verification_status");
CREATE INDEX "medical_devices_device_type_idx"         ON "medical_devices" ("device_type");

-- --------------------------------------------------------------------------
-- clinic_devices (pivot: clinics <-> medical_devices)
-- --------------------------------------------------------------------------
CREATE TABLE "clinic_devices" (
  "id"                 SERIAL      PRIMARY KEY,
  "clinic_id"          INTEGER     NOT NULL,
  "device_id"          INTEGER     NOT NULL,
  "is_authentic_badge" BOOLEAN     NOT NULL DEFAULT false,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "clinic_devices_clinic_device_key" UNIQUE ("clinic_id", "device_id"),
  CONSTRAINT "clinic_devices_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "clinic_devices_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "medical_devices" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "clinic_devices_clinic_id_idx" ON "clinic_devices" ("clinic_id");
CREATE INDEX "clinic_devices_device_id_idx" ON "clinic_devices" ("device_id");

-- --------------------------------------------------------------------------
-- services (hierarchical SEO tree, self-referencing parent_id)
-- --------------------------------------------------------------------------
CREATE TABLE "services" (
  "id"           SERIAL         PRIMARY KEY,
  "parent_id"    INTEGER,
  "service_name" VARCHAR(200)   NOT NULL,
  "slug"         VARCHAR(220)   NOT NULL,
  "base_price"   DECIMAL(12, 2),
  "created_at"   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT "services_slug_key" UNIQUE ("slug"),
  CONSTRAINT "services_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "services" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "services_slug_idx"      ON "services" ("slug");
CREATE INDEX "services_parent_id_idx" ON "services" ("parent_id");

-- --------------------------------------------------------------------------
-- clinic_services (pivot: clinics <-> services, optional price override)
-- --------------------------------------------------------------------------
CREATE TABLE "clinic_services" (
  "id"           SERIAL         PRIMARY KEY,
  "clinic_id"    INTEGER        NOT NULL,
  "service_id"   INTEGER        NOT NULL,
  "custom_price" DECIMAL(12, 2),
  "created_at"   TIMESTAMPTZ    NOT NULL DEFAULT now(),
  CONSTRAINT "clinic_services_clinic_service_key" UNIQUE ("clinic_id", "service_id"),
  CONSTRAINT "clinic_services_clinic_id_fkey"
    FOREIGN KEY ("clinic_id") REFERENCES "clinics" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "clinic_services_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "clinic_services_clinic_id_idx"  ON "clinic_services" ("clinic_id");
CREATE INDEX "clinic_services_service_id_idx" ON "clinic_services" ("service_id");

-- --------------------------------------------------------------------------
-- Keep clinics.updated_at fresh on UPDATE
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "clinics_set_updated_at"
  BEFORE UPDATE ON "clinics"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
