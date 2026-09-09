-- =============================================================================
-- Salam-Doctor — Initial Schema Migration
-- Dialect: PostgreSQL 14+
-- Equivalent to Prisma schema in ../prisma/schema.prisma
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE contract_status AS ENUM ('ACTIVE', 'EXPIRED');
CREATE TYPE device_type AS ENUM ('LASER', 'HIFU', 'ENDOLIFT', 'OTHER');
CREATE TYPE verification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ---------------------------------------------------------------------------
-- districts (Hyper-local Shiraz SEO)
-- ---------------------------------------------------------------------------

CREATE TABLE districts (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  slug       VARCHAR(140) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_districts_name UNIQUE (name),
  CONSTRAINT uq_districts_slug UNIQUE (slug)
);

CREATE INDEX idx_districts_slug ON districts (slug);

-- ---------------------------------------------------------------------------
-- clinics (Doctors / Centers + subscription fields)
-- ---------------------------------------------------------------------------

CREATE TABLE clinics (
  id                        SERIAL PRIMARY KEY,
  name                      VARCHAR(200)     NOT NULL,
  license_number            VARCHAR(80)      NOT NULL,
  phone                     VARCHAR(40)      NOT NULL,
  biography                 TEXT,
  full_address              TEXT             NOT NULL,
  latitude                  DECIMAL(10, 7)   NOT NULL,
  longitude                 DECIMAL(10, 7)   NOT NULL,

  -- Subscription / contract
  contract_status           contract_status  NOT NULL DEFAULT 'ACTIVE',
  contract_duration_months  INTEGER          NOT NULL DEFAULT 14,
  start_date                DATE             NOT NULL,
  end_date                  DATE             NOT NULL,

  -- Dedicated microsite upsell
  has_dedicated_website     BOOLEAN          NOT NULL DEFAULT FALSE,
  dedicated_domain          VARCHAR(255),

  -- Hyper-local FK
  district_id               INTEGER          NOT NULL,

  created_at                TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_clinics_license_number UNIQUE (license_number),
  CONSTRAINT fk_clinics_district
    FOREIGN KEY (district_id) REFERENCES districts (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT chk_clinics_contract_dates
    CHECK (end_date >= start_date),
  CONSTRAINT chk_clinics_duration
    CHECK (contract_duration_months > 0)
);

CREATE INDEX idx_clinics_district_id      ON clinics (district_id);
CREATE INDEX idx_clinics_contract_status  ON clinics (contract_status);
CREATE INDEX idx_clinics_end_date         ON clinics (end_date);
CREATE INDEX idx_clinics_name             ON clinics (name);

-- ---------------------------------------------------------------------------
-- medical_devices (Candela, Cynosure, Doublo, …)
-- ---------------------------------------------------------------------------

CREATE TABLE medical_devices (
  id                   SERIAL PRIMARY KEY,
  brand_name           VARCHAR(120)         NOT NULL,
  device_type          device_type          NOT NULL,
  model_name           VARCHAR(120),
  verification_status  verification_status  NOT NULL DEFAULT 'PENDING',
  created_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_medical_devices_brand_type_model
    UNIQUE (brand_name, device_type, model_name)
);

CREATE INDEX idx_medical_devices_type   ON medical_devices (device_type);
CREATE INDEX idx_medical_devices_status ON medical_devices (verification_status);

-- ---------------------------------------------------------------------------
-- clinic_devices (M:N pivot + authenticity badge)
-- ---------------------------------------------------------------------------

CREATE TABLE clinic_devices (
  id                  SERIAL PRIMARY KEY,
  clinic_id           INTEGER      NOT NULL,
  device_id           INTEGER      NOT NULL,
  is_authentic_badge  BOOLEAN      NOT NULL DEFAULT FALSE,
  certified_at        TIMESTAMPTZ,
  notes               TEXT,

  CONSTRAINT uq_clinic_devices UNIQUE (clinic_id, device_id),
  CONSTRAINT fk_clinic_devices_clinic
    FOREIGN KEY (clinic_id) REFERENCES clinics (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_clinic_devices_device
    FOREIGN KEY (device_id) REFERENCES medical_devices (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX idx_clinic_devices_clinic_id ON clinic_devices (clinic_id);
CREATE INDEX idx_clinic_devices_device_id ON clinic_devices (device_id);
CREATE INDEX idx_clinic_devices_badge     ON clinic_devices (is_authentic_badge);

-- ---------------------------------------------------------------------------
-- services (Hierarchical SEO: parent_id self-reference)
-- ---------------------------------------------------------------------------

CREATE TABLE services (
  id            SERIAL PRIMARY KEY,
  parent_id     INTEGER,
  service_name  VARCHAR(180)    NOT NULL,
  slug          VARCHAR(200)    NOT NULL,
  base_price    DECIMAL(12, 2),
  description   TEXT,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
  sort_order    INTEGER         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_services_slug UNIQUE (slug),
  CONSTRAINT fk_services_parent
    FOREIGN KEY (parent_id) REFERENCES services (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX idx_services_slug      ON services (slug);
CREATE INDEX idx_services_parent_id ON services (parent_id);
CREATE INDEX idx_services_is_active ON services (is_active);

-- ---------------------------------------------------------------------------
-- clinic_services (M:N pivot)
-- ---------------------------------------------------------------------------

CREATE TABLE clinic_services (
  id            SERIAL PRIMARY KEY,
  clinic_id     INTEGER         NOT NULL,
  service_id    INTEGER         NOT NULL,
  custom_price  DECIMAL(12, 2),
  is_featured   BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_clinic_services UNIQUE (clinic_id, service_id),
  CONSTRAINT fk_clinic_services_clinic
    FOREIGN KEY (clinic_id) REFERENCES clinics (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_clinic_services_service
    FOREIGN KEY (service_id) REFERENCES services (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX idx_clinic_services_clinic_id  ON clinic_services (clinic_id);
CREATE INDEX idx_clinic_services_service_id ON clinic_services (service_id);

COMMIT;
