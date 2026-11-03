# Cursor prompt: make the aa95ad2 YMYL hub copy actually render, sitemap lastmod, and remove misleading claims from the shared /shiraz hub template (salam-doctor.com)

> ## ⚠️ READ FIRST, Jessie (not for Cursor to act on)
> - **Why aa95ad2 isn't live:** your code is fine. The server's copy of the repo just wasn't updated, or the backend wasn't restarted. In `docker-compose.yml`:
>   - `backend` bind-mounts `./seo-config.js:/app/seo-config.js:ro` (line 108).
>   - `web` (nginx) bind-mounts the whole repo `.:/usr/share/nginx/html:ro` (line 143). `deploy/nginx-seo-performance.conf` lines 14–21 serve `/sitemap.xml` **as that static file** and only fall back to the dynamic route (`seoInfra.js` ~1531) if the file is missing.
>   - On 2026-10-25 the live `sitemap.xml` still showed `lastmod 2026-10-07` for both URLs. A static file from a bind mount can only stay stale like that if **the server's checkout was not at aa95ad2**. On top of that, `seoRouter.js:124` loads `seo-config.js` once with `require()`, so even after a pull **the backend container must be restarted**.
>   - The deploy step at the end of this prompt fixes both.
> - **Decisions only you can make (Cursor must not guess):**
>   1. The hardcoded fallback rating `rating: { value: 4.8, count: 12 }` in `seoRouter.js` lines 301 and 342 is shown for clinics that have no real reviews. This prompt removes it. **Nahal's real ★4.8 (206) comes from its own data and is not touched.**
>   2. The `seo-config.js:32` hair-transplant FAQ answer promises installment payment «بدون نیاز به ضامن». That's a financial claim nobody has verified. Keep or remove? This prompt leaves it alone.
>   3. Price words still appear in hub meta descriptions (`seoInfra.js` 107 and 113: «…مقایسه مراکز معتبر، قیمت و مشاوره رایگان») and in `faqPageJsonLd.js:95` («تعرفه بسته به…»). This prompt removes them, because the no-price rule applies. Tell Cursor to skip this part if you disagree.

**Repo / branch:** `xname2008/salam-doctor`. Check out `cursor/seo-hub-sitemap-consolidation` (head `aa95ad2`, PR #1) and commit there. Keep PR #1 open; don't merge it.
**Standing rules:**
- No prices: no «قیمت», «هزینه» or «تعرفه» with numbers or price claims, and no «تومان».
- Cost answers explain what the cost depends on and end exactly «قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند.»
- No medical reviewer, and no wording that implies a doctor reviewed anything.
- No «مشاوره رایگان».
- No endorsement claims. Position in a list is not a medical endorsement.
- Keep the paid-listing disclosure.
- Canonicals are bare root-absolute URLs. Redirects take one hop.

**🚫 Nahal exclusion:** don't change Nahal's card, profile, badge «تاییدشده سلام دکتر» or its ★4.8 (206) rating anywhere. That covers `/doctor/nahal-clinic`, `clinic-intros/114.html`, `scripts/nahal-profile-intro.html`, Nahal's clinic data and the Nahal card on hubs. Rating and badge rules below apply to **hub-level** stats and to clinics with 0 real reviews only.
**Do not:** read, edit, stage or delete `.env*`, `leads.db`, `*.db`, `*.sql` / `db_backup.sql` / `live_data.sql`, `leads.json` or `certs/`. Don't force-push, rewrite history or merge into `main`.
After you deploy, reply `deployed` + the output of `git rev-parse --short HEAD` + the output of `git rev-parse --abbrev-ref HEAD` + the full output of `bash check.sh`.

---

## Where things live (read-only look at aa95ad2)

| What | File / lines |
|---|---|
| Hub page route | `seoRouter.js`: `buildLocalHubSeo(data, fileOverride)` at ~518 and ~652, which passes `seoDescriptionHtml` at ~670. `SEO_OVERRIDES = require('./seo-config')` at **line 124**, loaded once at startup. |
| Precedence | `seoInfra.js:949`: **seo-config overrides → DB `LocalHubSeo` → generated defaults**. `seoDescription` is at 974–975 and `faqs` (seo-config entries prepended to the generated FAQs) at ~1042. |
| Hub copy for these two | `seo-config.js` `'wart-cryotherapy'` (line 454) and `'skin-biopsy'` (line 506). aa95ad2 put the enriched `seoDescription` and `faqs` here, so seo-config **is** the right source; it just isn't loaded yet. |
| Generated (shared) hub FAQs | `seoInfra.js` ~799–823: the "best clinic" answer, the device-authenticity answer at **817** («…بررسی و تأیید شده است»), and the booking answer at **821** («…دکمه «مشاوره رایگان»…»). |
| Generated meta descriptions | `seoInfra.js` **897** («…معیارهای انتخاب مرکز و مشاوره رایگان سلام دکتر.»), **965** («…دستگاه‌های تأیید‌شده. رزرو مشاوره رایگان.»), **967–968**, and the category defaults at **107–131**. |
| Hub template | `views/directory.ejs`: header CTA at **197** «مشاوره رایگان». Rating pill at **219–231** (`stats.ratingValue` and «(<%= stats.reviewCount %> نظر)»). Trust badges at **233–253** («تضمین اصالت مجوز پزشکی», «بررسی تخصصی تیم سلام دکتر», «مشاوره اولیه رایگان»). Bottom CTA at **429** «کارشناسان سلام دکتر بهترین مرکز … را متناسب با شرایط شما معرفی می‌کنند.» |
| Hard-coded hub stats | `seoRouter.js` **~401** `ratingValue: 4.8, reviewCount: 0`. Fallback clinic cards at **301** and **342** `rating: { value: 4.8, count: 12 }`. |
| Hub AggregateRating | `seoInfra.js` **724–728** is already guarded by `reviewCount > 0`; keep the guard. Also check `jsonLdMedicalEntity.js:121` and `uploads/seoRouter.js:122–138` (a stale copy; see §3f). |
| Device claims in seo-config | `seo-config.js:61` (Candela «مدارک اصالت دستگاه کندلا…»). Search seo-config for every «بررسی و تأیید» / «تایید شده» and for the HIFU and men's-laser entries. |
| Other «مشاوره رایگان» | `views/city-hub.ejs:43`, `views/article.ejs:151` and `:245`, `views/_cta-hub-widget.ejs:31`, `views/_featured-clinic-banner.ejs:98`, `views/html-sitemap.ejs:89`, `assets/js/shared.js:404` and `shared.js:218` (FAQ «آیا مشاوره رایگان است؟»), every `seo-config.js` description «…مقایسه مراکز معتبر + مشاوره رایگان با سلام دکتر.» (about 27), and the static `*.html` pages. |
| sitemap.xml | Static `sitemap.xml` at the repo root, served by nginx through the bind mount (`deploy/nginx-seo-performance.conf` 14–21). The dynamic fallback is `seoInfra.js` `handleSitemap`, with a regenerate script at `scripts/deploy-sync-sitemap.sh` → `scripts/generate-sitemap.js`. |

---

## 1. Make the aa95ad2 copy render on `/shiraz/skin-biopsy` and `/shiraz/wart-cryotherapy`

- Confirm both `seo-config.js` entries carry the enriched `seoDescription` (5 H2s each, counting the template's) and `faqs`: skin-biopsy 6 visible FAQs in total, wart-cryotherapy 9.
- If a DB `LocalHubSeo` row exists for either slug, leave it; seo-config takes precedence. If you find that seo-config is **not** actually winning, write `scripts/patch-local-hub-seo-ymyl.js`, which upserts the same copy idempotently with Prisma. No SQL dumps.
- The visible FAQ (`<details>`/`<summary>`) and the FAQPage JSON-LD must match **one-to-one** in order and in question text. Remove duplicates where a seo-config FAQ and a generated FAQ ask the same thing; for example, keep only one cost question.
- The cost answers stay as they are, ending exactly «قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند.»
- **YMYL wording fixes in the new copy:**
  - wart: in «…مهارت بالای پزشک برای جلوگیری از اسکار است», change «جلوگیری از» to «کاهش احتمال». It must not promise no scar.
  - biopsy: make sure the copy says the final diagnosis is only made from the **pathology report, interpreted by the treating doctor**. Add: «تشخیص نهایی فقط بر اساس جواب پاتولوژی و تفسیر پزشک معالج است؛ این صفحه جایگزین معاینه پزشک نیست.»
  - Avoid any statement that a lesion "is not cancer" or "is benign" without a biopsy.
- **Citation artifacts:** run `grep -rnE '\[cite(:|_start|_end)?[^]]*\]|\[\^?[0-9]+\]' -- . ':!node_modules' ':!shirazbeauty'` and remove every hit in content: `seo-config.js`, `articles/`, `views/`, `*.html`, `*.md` that feed pages, and DB patch scripts.

## 2. sitemap.xml

`sitemap.xml` at the repo root already has `<lastmod>2026-10-25</lastmod>` for these two URLs (aa95ad2). Keep every other lastmod as it is. If you regenerate with `scripts/generate-sitemap.js`, make sure it doesn't bump every URL to today; if it would, edit the two lines by hand. It goes live through the deploy step below, since nginx serves the bind-mounted file.

## 3. Shared hub template: claims (all `/shiraz/*` hubs; Nahal excluded)

**a. No rating when there are 0 reviews.** In `views/directory.ejs` 219–231, render the rating pill only `if (stats.reviewCount > 0 && stats.ratingValue)`. Remove `ratingValue: 4.8` from `seoRouter.js` ~401 (set `ratingValue: null`). In `seoRouter.js` 301 and 342, use the clinic's real rating fields only, falling back to `null`, never `{4.8, 12}`; cards hide the stars when there's no real count. `_featured-clinic-banner.ejs:73` and `_clinic-card.ejs` must hide «(0 نظر)» when the count is 0. **Nahal's real data (206) renders exactly as before.** No AggregateRating anywhere with `reviewCount` 0 or missing.

**b. «مشاوره رایگان» / «مشاوره اولیه رایگان»: replace them everywhere.**
- CTA buttons (directory.ejs 197, city-hub.ejs 43, article.ejs 151, html-sitemap.ejs 89, static HTML headers) → «درخواست نوبت مشاوره»
- `_featured-clinic-banner.ejs:98` «رزرو وقت و مشاوره رایگان» → «درخواست نوبت مشاوره»
- `_cta-hub-widget.ejs:31` → «لیست مقایسه‌ای مراکز معرفی‌شده در سلام دکتر — همه در یک صفحه:» (this also drops «دستگاه اصل» and «امتیاز واقعی بیماران»)
- `seo-config.js` descriptions «…مقایسه مراکز معتبر + مشاوره رایگان با سلام دکتر.» → «…معرفی مراکزی که تیم سلام دکتر حضوری از آن‌ها بازدید کرده است.» Find and replace the whole suffix and keep each entry's prefix.
- `seoInfra.js` 107–131: replace «، قیمت و مشاوره رایگان» and «+ مشاوره رایگان با سلام دکتر» with «؛ معرفی مراکزی که تیم سلام دکتر حضوری از آن‌ها بازدید کرده است.»
- `seoInfra.js` 897 → `راهنمای ${data.service.name} در ${data.city}؛ معیارهای انتخاب مرکز و پرسش‌های پیش از مراجعه.`
- `seoInfra.js` 965 → `؛ ${count} مرکز معرفی‌شده پس از بازدید حضوری تیم سلام دکتر.` (drops «تجهیزات اصل و دستگاه‌های تأیید‌شده» and «رزرو مشاوره رایگان»)
- `seoInfra.js` 967–968: drop «نکات هزینه و مشاوره رایگان» and «+ مشاوره رایگان با سلام دکتر», and end with «…معیارهای انتخاب مرکز در سلام دکتر.»
- `seoInfra.js` 821 booking FAQ answer → «روی دکمه «درخواست نوبت مشاوره» در کارت مرکز موردنظر بزنید یا با شماره سلام دکتر تماس بگیرید تا درخواست شما به مرکز منتقل شود.»
- `shared.js:218` / `assets/js/shared.js:404` FAQ «آیا مشاوره رایگان است؟» → Q «آیا جلسه مشاوره هزینه دارد؟» A «شرایط جلسه مشاوره را هر مرکز خودش تعیین می‌کند. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند.»

**c. Trust badges** in `directory.ejs` 233–253. Replace the three `<li>` texts with:
1. «بازدید حضوری و قرارداد با مرکز»
2. «معرفی مراکز، نه توصیه پزشکی»
3. «درخواست نوبت مشاوره»

**d. Device claims.**
- `seoInfra.js:817` answer → «سلام دکتر اصالت دستگاه‌ها را تأیید نمی‌کند. پیش از درمان، نام دقیق دستگاه، مدل و مدارک ورود رسمی آن را از خود مرکز بپرسید و در صورت تردید از نمایندگی رسمی سازنده استعلام کنید.»
- `seo-config.js:61` (Candela) and every other seo-config FAQ or description that says equipment was «بررسی و تأیید شده», «تایید شده» or «دستگاه اصل تأییدشده» (Candela, HIFU / `hifu-doublo-gold`, men's laser, any `laser-*`) gets the same neutral answer, with the device name substituted where the question names one.
- Remove «دستگاه اصل» / «دستگاه‌های تأیید‌شده» claims from hub descriptions.
- Hub-level `withAuthenticDevice` badges must not render unless a real flag is stored in the data. Nahal's own badge stays.

**e. Endorsement wording.**
- `directory.ejs:429` → «کارشناسان سلام دکتر فهرست مراکز <%= service.name %> را همراه با اطلاعات تماس در اختیار شما می‌گذارند؛ انتخاب نهایی با شما و پزشک معالج است.»
- `article.ejs:245` → «کارشناسان سلام دکتر فهرست مراکز معرفی‌شده را در اختیار شما می‌گذارند؛ انتخاب نهایی با شما و پزشک معالج است.»

**f. Stale copies.** `uploads/seo-config.js` and `uploads/seoRouter.js` are stale duplicates. Confirm nothing `require`s or serves them; nginx serves `/uploads` from `./uploads`, which would expose source code. If nothing uses them, `git rm` them. If something does, apply the same edits and tell me why it's used.

**g. Disclosure.** Keep the existing paid-listing disclosure on every hub. If a hub is missing it, add this under the clinic list: «مراکز معرفی‌شده برای حضور در سلام دکتر هزینه پرداخت می‌کنند و ترتیب نمایش به معنای توصیه پزشکی نیست.»

## 4. Deploy (required: this is why aa95ad2 didn't show)

On the server, in the deployed checkout:
```bash
git fetch origin && git checkout cursor/seo-hub-sitemap-consolidation && git pull --ff-only
git rev-parse --short HEAD          # must equal the new commit
docker compose up -d --build backend   # Dockerfile COPYs server.js/views etc.; restart reloads seo-config.js
docker compose restart web             # nginx re-reads bind-mounted sitemap.xml/static files
```
Then purge Cloudflare for `/sitemap.xml` and `/shiraz/*`, or wait one hour for the `max-age=3600` to expire, and run `bash check.sh`.

## 5. Acceptance

Run `bash check.sh` (it's next to this prompt as `2026-10-25-check.sh`). It tests every `/shiraz/*` URL in the live `sitemap.xml`. Every line must say PASS.
