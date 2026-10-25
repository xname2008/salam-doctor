# Cursor prompt — fix thin clinic-list hubs (salam-doctor.com)

## Problem (live)
Hub templates interpolate **clinic inventory counts** into title / meta / OG / FAQ / JSON-LD.

That produces trust-killing SEO:
- Title: `… | لیست 0 مرکز برتر + قیمت ۱۴۰۵ | …`
- Meta: `…؛ 0 مرکز فعال با تجهیزات اصل …`
- FAQ/JSON-LD: `در حال حاضر 0 مرکز ارائه‌دهنده …` / `لیست 0 مرکز …`

Even after Title A on some hubs, **body + FAQ + schema still say 0/1 مرکز**.

## Hard rules (implement in generator / `seo-config` / hub renderer — one place)

### A) Never put raw counts in SERP fields when count < 3
If `activeClinicCount < 3`:
- **Do not** use patterns: `لیست N مرکز`, `N مرکز برتر`, `N مرکز فعال` in:
  - `<title>`, OG/Twitter title
  - meta description / OG description
  - H1
  - JSON-LD `description` / FAQ answers that repeat the count as a boast
- Use **static Title A** (no count) instead.

Suggested Title A pattern (already used on fixed hubs):
`بهترین مراکز {SERVICE} در شیراز | قیمت و نوبت‌دهی | سلام دکتر`

H1:
`بهترین مراکز {SERVICE} در شیراز`

Meta (no count):
`لیست کلینیک‌های {SERVICE} در شیراز. مقایسه مراکز معتبر + مشاوره رایگان با سلام دکتر.`
(If truly empty inventory, swap “لیست کلینیک‌ها” → guide meta below.)

### B) Two render modes

**Mode LIST** — `activeClinicCount >= 3`  
Keep comparison table + clinic cards. Counts allowed in **on-page body** only (not title). FAQ may mention the count.

**Mode GUIDE** — `activeClinicCount` is 0 or 1 (or 2 if you want a safer threshold; default **< 3**)  
Do **not** present an empty/fake “directory winner list”.

GUIDE requirements:
1. Title/H1/meta follow rule A (no counts).
2. Remove or hide empty “مقایسه سریع مراکز” when there is nothing real to compare.
3. If count == 1: show that one clinic card honestly (e.g. نهال) **without** “لیست ۱ مرکز برتر” framing.
4. If count == 0: no fake clinic cards; show:
   - short service guide (what it is, who it’s for, questions to ask a clinic)
   - **related hubs** (internal links to healthier `/shiraz/*` pages)
   - CTA: `clinic-promote.html` / “ثبت مرکز”
5. FAQ answers must **not** say `در حال حاضر 0 مرکز…` or `لیست 0 مرکز…`.  
   Prefer: guide answers (هزینه بازه تقریبی، معیار انتخاب، مراقبت‌ها) + “فهرست مراکز این خدمت در حال تکمیل است؛ برای معرفی مرکز از فرم ثبت‌نام استفاده کنید.”
6. JSON-LD: if no clinics, don’t emit LocalBusiness/ItemList that claims a list of 0. Prefer FAQPage + WebPage/MedicalWebPage. If one clinic, ItemList length 1 is OK but description must not say “لیست ۱ مرکز برتر”.

### C) Stop dynamic “قیمت ۱۴۰۵ | لیست N مرکز برتر” title template sitewide
Find the title builder that produces:
`{service} در شیراز | لیست {N} مرکز برتر + قیمت ۱۴۰۵ | سلام دکتر`
Replace with Title A / GUIDE titles for all hubs, or at least gate it behind `N >= 3`.

---

## Priority URL batches

### P0 — EMPTY inventory (count 0) + still “لیست 0 مرکز” in title (fix immediately)
| URL | Notes |
|---|---|
| `/shiraz/co2-laser` | Empty; also overlaps `/shiraz/co2-fractional-laser` (has clinics). Prefer: GUIDE **or** 301 → `/shiraz/co2-fractional-laser` if product intent is the same fractional CO2. If intents differ, keep both but GUIDE the empty one and link to fractional. |
| `/shiraz/dentistry` | Empty dental parent |
| `/shiraz/dental-implant` | Empty |
| `/shiraz/dental-veneer` | Empty |
| `/shiraz/orthodontics` | Empty |

Dental cluster hardpoint: five empty money URLs. Minimum SEO fix = GUIDE + Title A. Better product fix = attach real clinics or consolidate thin dental URLs under `/shiraz/dentistry` with 301s (only if content truly duplicates — ask before mass-301).

### P0b — Title still “لیست 1 مرکز برتر”
| URL |
|---|
| `/shiraz/eyebrow-transplant` |
| `/shiraz/laser-surgery` |

Apply Title A + GUIDE/LIST hybrid (show the one clinic, no “برتر لیست ۱” in SERP fields).

### P1 — Title already fixed, but body/FAQ/schema still echo “1 مرکز” / “0 مرکز”
Apply rule B copy/schema cleanup (titles may already be OK):
- `/shiraz/hair-transplant`
- `/shiraz/skin-rejuvenation`
- `/shiraz/injectables`
- `/shiraz/botox`
- `/shiraz/fillers`
- `/shiraz/mesotherapy`
- `/shiraz/cosmetic-surgery` (**FAQ still says 0** while page has some doctor links — **data mismatch**; fix counter source so FAQ/schema match real cards)
- `/shiraz/dermatology`
- `/shiraz/laser-hair-removal`
- `/shiraz/laser-candela-2026`
- `/shiraz/mens-laser-shiraz`
- `/shiraz/micro-fit-hair-transplant`
- `/shiraz/hair-transplant-installment`
- `/shiraz/hifu-doublo-gold`
- `/shiraz/co2-fractional-laser`
- `/shiraz/breast-surgery`
- `/shiraz/skin-biopsy`
- (+ any other hub where FAQ contains `در حال حاضر [01] مرکز`)

### OK reference (do not break)
- `/shiraz/facial` — ~11 centers; LIST mode is fine. Title A already good.

---

## Data / counting bug to fix
On `/shiraz/cosmetic-surgery` and `/shiraz/mesotherapy`, SERP Title A is fine but FAQ/schema still say **0 مراکز** while the HTML has doctor/clinic links.  
Unify `activeClinicCount` with the cards actually rendered. Same counter must drive:
- mode LIST vs GUIDE
- FAQ text
- JSON-LD
- any “مقایسه سریع” block

---

## Explicit Title A strings for P0 / P0b (use these)

| Path | Title | H1 |
|---|---|---|
| `/shiraz/co2-laser` | `لیزر CO2 در شیراز \| راهنمای انتخاب مرکز و قیمت \| سلام دکتر` | `لیزر CO2 در شیراز` |
| `/shiraz/dentistry` | `بهترین مراکز دندانپزشکی در شیراز \| قیمت و نوبت‌دهی \| سلام دکتر` | `بهترین مراکز دندانپزشکی در شیراز` |
| `/shiraz/dental-implant` | `ایمپلنت دندان در شیراز \| راهنمای انتخاب مرکز و قیمت \| سلام دکتر` | `ایمپلنت دندان در شیراز` |
| `/shiraz/dental-veneer` | `لمینت و کامپوزیت دندان در شیراز \| راهنمای انتخاب و قیمت \| سلام دکتر` | `لمینت و کامپوزیت دندان در شیراز` |
| `/shiraz/orthodontics` | `ارتودنسی در شیراز \| راهنمای انتخاب مرکز و قیمت \| سلام دکتر` | `ارتودنسی در شیراز` |
| `/shiraz/eyebrow-transplant` | `بهترین مراکز کاشت ابرو در شیراز \| قیمت و نوبت‌دهی \| سلام دکتر` | `بهترین مراکز کاشت ابرو در شیراز` |
| `/shiraz/laser-surgery` | `بهترین مراکز لیزر و جراحی در شیراز \| قیمت و نوبت‌دهی \| سلام دکتر` | `بهترین مراکز لیزر و جراحی در شیراز` |

For empty dental/CO2 pages, meta must **not** claim “0 مرکز فعال… تجهیزات اصل”. Use guide meta.

Optional (only if product agrees):  
`301 /shiraz/co2-laser → /shiraz/co2-fractional-laser` (one-hop) when CO2 empty page adds no unique intent.

---

## Sitemap / indexing
- Keep GUIDE pages in sitemap (they’re still valid landings) **unless** you 301 them.
- After deploy: Indexing `URL_UPDATED` on all touched hubs.
- If 301 CO2: `URL_DELETED` on loser + `URL_UPDATED` on keep.

---

## Live verify (paste output)

```bash
# no SERP-field "لیست 0/1 مرکز" left
for u in \
  /shiraz/co2-laser /shiraz/dentistry /shiraz/dental-implant /shiraz/dental-veneer /shiraz/orthodontics \
  /shiraz/eyebrow-transplant /shiraz/laser-surgery \
  /shiraz/hair-transplant /shiraz/cosmetic-surgery /shiraz/injectables
 do
  echo "==== $u"
  curl -sL "https://salam-doctor.com$u" | tr '\n' ' ' | \
    egrep -o '<title>[^<]+</title>|name="description" content="[^"]+"|"description":"لیست [01] مرکز|در حال حاضر [01] مرکز' | head -20
done
```

### PASS criteria
1. **Zero** pages in P0/P0b still have `لیست 0 مرکز` or `لیست 1 مرکز` in `<title>` / og:title / meta description.
2. FAQ/JSON-LD no longer boast `لیست 0 مرکز` / `در حال حاضر 0 مرکز` on empty hubs.
3. `activeClinicCount` matches rendered clinic cards on cosmetic-surgery & mesotherapy.
4. `/shiraz/facial` still LIST mode and unchanged in spirit.
5. No new redirect chains; children (botox/fillers/etc.) still 200.

## Out of scope
- Inventing fake clinics
- Full YMYL medical rewrites for wart/biopsy (separate)
- `main-hero.png` preload

When done, paste verify greps + note whether CO2 was GUIDEd or 301’d.
