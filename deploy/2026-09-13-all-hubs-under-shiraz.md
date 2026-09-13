# Cursor prompt — all service hubs under `/shiraz/` (salam-doctor.com)

## Locked rule (owner)
For now, **service/category money hubs live only under `/shiraz/{slug}`**.  
Legacy `*.html` service hubs must **301 one-hop** into `/shiraz/…`.  
Do **not** keep `.html` as canonical for services.

Utility pages may stay outside `/shiraz/`:
- `/`, `/about.html`, `/articles.html`, `/faq.html`, `/contact.html`, `/clinic-promote.html`, `/category.html` (browse UI), `/products.html` (if product catalog — confirm), `/doctor/*`, `/articles/*`

---

## P0 — reverse broken slimming (wrong direction today)

**Live today (wrong):**
- `/shiraz/slimming` → **301** → `/slimming.html`
- `/slimming.html` → **200** self-canonical

**Target:**
| Action | URL |
|---|---|
| **KEEP** | `/shiraz/slimming` |
| **301** | `/slimming.html` → `/shiraz/slimming` |
| Trailing slash | `/shiraz/slimming/` → `/shiraz/slimming` |

Also flip any existing nginx/`_redirects` rule that currently sends `/shiraz/slimming` → `/slimming.html` (delete that rule).

### KEEP page SEO
- Title A: `بهترین مراکز لاغری و پیکرتراشی در شیراز | قیمت و نوبت‌دهی | سلام دکتر`
- H1: `بهترین مراکز لاغری و پیکرتراشی در شیراز`
- Meta: no `لیست 0/1 مرکز` boasts; GUIDE/LIST rules already in seoInfra apply
- canonical / og:url → `https://salam-doctor.com/shiraz/slimming`
- Merge any unique sections/FAQs from `slimming.html` into the Shiraz hub before relying on the 301
- Sitemap: **add** `/shiraz/slimming`, **remove** `/slimming.html`
- Sitewide link rewrite: `slimming.html` → `/shiraz/slimming`

---

## P1 — remaining service `.html` hubs still in sitemap (move same playbook)

| KEEP (create or promote) | 301 loser |
|---|---|
| `/shiraz/rhinoplasty` | `/rhinoplasty.html` |
| `/shiraz/lasik` | `/lasik.html` |
| `/shiraz/femto-lasik` | `/femto-lasik.html` |
| `/shiraz/prk` | `/prk.html` |
| `/shiraz/pharmacy` (only if this is a real service hub; else noindex/drop — don’t invent clinics) | `/pharmacy.html` |

For each:
1. Ensure KEEP is 200, self-canonical, Title A / GUIDE rules, FAQ merged from loser if any
2. 301 loser → KEEP (one-hop) + trailing-slash normalize
3. Sitewide href rewrite
4. Sitemap: KEEP in, loser out
5. Indexing later: DELETE losers, UPDATE keeps

**Already done (do not reopen):** laser-hair, cosmetic-surgery, hair-transplant, skin-rejuvenation, injectables/injection, dental specialties → dentistry, botox services paths.

---

## P1b — soft stubs
- `/shiraz/rejuvenation` is **404** live → add **301** → `/shiraz/skin-rejuvenation` (typo/short alias)

---

## Out of scope
- Inventing dental clinics
- Dual CO2 (`co2-laser` vs `co2-fractional-laser`) — **resolved**: KEEP `/shiraz/co2-fractional-laser`; 301 `/shiraz/co2-laser` → fractional
- Articles stay under `/articles/`

---

## Live verify (paste)

```bash
# slimming direction FIXED
curl -sI https://salam-doctor.com/slimming.html | egrep -i 'HTTP/|location'
# expect 301 → /shiraz/slimming
curl -sI https://salam-doctor.com/shiraz/slimming | egrep -i 'HTTP/|location'
# expect 200 (not 301 to .html)

curl -sI https://salam-doctor.com/shiraz/rejuvenation | egrep -i 'HTTP/|location'

curl -sL https://salam-doctor.com/sitemap.xml | egrep 'slimming|rhinoplasty|lasik|femto|prk|pharmacy'
curl -sL https://salam-doctor.com/sitemap.xml | grep -c '<loc>'
```

### PASS
1. `/shiraz/slimming` is **200** self-canonical; `/slimming.html` **301** into it (not the reverse)
2. Sitemap has `/shiraz/slimming`, not `/slimming.html`
3. Each P1 loser 301 → its `/shiraz/…` KEEP; losers absent from sitemap
4. `/shiraz/rejuvenation` 301 → `/shiraz/skin-rejuvenation`
5. No new redirect chains

When done: paste curl output. SEO admin will Indexing DELETE/UPDATE.
