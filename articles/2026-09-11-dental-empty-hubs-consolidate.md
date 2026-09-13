# Cursor prompt — dental hubs with zero clinics (salam-doctor.com)

## Context (product fact)
- There are **no dental clinics** in inventory for now.
- Live site also has **no dental articles** in `sitemap-articles.xml` / articles listing (only beauty/hair pieces). Do not invent article links.
- Four empty `/shiraz/dental*` hubs (~320–350 words each) are soft-404 / thin-directory risk even after GUIDE titles.

## Decision (locked — do not reopen)
**Keep one dental URL. 301 the empty specialties into it until clinics exist.**

| Action | URL |
|---|---|
| **KEEP (canonical GUIDE)** | `/shiraz/dentistry` |
| **301 → KEEP** | `/shiraz/dental-implant` |
| **301 → KEEP** | `/shiraz/dental-veneer` |
| **301 → KEEP** | `/shiraz/orthodontics` |
| Trailing slash | `/shiraz/dentistry/` → `/shiraz/dentistry` (if not already) |

When the first real dental clinic is onboarded later: can re-split specialty landings; until then **do not** leave empty specialty money pages indexable.

Out of scope: `/shiraz/co2-laser` (already GUIDE; separate). Do not invent clinics.

---

## Redirects (nginx / `_redirects` — same pattern as other hubs)

```
/shiraz/dental-implant     /shiraz/dentistry     301
/shiraz/dental-veneer      /shiraz/dentistry     301
/shiraz/orthodontics       /shiraz/dentistry     301
/shiraz/dental-implant/    /shiraz/dentistry     301
/shiraz/dental-veneer/     /shiraz/dentistry     301
/shiraz/orthodontics/      /shiraz/dentistry     301
```

One-hop only. Update any nav on `/shiraz` that still lists the three losers → point to `/shiraz/dentistry` only (or drop specialty nav items).

---

## KEEP page: `/shiraz/dentistry` (GUIDE mode, count = 0)

### SERP fields — stop claiming “بهترین مراکز” with zero clinics
Current title still says `بهترین مراکز دندانپزشکی…` while inventory is empty. Change to honest GUIDE:

- **Title:** `دندانپزشکی در شیراز | راهنمای انتخاب مرکز و قیمت | سلام دکتر`
- **H1:** `دندانپزشکی در شیراز`
- **Meta:** `راهنمای انتخاب مرکز دندانپزشکی در شیراز؛ ایمپلنت، لمینت، ارتودنسی و معیارهای مجوز/تخصص + مشاوره رایگان سلام دکتر.`
- **canonical / og:url / twitter:url:** `https://salam-doctor.com/shiraz/dentistry`

### Body structure (required)
Keep GUIDE empty-state + `clinic-promote` CTA. Add **unique topic sections** so specialty queries aren’t a total dead-end after 301s:

1. Short intro: what this hub is (directory-in-progress for Shiraz dental care)
2. **خدمات دندانپزشکی رایج در شیراز** — brief blocks for:
   - ایمپلنت
   - لمینت / کامپوزیت
   - ارتودنسی
   - (optional) جرم‌گیری / ترمیم — only if accurate, no fake clinic claims
3. **چطور مرکز دندانپزشکی معتبر انتخاب کنیم؟** — license, specialist, sterilization, warranty, price red flags
4. **ثبت کلینیک** CTA → `clinic-promote.html`
5. FAQPage (no `0 مرکز` boasts), e.g.:
   - هزینه تقریبی خدمات دندانپزشکی به چه عواملی بستگی دارد؟
   - برای ایمپلنت به چه تخصصی نیاز است؟
   - تفاوت لمینت و کامپوزیت چیست؟
   - چه زمانی ارتودنسی لازم است؟
   - چطور کلینیک خود را در سلام دکتر ثبت کنیم؟

### Schema
- `MedicalWebPage` + `FAQPage` (or WebPage + FAQPage)
- **No** ItemList of 0 clinics
- No LocalBusiness list pretending coverage

### Sitemap
- **Keep** `/shiraz/dentistry` in `sitemap.xml`
- **Remove** the three 301 losers from pages sitemap allowlist/generator
- Expected pages sitemap locs: 48 → **~45**

### Internal links
Sitewide replace loser paths → `/shiraz/dentistry` (nav, footer, `/shiraz` hub cards, related-links modules).

---

## Indexing (SEO admin after deploy)
- `URL_DELETED`:  
  `https://salam-doctor.com/shiraz/dental-implant`  
  `https://salam-doctor.com/shiraz/dental-veneer`  
  `https://salam-doctor.com/shiraz/orthodontics`
- `URL_UPDATED`:  
  `https://salam-doctor.com/shiraz/dentistry`  
  `https://salam-doctor.com/sitemap.xml`

---

## Live verify (paste output)

```bash
for u in dental-implant dental-veneer orthodontics; do
  echo "== $u"; curl -sI "https://salam-doctor.com/shiraz/$u" | egrep -i 'HTTP/|location'
done
curl -sL https://salam-doctor.com/shiraz/dentistry | egrep -i '<title>|rel="canonical"|<h1'
curl -sL https://salam-doctor.com/shiraz | egrep -n 'dental-implant|dental-veneer|orthodontics|dentistry' || true
curl -sL https://salam-doctor.com/sitemap.xml | egrep 'dental|ortho'
curl -sL https://salam-doctor.com/sitemap.xml | grep -c '<loc>'
```

### PASS criteria
1. Three specialty URLs → **301** one-hop → `/shiraz/dentistry`
2. Dentistry **200**, self-canonical, GUIDE title (no “بهترین مراکز” / no `لیست 0`)
3. Body has specialty topic sections + clinic CTA; FAQ has no empty-count boasts
4. `/shiraz` nav no longer promotes the three losers as separate hubs
5. Sitemap: dentistry present; three losers absent; loc count ≈ 45

## Re-expand rule (for later)
Only recreate `/shiraz/dental-implant` (etc.) when `hubListedClinicCount >= 1` for that specialty (ideally ≥ 3 before heavy “best list” framing). Until then, keep consolidated.
