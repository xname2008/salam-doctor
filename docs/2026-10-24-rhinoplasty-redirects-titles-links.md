# Cursor prompt: rhinoplasty article fixes, 3 one-hop 301s, light-therapy + about titles, hair-transplant article links (salam-doctor.com)

> ## ⚠️ READ FIRST, Jessie (not for Cursor to act on)
> - The repo is **still public** (checked 2026-10-24), and `.env` + `leads.db` are still tracked on `main`. The tree also tracks `db_backup.sql`, `live_data.sql`, `leads.json` and `certs/.htpasswd`, which probably hold personal data or credentials. Make the repo private and rotate the credentials. This prompt does not touch any of those files.
> - The 15 Oct work (`061e6ce`) is on the branch, but the live site isn't serving it yet. Live checks on 2026-10-24: `/doctor/clinic-99999` returns 200, `/doctor/sample-clinic-1` returns a 301, and `profile.html?id=101` takes two hops. Deploy this branch so both prompts go live together.
> - **Date correction:** 2026-10-24 is **۲ آبان ۱۴۰۵**, not ۳ آبان. 1 Aban 1405 is 2026-10-23, and the hair-transplant article's 2026-10-03 = ۱۱ مهر ۱۴۰۵ matches this. This prompt uses ۲ آبان ۱۴۰۵, which matches the JSON-LD `datePublished` 2026-10-24.

**Repo / branch:** `xname2008/salam-doctor`. Check out `cursor/seo-hub-sitemap-consolidation`, which contains `061e6ce`, and commit there. Keep the open PR into `main` open; don't merge it.
**Standing rules:**
- No prices: no «قیمت», «هزینه» or «تعرفه» with numbers, and no claims about how cheap or expensive anything is.
- No «مشاوره رایگان» in new copy.
- No medical reviewer, and no wording that implies a doctor reviewed anything. The byline stays «تیم تحریریه سلام دکتر».
- No endorsement claims («بهترین مرکز تاییدشده» and similar).
- Don't touch the Nahal badge, its ★4.8 (206) rating, or the disclosure line.
- Canonicals are bare root-absolute URLs. Redirects take one hop only.

**Do not:** read, edit, stage or delete `.env*`, `leads.db`, `*.db`, `*.sql` dumps, `leads.json` or `certs/`. Don't force-push, rewrite history or merge into `main`.
After you deploy, reply `deployed` + the output of `git rev-parse --short HEAD` + the output of `git rev-parse --abbrev-ref HEAD` + the output of `bash check.sh`.

---

## Live state (verified 2026-10-24, Asia/Tehran)

| URL | Now | Target |
|---|---|---|
| `/services/qswitch` | 200, self-canonical | 301 to `/shiraz/qswitch` (200) |
| `/articles/hair-loss-treatment-comparison` | 200, in `sitemap-articles.xml`, linked from `index.html:1003` | 301 to `/articles/mesotherapy-vs-prp-hair-loss` |
| `/articles/skin-rejuvenation-guide.html` (also bare and `/`) | 301 to `/articles/botox-filler-guide` (off-topic) | 301 to `/shiraz/skin-rejuvenation` |
| `/articles/best-rhinoplasty-surgeon-shiraz` | 200. Cost section has no closing sentence, no cost FAQ, empty «تاریخ انتشار:», title close to the hub | see §1 |
| `/shiraz/light-therapy` | title «لایت تراپی و نور درمانی در شیراز \| کاربرد و انتخاب مرکز», position 2–4, 0 clicks | §3 |
| `/about` | title «درباره سلام دکتر \| سایت معرفی کلینیک‌های زیبایی شیراز», 0 clicks | §3 |

## Where things live (from a read-only look at the branch)

- **Express redirects** are in `server.js`:
  - lines ~4236–4248 handle the trailing-slash case. The `slug === 'skin-rejuvenation-guide'` ternary and the `slashBare === '/articles/skin-rejuvenation-guide'` branch both point to `/articles/botox-filler-guide`.
  - lines ~4284–4294 handle the `decodedPath === '/articles/skin-rejuvenation-guide(.html|/)'` block, which points to the same place.
  - put the new one-hop rules right next to these, before any `/articles/:slug` or `/services/:slug` handler (search for `createBlogArticleHandlers`, line ~4073, and `serviceLanding`).
- **Nginx** is `nginx-site-locations.conf`, lines 257–265: three `location =` blocks for skin-rejuvenation-guide pointing to `/articles/botox-filler-guide`. Also check `deploy/host-nginx-salam-doctor.conf` and `deploy/nginx-local-seo.conf` for duplicates. Nginx answers before Express does, so both layers must agree.
- **The Cloudflare Worker** (mentioned in the comment at `server.js` ~4281) may also redirect `/articles/*.html`. If it maps `skin-rejuvenation-guide.html`, update it too, or the redirect becomes two hops.
- **Services:** `serviceSlugMap.js` has `qswitch` in `CANONICAL_SERVICE_SLUGS`. It is deliberately left out of `SERVICES_REDIRECTED_TO_HUB` (line ~169 comment). Add `'qswitch'` to `SERVICES_REDIRECTED_TO_HUB` and update the comment, so `/services/qswitch` returns a 301 to `serviceHubCanonicalPath('qswitch')`, which is `/shiraz/qswitch`. The Persian and alias slugs in `SERVICE_SLUG_REDIRECTS` must also land on `/shiraz/qswitch` in one hop, not via `/services/qswitch`. Remove `/services/qswitch` from the dynamic services sitemap.
- **Static articles** are in `articles/*.html`. The sitemap comes from `scripts/lib/static-articles-sitemap.js`, `scripts/update-sitemap-articles.js` and `scripts/generate-sitemap.js`, which write `sitemap-articles.xml` and `sitemap.xml`. The catalog is `articleCatalog.js`, `assets/js/articles-catalog.generated.js` (`scripts/sync-article-catalog.js`) and `articles.html`.
- **The rhinoplasty article is not a file in the repo.** There's no `articles/best-rhinoplasty-surgeon-shiraz.html`, so it is probably a Prisma `Article` row (`blogArticles.js`, admin.html). Its hero is `assets/images/articles/rhinoplasti.webp`. Edit it at its source (a DB row through the admin, or a seed/migration script). If you edit the DB, commit a reproducible script under `scripts/` (for example `scripts/patch-rhinoplasty-article.js`) instead of a dump. Say which path you used.
- **Hub copy** for `/shiraz/*` comes from `local-seo-registry.js`, the `local_hub_seo` table (`scripts/seed-local-hub-seo.js`) or `python/local_seo/*`. `hair-transplant.html` and `rhinoplasty.html` are the static hub templates. Find whichever actually renders `/shiraz/light-therapy`, `/shiraz/hair-transplant`, `/shiraz/rhinoplasty` and `/shiraz/laser-candela-2026`, and edit there.
- **Homepage:** `index.html`. Line 57 is the title. Lines 940 and 1002 already link `/articles/best-hair-transplant-center-shiraz`. Line 1003 links the duplicate article. **About:** `about.html`, line 31 for `<title>` and lines 16, 21 and 29 for the descriptions (meta, og, twitter).

---

## 1. `/articles/best-rhinoplasty-surgeon-shiraz`

**a. Title.** Make it different from the hub, which is «بهترین مراکز جراحی بینی در شیراز». Use these in `<title>`, `og:title` and the BlogPosting `headline`:
- `<title>`: «انتخاب جراح بینی در شیراز: معیارها و سوالات جلسه مشاوره | سلام دکتر»
- H1 and `headline`: «انتخاب جراح بینی در شیراز: معیارها، سبک‌های جراحی و سوالات جلسه مشاوره»
- meta, og and twitter description: «پیش از انتخاب جراح بینی در شیراز چه چیزهایی را بررسی کنیم؟ معیارهای صلاحیت، سبک طبیعی یا فانتزی، رینوپلاستی باز و بسته، پیزو و پرسش‌هایی که باید در جلسه مشاوره بپرسید.»

Keep the slug and the canonical `https://salam-doctor.com/articles/best-rhinoplasty-surgeon-shiraz`. The breadcrumb name «انتخاب جراح بینی در شیراز» stays.

**b. Section ۶.** Replace the opening paragraph that starts «هزینه جراحی بینی بسته به جراح…» with exactly this:
> هزینه جراحی بینی عدد ثابتی ندارد و به روش جراحی (باز، بسته یا پیزو)، جراح و تجربه او، میزان پیچیدگی عمل و نیاز به گرافت، و تجهیزات و محل انجام عمل بستگی دارد؛ به همین دلیل در این مقاله عددی ذکر نمی‌کنیم. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند.

- Keep ۶.۱ and ۶.۲ as they are; they have no figures.
- Change the heading «۶. تحلیل ارزش اقتصادی انتخاب جراح (بدون عدد و رقم)» to «۶. هزینه جراحی بینی به چه عواملی بستگی دارد؟».
- Make sure no number appears next to «قیمت», «هزینه», «تعرفه» or «تومان» anywhere on the page.

**c. Cost FAQ.** Add it in two places:
- as a visible FAQ item (last item)
- as a `Question` in the existing FAQPage JSON-LD, with text identical to the visible one

The question is «هزینه جراحی بینی در شیراز چقدر است؟». The answer is the same paragraph as in §1b, ending exactly with «قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند.»

**d. Publish date.** Fill the visible «تاریخ انتشار:» with **۲ آبان ۱۴۰۵**. Use `persianDate.js` / `assets/js/persian-date.js` from `publishedAt` if the template supports that; otherwise hardcode it. Fix the template so no article renders an empty date. `datePublished` stays `2026-10-24`.

**e. Internal links.**
- In section ۷ (recovery), or wherever recovery or swelling comes up, add a contextual link: `<a href="/articles/rhinoplasty-care-guide">مراقبت بعد از جراحی بینی و کاهش تورم</a>`.
- In `/articles/rhinoplasty-care-guide`, add a reverse link to `/articles/best-rhinoplasty-surgeon-shiraz` with the anchor «انتخاب جراح بینی در شیراز».
- On the hub `/shiraz/rhinoplasty`, add a link in the body copy, near the top and not only in the footer or related-articles box: «پیش از انتخاب، <a href="/articles/best-rhinoplasty-surgeon-shiraz">راهنمای انتخاب جراح بینی در شیراز و سوالات جلسه مشاوره</a> را بخوانید.»
- Add the article to the homepage "latest articles" block in `index.html`, next to line 1006.

## 2. One-hop 301s (nginx + Express + Worker all agree)

| From | To |
|---|---|
| `/services/qswitch` (and `/services/qswitch/`) | `/shiraz/qswitch` |
| `/articles/hair-loss-treatment-comparison`, `.html`, `/` | `/articles/mesotherapy-vs-prp-hair-loss` |
| `/articles/skin-rejuvenation-guide`, `.html`, `/` | `/shiraz/skin-rejuvenation` |

- For `hair-loss-treatment-comparison`:
  - remove it from `sitemap-articles.xml`, `sitemap.xml`, the sitemap generators, the article catalog, `articles.html` and the HTML sitemap (`htmlSitemap.js` / `views/html-sitemap.ejs`)
  - update every internal link, including `index.html:1003`, which becomes `/articles/mesotherapy-vs-prp-hair-loss` with the anchor «مقایسه مزوتراپی و PRP برای ریزش مو»
  - move `articles/hair-loss-treatment-comparison.html` to `_parked/` or delete it in git, so the static server can't serve a 200 first
- Run `grep -rn "hair-loss-treatment-comparison\|skin-rejuvenation-guide\|/services/qswitch"` over the tracked files and remove or retarget every link. The redirect rules themselves stay.
- Keep the botox-filler-guide KEEP 200; only the skin-rejuvenation-guide *source* changes.

## 3. Titles and descriptions (exact strings)

**`/shiraz/light-therapy`**
- `<title>`: «نور درمانی در شیراز | لایت تراپی پوست، کاربردها و انتخاب مرکز»
- meta description: «نور درمانی (لایت تراپی) در شیراز برای آکنه، جوانسازی و التهاب پوست چگونه انجام می‌شود؟ کاربردها، تعداد جلسات معمول، مراقبت‌ها و معیار انتخاب مرکز در سلام دکتر.»
- Also update og:title, og:description and the JSON-LD name if they copy the old strings. The H1 may stay.

**`/about`** (`about.html`)
- `<title>`: «درباره سایت دکتر سلام | معرفی کلینیک‌های زیبایی شیراز»
- meta, og and twitter description: «سایت دکتر سلام (سلام دکتر) کلینیک‌های پوست، مو و زیبایی شیراز را پس از بازدید حضوری تیم ما معرفی می‌کند. با شیوه انتخاب مراکز، ماموریت ما و راه‌های ارتباط آشنا شوید.»
- Keep the existing paid-listing disclosure on the page exactly as it is.

## 4. Links to `/articles/best-hair-transplant-center-shiraz`

Add a contextual link in the body copy, not a nav, footer or "related" card:
- **`/shiraz/hair-transplant`**, in the first or second paragraph of the intro: «اگر هنوز مرکز را انتخاب نکرده‌اید، <a href="/articles/best-hair-transplant-center-shiraz">راهنمای انتخاب بهترین مرکز کاشت مو در شیراز</a> معیارهای مقایسه و سوالات مشاوره را توضیح می‌دهد.»
- **`/doctor/nahal-clinic`**, in the intro or the hair-transplant department section (`clinic-intros/114.html` and/or `scripts/nahal-profile-intro.html`): «برای مقایسه مراکز کاشت مو، <a href="/articles/best-hair-transplant-center-shiraz">راهنمای انتخاب مرکز کاشت مو در شیراز</a> را ببینید.» Don't change the badge, rating, phones or disclosure.
- **`/shiraz/laser-candela-2026`**, in the body, wherever hair or hair removal is mentioned: «اگر علاوه بر لیزر به کاشت مو فکر می‌کنید، <a href="/articles/best-hair-transplant-center-shiraz">راهنمای انتخاب مرکز کاشت مو در شیراز</a> را بخوانید.»
- **Homepage:** it's already linked at `index.html:940` and `:1002`. Leave those as they are; adding more isn't needed.

Every link uses a bare root-absolute href with no `rel` attribute.

## 5. Acceptance

Run `bash check.sh` (next to this prompt as `2026-10-24-check.sh`; copy it to the repo root or run it from anywhere) against production after deploy, and paste the full output. Every line must say PASS.
