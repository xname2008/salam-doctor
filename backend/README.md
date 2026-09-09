# Salam-Doctor — Database Schema

**ORM:** Prisma  
**Primary DB:** PostgreSQL 14+  
**Also provided:** Raw SQL migrations (MySQL-portable patterns noted below)

---

## Entity Relationship Overview

```
District 1 ──< Clinic >── M:N ── MedicalDevice
                 │
                 └── M:N ── Service (self-referential tree via parent_id)
```

| Entity | Purpose |
|--------|---------|
| `districts` | Hyper-local Shiraz SEO (معالی‌آباد، عفیف‌آباد، …) |
| `clinics` | Doctors/centers + **14-month subscription** + dedicated website upsell |
| `medical_devices` | Certified equipment catalogue (Candela, Cynosure, Doublo, …) |
| `clinic_devices` | M:N pivot with **`is_authentic_badge`** (revenue trust signal) |
| `services` | Hierarchical SEO tree (`parent_id`) |
| `clinic_services` | M:N pivot with optional `custom_price` |

---

## Cascade / FK Policy

| Relation | On Delete | Why |
|----------|-----------|-----|
| Clinic → District | **RESTRICT** | Never orphan clinics; reassign district first |
| ClinicDevice → Clinic / Device | **CASCADE** | Pivot rows die with either side |
| ClinicService → Clinic / Service | **CASCADE** | Same |
| Service → Parent Service | **RESTRICT** | Prevent accidental deletion of a parent category that still has children |

---

## Indexes (search-critical)

- `districts.slug`
- `clinics.district_id`, `clinics.contract_status`, `clinics.end_date`
- `services.slug`, `services.parent_id`
- `clinic_devices.is_authentic_badge`
- Unique: `clinics.license_number`, `services.slug`, pivot composites

---

## Quick Start (Prisma)

**Use the project-root Prisma folder only** (`../prisma/`), not this `backend/prisma/` directory.

```bash
cd ..                    # project root
cp .env.example .env     # set DATABASE_URL
npm install
npx prisma migrate deploy
# disposable/dev DB only:
# npx prisma migrate reset --force
npx prisma db seed
npx prisma studio
```

From `backend/` you can also run the wrappers in `package.json` (they pass `--schema=../prisma/schema.prisma`).

Example `DATABASE_URL`:

```
postgresql://user:pass@localhost:5432/salam_doctor?schema=public
```

---

## Quick Start (Raw SQL)

```bash
psql "$DATABASE_URL" -f sql/001_init_schema.sql
psql "$DATABASE_URL" -f sql/002_seed_shiraz.sql
```

> Prefer Prisma migrations (`../prisma/migrations`) over the raw SQL files when both are available — keep one source of truth.

## Example Queries

### Active clinics in a district with authentic Candela laser

```sql
SELECT c.name, c.phone, d.name AS district, md.brand_name, cd.is_authentic_badge
FROM clinics c
JOIN districts d ON d.id = c.district_id
JOIN clinic_devices cd ON cd.clinic_id = c.id
JOIN medical_devices md ON md.id = cd.device_id
WHERE d.slug = 'maaliabad'
  AND c.contract_status = 'ACTIVE'
  AND md.brand_name = 'Candela'
  AND cd.is_authentic_badge = TRUE;
```

### Service tree (parent + children)

```sql
SELECT p.slug AS parent, s.slug AS child, s.base_price
FROM services s
LEFT JOIN services p ON p.id = s.parent_id
ORDER BY COALESCE(p.sort_order, s.sort_order), s.sort_order;
```

### Expiring contracts (renewal pipeline)

```sql
SELECT name, phone, end_date
FROM clinics
WHERE contract_status = 'ACTIVE'
  AND end_date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY end_date;
```

---

## MySQL Notes

1. Change Prisma `provider` to `"mysql"`.
2. Replace PostgreSQL `ENUM` types with MySQL `ENUM(...)` or lookup tables.
3. Use `DATETIME` instead of `TIMESTAMPTZ`.
4. Decimal lat/lng columns remain portable as-is.

---

## Files

```
# Canonical Prisma (use this)
prisma/                         ← project ROOT
├── schema.prisma
├── migrations/0001_init/
└── seed.js

# Docs / SQL helpers only
backend/
├── prisma/README.md            ← points to ../prisma (no schema here)
├── sql/
│   ├── 001_init_schema.sql
│   └── 002_seed_shiraz.sql
├── package.json                ← scripts use --schema=../prisma/schema.prisma
└── .env.example
```
