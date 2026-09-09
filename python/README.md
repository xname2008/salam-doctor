# Python modules — سلام دکتر

## Local SEO routing (`/{city}/{specialty}`)

ماژول مسیریابی برای URLهای ترکیبی شهر + تخصص (مثلاً `/tehran/hair-transplant`):

| فایل | نقش |
|------|-----|
| `local_seo/registry.py` | شهرها، تخصص‌ها، lat/lng |
| `local_seo/router.py` | parse و match مسیر |
| `local_seo/meta.py` | Title، Description، H1 |
| `local_seo/jsonld.py` | `LocalBusiness` + `MedicalClinic` + geo |
| `local_seo/head.py` | تزریق `<head>` |
| `local_seo/app.py` | FastAPI sidecar (پورت 8020) |

```bash
PYTHONPATH=python python3 -m local_seo.cli match /tehran/hair-transplant
PYTHONPATH=python python3 -m local_seo.cli render /tehran/hair-transplant
```

Nginx: `deploy/nginx-local-seo.conf` — شهرهای جدید به Python؛ `/shiraz/*` روی Node باقی می‌ماند.

---

## Clinic landing templates (CRO + SKAG)

قالب تجاری لندینگ کلینیک با Jinja2 + Tailwind:

```
python/
  clinic_landing/          # context, SKAG UTM, renderer
  templates/clinic_landing/
    base.html
    landing.html
    partials/hero.html     # Hero + 3D slot
    partials/eeat.html     # نظام پزشکی، بورد، فلوشیپ
    partials/pricing.html  # شفافیت مالی
    partials/skag_script.html
```

**پیش‌نمایش:**

```bash
pip install jinja2
python3 python/examples/render_clinic_landing_demo.py 'utm_term=candela'
# → python/examples/output/clinic-landing-114-candela.html
```

**استفاده در FastAPI/Flask:**

```python
from clinic_landing import LandingRenderer, build_landing_context

ctx = build_landing_context(clinic_dict, request.query_params)
html = LandingRenderer().render_landing(ctx)
```

پارامترهای SKAG: `utm_term`, `utm_content`, `skag`, `keyword`, `device`, `service`

---

## Technical SEO

ماژول‌های پایتون برای تولید JSON-LD (`MedicalClinic` + `AggregateRating`)، تزریق در `<head>`، و به‌روزرسانی خودکار `sitemap.xml`.

## ساختار

```
python/
  salam_doctor_seo/
    config.py        # SITE_BASE, مسیر leads.db, data.min.js
    models.py        # ClinicRecord, ReviewSummary
    repository.py    # خواندن از catalog + SQLite overlay
    jsonld.py        # ساخت Schema.org JSON-LD
    html_inject.py   # جایگزینی <!-- DYNAMIC_SEO_TAGS -->
    sitemap.py       # تولید و refresh نقشه سایت
    cli.py           # ابزار خط فرمان
  examples/
    inject_profile_seo_demo.py
  migrations/
    001_clinic_reviews.sql   # جدول اختیاری نظرات
```

## نصب

فقط stdlib — نیازی به pip نیست:

```bash
cd /home/ubuntu/salam-doctor
python3 python/examples/inject_profile_seo_demo.py
```

## CLI

```bash
# JSON-LD کلینیک ۱۱۴
PYTHONPATH=python python3 -m salam_doctor_seo.cli jsonld 114 --pretty

# تزریق در profile.html
PYTHONPATH=python python3 -m salam_doctor_seo.cli inject 114 profile.html -o /tmp/out.html

# بازسازی sitemap.xml
PYTHONPATH=python python3 -m salam_doctor_seo.cli sitemap

# بعد از ثبت لندینگ جدید
PYTHONPATH=python python3 -m salam_doctor_seo.cli sitemap --clinic-id 115
```

## متغیرهای محیطی

| متغیر | پیش‌فرض |
|--------|---------|
| `SITE_BASE` | `https://salam-doctor.com` |
| `LEADS_DB_PATH` | `./leads.db` |
| `CLINICS_CATALOG_PATH` | `./data.min.js` |
| `SITEMAP_OUTPUT_PATH` | `./sitemap.xml` |

## اتصال به Node (server.js)

بعد از ذخیره `clinic_profiles` در API ادمین:

```javascript
const { execFile } = require('child_process');
function refreshSitemapAfterLanding(clinicId) {
  execFile('python3', [
    '-m', 'salam_doctor_seo.cli', 'sitemap', '--clinic-id', String(clinicId)
  ], {
    cwd: '/app',
    env: { ...process.env, PYTHONPATH: '/app/python', SITEMAP_OUTPUT_PATH: '/app/sitemap.xml' }
  }, (err) => {
    if (err) console.warn('[seo] sitemap refresh failed:', err.message);
  });
}
```

## Nginx

فایل `deploy/nginx-seo-performance.conf` را در کانتینر web include کنید:

```nginx
include /etc/nginx/conf.d/seo-performance.conf;
```

- فایل‌های استاتیک: کش ۳۰ روزه
- `sitemap.xml`: اول از دیسک (خروجی پایتون)، در صورت نبود → پروکسی به Node
- `profile.html`: پروکسی به backend با کش کوتاه

## AggregateRating

طبق دستورالعمل گوگل، امتیاز فقط وقتی در JSON-LD می‌آید که داده واقعی وجود داشته باشد:

1. فیلدهای `ratingValue` / `reviewCount` در `data.min.js`، یا
2. جدول `clinic_reviews` در SQLite (migration در `python/migrations/`)

## مثال تزریق JSON-LD در HTML

`profile.html` باید placeholder داشته باشد:

```html
<head>
  <!-- DYNAMIC_SEO_TAGS -->
</head>
```

خروجی تزریق‌شده (نمونه):

```html
<head>
  <title>کلینیک نهال شیراز - آدرس، تلفن و خدمات</title>
  <meta name="description" content="...">
  <link rel="canonical" href="https://salam-doctor.com/profile.html?id=114">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"MedicalClinic",...}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList",...}</script>
</head>
```

اجرای دمو:

```bash
python3 python/examples/inject_profile_seo_demo.py
# → python/examples/output/profile-114-seo.html
```
