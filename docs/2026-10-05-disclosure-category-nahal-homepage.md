# Cursor prompt: homepage article link, paid-listing disclosure, /category noindex, Nahal sample+FAQ, article sitemap lastmods, hero (salam-doctor.com)

**Site:** https://salam-doctor.com
**Standing rules:** No prices (تومان / numeric price / «لیست قیمت») anywhere in new or edited copy. Vetting = in-person visit + contract; clinics pay to be listed and that must be disclosed; no medical reviewer — do not imply medical review or endorsement. Money hubs only under `/shiraz/`. Bare root-absolute canonicals / og:url / internal hrefs. One-hop 301 only where redirects apply.
**Do not touch:** the Nahal badge («تاییدشده سلام دکتر» on hubs, «مرکز تایید شده» on the profile), any star rating / review count UI or schema, clinic card layout, or «مشاوره رایگان» **CTA button labels**. Leave hub H1s, hub cost-FAQ answers from the 2026-10-04 deploy, and unrelated body copy alone.
After deploy, reply `deployed` + the real short SHA (run `git rev-parse --short HEAD` and paste its **output**, not the command) + the acceptance output.

All Persian text you need is embedded below. Copy it exactly (including ZWNJ such as «می‌کند»). Live state verified 2026-10-05 (Asia/Tehran) against `/workspace/weekly-2026-10-05/` and the live site.

---

## 1. Homepage: crawlable link to the hair-transplant guide

**Live now:**
- `#articles-section` («مقالات آموزشی») is an empty JS grid (`#home-articles`) filled from `assets/js/articles-catalog.generated.js`. That catalog currently lists **7** slugs and **does not include** `best-hair-transplant-center-shiraz`, so the new guide never appears in the grid.
- Footer column «مقالات جدید» has static links to five older articles + `/articles`, but **not** to `/articles/best-hair-transplant-center-shiraz`.
- Top category tiles already point at `/shiraz/*` (good). No homepage `href` to `/category`.

**Implement:**
1. Add at least one **static, crawlable, root-absolute** HTML link on the homepage to `/articles/best-hair-transplant-center-shiraz` with this exact non-money anchor text: «چطور بهترین مرکز کاشت مو در شیراز را انتخاب کنیم؟». Preferred places (do both if easy):
   - Inside `#articles-section`, as a static card or paragraph link that does **not** depend on JS (in addition to the existing «همه مقالات» button).
   - In the footer «مقالات جدید» column (add as the first item).
2. Run the existing articles catalog sync (`npm run articles:sync` or the repo’s equivalent) so `best-hair-transplant-center-shiraz` is included in `articles-catalog.generated.js` with its real title/summary/date/cover. Do not invent catalog fields.
3. Do **not** use money anchors (no «هزینه»، «قیمت»، «ارزان»). Do not link the homepage hero/H1 to a money hub for this item.

---

## 2. Paid-listing disclosure (same exact line everywhere)

**Live now:** hubs and `/doctor/nahal-clinic` have **no** paid-listing / vetting disclosure near the clinic list. `/about` still describes the product as free consultation + introducing centres, without saying clinics pay to be listed. **19** hubs currently render a clinic (featured-center and/or `/doctor/` link); **16** hubs are empty («در حال تکمیل»).

**Exact disclosure line (copy once, reuse everywhere — no new links, no wrapping `<a>`):**
«تیم سلام دکتر مراکز را حضوری بازدید می‌کند و قرارداد می‌بندد. مراکز برای فهرست‌شدن در سایت هزینه می‌پردازند و ترتیب نمایش به‌معنای توصیه یا تایید پزشکی نیست.»

**Implement:**
1. On every `/shiraz/{slug}` hub that **shows clinics** (featured-center card and/or clinic list with at least one `/doctor/` profile), place that exact sentence in a short visible `<p>` immediately before or after the clinic list / featured-center block (same partial/template so future clinics inherit it). Live hubs that need it today: `/shiraz/botox`, `/shiraz/co2-fractional-laser`, `/shiraz/cosmetic-surgery`, `/shiraz/dermatology`, `/shiraz/eyebrow-transplant`, `/shiraz/fillers`, `/shiraz/fotona-laser`, `/shiraz/hair-transplant`, `/shiraz/hair-transplant-installment`, `/shiraz/hifu-doublo-gold`, `/shiraz/injectables`, `/shiraz/laser-candela-2026`, `/shiraz/laser-hair-removal`, `/shiraz/laser-surgery`, `/shiraz/light-therapy`, `/shiraz/mens-laser-shiraz`, `/shiraz/mesotherapy`, `/shiraz/micro-fit-hair-transplant`, `/shiraz/skin-rejuvenation`. If the shared partial also renders on empty hubs, either gate the line on «has ≥1 clinic» **or** show it on all hubs that use the partial — prefer showing it whenever the clinic-list partial renders so empty hubs that later gain a clinic are covered.
2. On the `/doctor/{slug}` profile template (not only Nahal), place the **same** exact sentence near the top of the profile content (under the name/badge area or just above the services list). Visible, crawlable HTML — not only JSON-LD.
3. Do not add a new URL, landing page, or footnote link for this line. Do not change badge/rating markup. Do not put prices in the disclosure.

---

## 3. `/category` and `/category?type=*`: noindex,follow + drop from sitemap

**Chosen approach: `noindex,follow` (not a canonical to `/shiraz/`).**

**Justification (do not switch to canonical-to-hub without a new prompt):**
- `/category` has no single 1:1 money hub.
- `?type=` buckets are broader than hubs (`hair` ≈ hair+eyebrow, `injection` ≈ botox+fillers+injectables, `skin` ≈ rejuvenation/dermatology, etc.). A canonical to one hub would misrepresent the page.
- Live pages are thin (~150–160 words of indexable chrome; clinics load via JS) and already self-canonical to themselves, so they compete with `/shiraz/*`.
- GSC (week ending 2026-10-02): tiny impressions, deep positions (e.g. `category?type=skin` ~6 impressions @ ~59; `type=laser` ~5 @ ~76).
- Homepage / hub nav already primary-target `/shiraz/*`; no current header/footer `href` to `/category` was found on home, `/shiraz`, hubs, articles, faq, contact, or Nahal.

**Live now:** `/category` and `/category?type=skin|hair|laser|dental|injection|…` return 200, self-canonical (including the query), **no** robots meta. `sitemap.xml` still lists `https://salam-doctor.com/category` (lastmod 2026-10-04). Category labels in JS include: hair, skin, laser, injection, surgery, slimming, lasik, femto-lasik, prk, products, pharmacy.

**Implement:**
1. On `/category` and **every** `/category?type=*`, add `<meta name="robots" content="noindex,follow">` (keep follow so any residual equity can flow). Do not leave them indexable. Leave the self-canonical as-is (or bare `/category` / `/category?type=…`); do **not** canonical them to `/shiraz/*` in this deploy.
2. Remove `https://salam-doctor.com/category` from `sitemap.xml` (and any `category.html` / typed variants if present). Do not add typed category URLs to the sitemap.
3. Confirm internal nav/footer/header/JS menus do not present `/category` as a primary browse target when a `/shiraz/` equivalent exists. Homepage tiles already go to `/shiraz/*` — leave them. If any remaining nav link points at `/category?type=hair` (etc.), point it at the matching hub instead (`hair`→`/shiraz/hair-transplant`, `skin`→`/shiraz/skin-rejuvenation`, `laser`→`/shiraz/laser-hair-removal`, `injection`→`/shiraz/injectables`, `surgery`→`/shiraz/cosmetic-surgery`, `slimming`→`/shiraz/slimming`, `lasik`→`/shiraz/lasik`, `femto-lasik`→`/shiraz/femto-lasik`, `prk`→`/shiraz/prk`, `pharmacy`→`/shiraz/pharmacy`). `/category` itself may remain reachable for legacy bookmarks; it just must be noindex.

---

## 4. `/doctor/nahal-clinic`: sample image + cost FAQ + fixture sweep

**Live now:**
- `<base href="/">` is set, but the profile still references the placeholder `images/sample-clinic-services.webp` in: a preload `<link>`, two `<img src>`, and a JS fallback `clinic.image || 'images/sample-clinic-services.webp'`. That filename is sample/fixture residue. The real clinic hero already used for og:image / JSON-LD is `https://salam-doctor.com/clinics/114/Hero.webp` (**200**). `/images/sample-clinic-services.webp` also 200 but is a generic placeholder — **do not keep it**. Dedicated article hero `assets/images/articles/best-hair-transplant-center-shiraz.webp` is still **404** (see item 6).
- Cost FAQ question (unchanged): «هزینه ویزیت و درمان در کلینیک نهال چقدر است؟»
- Current answer (visible accordion **and** FAQPage JSON-LD — identical): «تعرفه بسته به نوع خدمت، تجهیزات و طرح درمان پس از معاینه اعلام می‌شود. قبل از شروع درمان می‌توانید برآورد هزینه را از مرکز یا از مشاوره رایگان سلام دکتر بگیرید.»
- Profile badge text on-page: «مرکز تایید شده» (hubs use «تاییدشده سلام دکتر»). Leave both alone. Do not invent or alter ratings.

**Implement:**
1. Replace every `images/sample-clinic-services.webp` (preload, img src, JS fallback, any other template string) with the root-absolute real asset `/clinics/114/Hero.webp`. Prefer root-absolute paths (`/clinics/114/Hero.webp`) over relative. If a given slot is a decorative placeholder that should not show the hero, **remove** that img/preload instead of inventing a new asset. Do not add new image files.
2. Replace **only** the cost FAQ answer (visible + FAQPage `acceptedAnswer.text` + any JS FAQ array that feeds them) with exactly:
   «هزینه خدمات در کلینیک نهال به نوع خدمت، روش درمان، تعداد جلسات یا گرافت لازم، تجهیزات مرکز و طرح درمان بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند.»
   Question text stays the same. No «مشاوره رایگان» inside this answer. Leave other FAQ Q&As as they are. Leave «مشاوره رایگان» CTA **button labels** unchanged.
3. Sweep the Nahal profile (and the shared doctor-profile template if that is the source) for other sample/fixture residue: `sample-`, `fixture`, `placeholder`, `lorem`, `TODO`, `آزمایشی`, `example.com`, relative `images/sample-*`. Fix or remove anything that 404s or is clearly demo content. Do not touch real `/clinics/114/*` assets, the ad banner `/images/ads/nahal-banner-category-desktop.jpg`, or the badge/rating.

---

## 5. Articles sitemap lastmod = real on-page dateModified

**Live now:** `sitemap-articles.xml` sets **every** article `<lastmod>` to `2026-10-03`, but on-page `dateModified` (JSON-LD) differs for 7 of 8 articles — dates were bumped in the sitemap without content changes.

| Article | On-page dateModified (source of truth) | sitemap-articles.xml lastmod (live) |
|---|---|---|
| /articles/best-hair-transplant-center-shiraz | 2026-10-03 | 2026-10-03 |
| /articles/body-contouring-clinic-guide | 2026-09-05 | 2026-10-03 |
| /articles/botox-filler-guide | 2026-09-12 | 2026-10-03 |
| /articles/fit-hair-transplant-cost | 2026-08-31 | 2026-10-03 |
| /articles/hair-loss-treatment-comparison | 2026-09-18 | 2026-10-03 |
| /articles/laser-hair-removal-comparison | 2026-09-03 | 2026-10-03 |
| /articles/mesotherapy-vs-prp-hair-loss | 2026-09-10 | 2026-10-03 |
| /articles/rhinoplasty-care-guide | 2026-09-06 | 2026-10-03 |

**Implement:**
1. Set each `<lastmod>` in `sitemap-articles.xml` to that article’s on-page `dateModified` (YYYY-MM-DD only), matching the table.
2. Fix the generator / `articles:sync` (or whatever builds `sitemap-articles.xml`) so future runs copy `dateModified` from the article HTML/JSON-LD instead of stamping today’s date. Do **not** change on-page `datePublished` / `dateModified` in this deploy just to make the sitemap look fresh.
3. Leave `sitemap.xml` article-free (articles stay in `sitemap-articles.xml`).

---

## 6. Hero image (conditional)

**Live now:** `/articles/best-hair-transplant-center-shiraz` still uses `/assets/images/articles/hair-transplant-cover.webp` for the hero `<img>` (550×360), `og:image`, `twitter:image`, and JSON-LD `"image"`. Dedicated file `/assets/images/articles/best-hair-transplant-center-shiraz.webp` returns **404**.

**Implement:**
- If `assets/images/articles/best-hair-transplant-center-shiraz.webp` **exists in the repo** after your pull: point all four references (hero img, og:image, twitter:image, JSON-LD image) at `/assets/images/articles/best-hair-transplant-center-shiraz.webp` with width/height **1200×630**, and make sure the file is deployed so the URL returns 200.
- If it does **not** exist in the repo: leave all four references unchanged and report exactly: `hero: dedicated image not in repo, fallback unchanged`.
- Do not invent or generate a replacement image in this prompt.

---

## Out of scope for this deploy (report only — do not fix here)

**Near-duplicate pair:**
- `/articles/hair-loss-treatment-comparison` — title «مقایسه مزوتراپی و PRP در درمان ریزش مو: اثربخشی، هزینه و ماندگاری», ~814 words, dateModified 2026-09-18.
- `/articles/mesotherapy-vs-prp-hair-loss` — title «مقایسه مزوتراپی و PRP در درمان ریزش مو: اثربخشی و هزینه», ~1206 words, dateModified 2026-09-10.
Both share nearly the same summary in the articles catalog; the homepage footer currently links **both**. **Recommendation (next prompt):** pick one canonical (prefer the longer `mesotherapy-vs-prp-hair-loss` unless GSC shows the other winning), 301 the loser in one hop, remove the loser from `sitemap-articles.xml` and the footer/catalog, and retarget internal links.

**Thin article:**
- `/articles/body-contouring-clinic-guide` — «۵ عامل حیاتی در انتخاب کلینیک پیکرتراشی و لیپوماتیک», ~250–277 words, dateModified 2026-09-05. **Recommendation (next prompt):** expand to a real Shiraz clinic-selection guide (≥900 words, no prices, vetting-aligned) **or** noindex until expanded; do not leave a thin indexable listicle competing with `/shiraz/slimming`.

---

## Acceptance checks (run after deploy; paste the output)

```bash
B=https://salam-doctor.com; CB="cb=$(date +%s)"
# --- 1. homepage crawlable link ---
curl -s -m 20 "$B/?$CB" | grep -oE 'href="/articles/best-hair-transplant-center-shiraz"[^>]*>[^<]+' | head -5
# expect ≥1 static hit; anchor should be the non-money guide phrase (not قیمت/هزینه as the pitch)
curl -s -m 20 "$B/assets/js/articles-catalog.generated.js?$CB" | grep -c 'best-hair-transplant-center-shiraz'   # ≥1
# --- 2. disclosure (exact line stem) ---
D='تیم سلام دکتر مراکز را حضوری بازدید می‌کند و قرارداد می‌بندد'
for h in botox hair-transplant laser-candela-2026 injectables skin-rejuvenation facial pharmacy; do
  echo "2 /shiraz/$h $(curl -s -m 20 "$B/shiraz/$h?$CB" | grep -c "$D")"
done
# expect ≥1 on hubs that show clinics (botox, hair-transplant, laser-candela-2026, injectables, skin-rejuvenation); facial/pharmacy may be 0 if empty and gated
echo "2 /doctor/nahal-clinic $(curl -s -m 20 "$B/doctor/nahal-clinic?$CB" | grep -c "$D")"   # ≥1
# --- 3. category noindex + sitemap ---
for u in \
  "category?$CB" \
  "category?type=skin&$CB" \
  "category?type=laser&$CB" \
  "category?type=hair&$CB" \
  "category?type=injection&$CB"
 do
  echo "3 /$u $(curl -s -m 20 "$B/$u" | grep -oE 'name="robots" content="[^"]+"')"
done
# each: name="robots" content="noindex,follow"
curl -s -m 20 "$B/sitemap.xml?$CB" | grep -c '<loc>https://salam-doctor.com/category'   # 0
# --- 4. Nahal sample + cost FAQ ---
N=$(curl -s -m 20 "$B/doctor/nahal-clinic?$CB")
echo "4 sample_refs $(echo "$N" | grep -c 'sample-clinic-services')"          # 0
echo "4 hero_img $(echo "$N" | grep -c '/clinics/114/Hero.webp')"            # ≥1 (if imgs kept)
echo "4 old_cost $(echo "$N" | grep -c 'مشاوره رایگان سلام دکتر بگیرید')"   # 0
echo "4 new_cost $(echo "$N" | grep -c 'به‌صورت کتبی اعلام می‌کند')"      # ≥2 (visible + JSON-LD)
echo "4 badge_profile $(echo "$N" | grep -c 'مرکز تایید شده')"               # unchanged (≥1)
curl -s -m 10 -o /dev/null -w "4 hero114 %{http_code}\n" "$B/clinics/114/Hero.webp"   # 200
# --- 5. article sitemap lastmods ---
curl -s -m 20 "$B/sitemap-articles.xml?$CB" | python3 -c 'import sys,re;s=sys.stdin.read();print("\n".join(f"{a} {b}" for a,b in re.findall(r"<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>",s)))'
# expect lastmods equal to on-page dateModified in the table (not all 2026-10-03)
# --- 6. hero ---
curl -s -m 20 "$B/articles/best-hair-transplant-center-shiraz?$CB" | grep -oE 'og:image" content="[^"]+"|twitter:image" content="[^"]+"|"image": ?"[^"]+"|<img[^>]*(cover|best-hair)[^>]*width="[0-9]+"[^>]*height="[0-9]+"'
curl -s -m 10 -o /dev/null -w "6 dedicated %{http_code}\n" "$B/assets/images/articles/best-hair-transplant-center-shiraz.webp"
# 200 + all four refs at 1200x630 if shipped; else report fallback unchanged
# --- untouched CTAs / no prices introduced ---
curl -s -m 20 "$B/shiraz/hair-transplant?$CB" | grep -c 'مشاوره رایگان'   # still ≥1 (CTA labels kept)
curl -s -m 20 "$B/shiraz/hair-transplant?$CB" | grep -c 'تومان'            # 0
curl -s -m 20 "$B/shiraz/hair-transplant?$CB" | grep -c 'تاییدشده سلام دکتر'  # unchanged (≥1)
git rev-parse --short HEAD
```

---

## Reply format

`deployed <short-sha>`

Then paste the acceptance output. If item 6’s file is missing from the repo, include the line `hero: dedicated image not in repo, fallback unchanged`.
