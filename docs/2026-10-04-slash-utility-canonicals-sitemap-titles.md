# Cursor prompt: trailing-slash 301s on /articles, utility canonicals, sitemap.xml cleanup, neutral hub cost FAQs, price-free hub titles, article hero (salam-doctor.com)

**Site:** https://salam-doctor.com
**Standing rules:** One-hop 301 only. Every indexable page: self-canonical = og:url = sitemap `<loc>` = internal hrefs, all the identical bare root-absolute URL. **Don't touch the Nahal clinic badge («تاییدشده سلام دکتر»), its rating/review count, or any clinic card.** Don't change hub canonicals, H1s (none contain قیمت/هزینه), body copy outside the items below, or existing correct redirects. After deploy, reply `deployed` + the real short SHA (run `git rev-parse --short HEAD` and paste its **output**, not the command) + the acceptance output.

All Persian text you need is embedded below. Copy it exactly (including ZWNJ characters such as «می‌کند»). Live state was verified on 2026-10-04 (Tehran).

---

## 1. Trailing slash on /articles: one-hop 301 to bare

**Live now:** every `/articles/{slug}/` and `/articles/` returns **200** (a duplicate of the bare page, with the canonical pointing at the bare URL). Hubs already do this correctly: `/shiraz/hair-transplant/` 301s to `/shiraz/hair-transplant`. The guard `/articles/articles/*` already 301s to `/articles/*` (including a trailing slash). Keep it.

Affected (all currently 200 with a slash):
`/articles/`, `/articles/best-hair-transplant-center-shiraz/`, `/articles/body-contouring-clinic-guide/`, `/articles/botox-filler-guide/`, `/articles/fit-hair-transplant-cost/`, `/articles/hair-loss-treatment-comparison/`, `/articles/laser-hair-removal-comparison/`, `/articles/mesotherapy-vs-prp-hair-loss/`, `/articles/rhinoplasty-care-guide/`

**Implement:** use the same mechanism the `/shiraz/*` hubs use. Any `/articles/` or `/articles/{slug}/` 301s **in one hop** to the slash-less URL, preserving the query string. Also `/articles/{slug}.html/` goes in one hop to `/articles/{slug}`, never via `.html`. This must apply to future articles automatically, not as a per-slug list.

**Also (same pattern, found live):** the utility pages `/about/`, `/category/`, `/clinic-promote/`, `/contact/`, `/faq/`, `/products/` return 200 with a slash. Make them 301 in one hop to the bare URL too.

## 2. Utility pages: bare canonical / og:url / internal hrefs

**Live now:** the `.html` versions already 301 to bare (`/about.html` → `/about`, and `/category.html?type=laser` → `/category?type=laser` keeps the query string), **but** each bare page declares the `.html` URL as canonical, which sends Google in a loop:

| Page (200) | Current canonical | Current og:url | `.html` in JSON-LD url/@id |
|---|---|---|---|
| /about | https://salam-doctor.com/about.html | (missing) | no |
| /category | https://salam-doctor.com/category.html | https://salam-doctor.com/category.html | yes |
| /clinic-promote | https://salam-doctor.com/clinic-promote.html | https://salam-doctor.com/clinic-promote.html | no |
| /contact | https://salam-doctor.com/contact.html | https://salam-doctor.com/contact.html | yes |
| /faq | https://salam-doctor.com/faq.html | (missing) | no |
| /products | https://salam-doctor.com/products.html | https://salam-doctor.com/products.html | yes |

**Implement:**
1. On each of the six pages, set canonical and og:url to `https://salam-doctor.com/{page}` (bare). **Add** og:url to /about and /faq. Replace every `.html` URL in their JSON-LD (`url`, `@id`, `item`, `mainEntityOfPage`, breadcrumbs) with the bare URL.
2. **Internal hrefs, site-wide (all templates, header, footer, nav, JS-rendered menus):** replace every link to these pages with the root-absolute bare path. Live counts found in rendered HTML: `/clinic-promote.html` ×55, `/faq.html` ×37, `/about.html` ×37, relative `about.html` ×20, `products.html` ×14, `faq.html` ×10, `category.html` ×2, plus absolute `https://salam-doctor.com/{about,faq,contact,products,category,clinic-promote}.html` ×1 each. Each one becomes `/about`, `/faq`, `/contact`, `/products`, `/category` or `/clinic-promote`, keeping any `?query` or `#hash`. No relative `about.html`-style links may remain.
3. Leave the existing `.html` → bare 301s as they are.

## 3. sitemap.xml: only bare 200 self-canonical URLs

**Live now:** `sitemap.xml` has 45 `<loc>`. Six are `.html` URLs that 301: `https://salam-doctor.com/about.html`, `/category.html`, `/clinic-promote.html`, `/contact.html`, `/faq.html`, `/products.html`. The other 39 (/, /articles, /doctor/nahal-clinic, /shiraz and 35 /shiraz/* hubs) are 200 and self-canonical.

**Implement:**
1. Replace the six `.html` `<loc>` with their bare URLs (`https://salam-doctor.com/about` and so on). This is valid only once item 2 makes them self-canonical; if a bare utility page can't be made self-canonical, drop it from the sitemap instead.
2. Make sure no `<loc>` ends in `.html` or `/` (except the homepage `https://salam-doctor.com/`), and that every `<loc>` returns 200 with a canonical equal to itself. If the sitemap is generated, fix the generator.
3. Set `<lastmod>` to the deploy date (YYYY-MM-DD) for every URL changed in this deploy: the six utility pages and every hub touched in items 4 and 5. Leave the others unchanged.
4. Don't add articles to `sitemap.xml` (they live in `sitemap-articles.xml`).

## 4. Hub cost FAQ: neutral wording (visible FAQ **and** FAQPage JSON-LD)

**Live now:** **35** hubs (not just 20) carry the same template answer «هزینه {service} در شیراز بسته به مرکز، تجهیزات و تعداد جلسات متفاوت است؛ برای قیمت دقیق مشاوره رایگان بگیرید.». It says "sessions" even for surgery and hair, and pushes «مشاوره رایگان». The question text stays the same. Replace **only the answer**, identically in the visible `<details>` FAQ and in the FAQPage JSON-LD `acceptedAnswer.text`. If the answer comes from one shared template/data field, change it at the source, add a per-service override map, and make sure the JSON-LD and the visible text read from the same value.

No digits (other than those in a service name such as «۲۰۲۶»/«CO2») and no «مشاوره رایگان» in these answers. Leave the other FAQ questions as they are (for example dentistry's «هزینه تقریبی خدمات دندانپزشکی به چه عواملی بستگی دارد؟» and rhinoplasty's «هزینه عمل بینی به چه عواملی بستگی دارد؟» stay unchanged).

| Hub | Question (unchanged) | New answer (exact) |
|---|---|---|
| /shiraz/botox | هزینه بوتاکس در شیراز چقدر است؟ | هزینه بوتاکس در شیراز به نوع و برند ماده تزریقی، مقدار لازم، ناحیه درمان، تعداد جلسات و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/breast-surgery | هزینه جراحی سینه در شیراز چقدر است؟ | هزینه جراحی سینه در شیراز به نوع و پیچیدگی عمل، تخصص و تجربه جراح، نوع بیهوشی، امکانات مرکز درمانی و مراقبت‌های پس از عمل بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/buccal-fat | هزینه بوکال فت در شیراز چقدر است؟ | هزینه بوکال فت در شیراز به نوع و پیچیدگی عمل، تخصص و تجربه جراح، نوع بیهوشی، امکانات مرکز درمانی و مراقبت‌های پس از عمل بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/co2-fractional-laser | هزینه لیزر CO2 فرکشنال در شیراز چقدر است؟ | هزینه لیزر CO2 فرکشنال در شیراز به نوع دستگاه، ناحیه درمان، تعداد جلسات لازم و تجربه پزشک یا اپراتور بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/cosmetic-surgery | هزینه جراحی زیبایی در شیراز چقدر است؟ | هزینه جراحی زیبایی در شیراز به نوع و پیچیدگی عمل، تخصص و تجربه جراح، نوع بیهوشی، امکانات مرکز درمانی و مراقبت‌های پس از عمل بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/dentistry | هزینه دندانپزشکی در شیراز چقدر است؟ | هزینه دندانپزشکی در شیراز به نوع خدمت، مواد مصرفی، تعداد جلسات و تخصص و تجربه دندانپزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/dermatology | هزینه پوست و مو در شیراز چقدر است؟ | هزینه پوست و مو در شیراز به روش درمان، تعداد جلسات لازم، دستگاه و محصولات مورد استفاده و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/ear-piercing | هزینه پیرسینگ گوش در شیراز چقدر است؟ | هزینه پیرسینگ گوش در شیراز به روش و ابزار سوراخ کردن، نوع گوشواره اولیه و مراقبت‌های بعدی بستگی دارد. قیمت دقیق را مرکز پیش از انجام کار، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/eyebrow-transplant | هزینه کاشت ابرو در شیراز چقدر است؟ | هزینه کاشت ابرو در شیراز به روش کاشت، تعداد گرافت لازم، تجربه پزشک و تجهیزات مرکز بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/facial | هزینه فیشیال در شیراز چقدر است؟ | هزینه فیشیال در شیراز به روش درمان، تعداد جلسات لازم، دستگاه و محصولات مورد استفاده و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/femto-lasik | هزینه فمتولیزیک در شیراز چقدر است؟ | هزینه فمتولیزیک در شیراز به روش اصلاح دید، دستگاه مورد استفاده، معاینات پیش از عمل و تجربه جراح بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/fillers | هزینه فیلر و ژل در شیراز چقدر است؟ | هزینه فیلر و ژل در شیراز به نوع و برند ماده تزریقی، مقدار لازم، ناحیه درمان، تعداد جلسات و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/fotona-laser | هزینه لیزر فوتونا در شیراز چقدر است؟ | هزینه لیزر فوتونا در شیراز به نوع دستگاه، ناحیه درمان، تعداد جلسات لازم و تجربه پزشک یا اپراتور بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/hair-transplant | هزینه کاشت مو در شیراز چقدر است؟ | هزینه کاشت مو در شیراز به روش کاشت، تعداد گرافت لازم، تجربه پزشک و تجهیزات مرکز بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/hair-transplant-installment | هزینه کاشت مو اقساطی در شیراز چقدر است؟ | هزینه کاشت مو اقساطی در شیراز به روش کاشت، تعداد گرافت لازم، تجربه پزشک، تجهیزات مرکز و شرایط اقساط (مبلغ پیش‌پرداخت و تعداد چک‌ها) بستگی دارد. مبلغ دقیق و شرایط پرداخت را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/hifu-doublo-gold | هزینه هایفو دابلو گلد در شیراز چقدر است؟ | هزینه هایفو دابلو گلد در شیراز به نوع دستگاه، ناحیه درمان، تعداد جلسات لازم و تجربه پزشک یا اپراتور بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/injectables | هزینه زیبایی و تزریقات در شیراز چقدر است؟ | هزینه زیبایی و تزریقات در شیراز به نوع و برند ماده تزریقی، مقدار لازم، ناحیه درمان، تعداد جلسات و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/laser-candela-2026 | هزینه لیزر کندلا ۲۰۲۶ در شیراز چقدر است؟ | هزینه لیزر کندلا ۲۰۲۶ در شیراز به نوع دستگاه، ناحیه درمان، تعداد جلسات لازم و تجربه پزشک یا اپراتور بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/laser-hair-removal | هزینه لیزر موهای زائد در شیراز چقدر است؟ | هزینه لیزر موهای زائد در شیراز به نوع دستگاه، ناحیه درمان، تعداد جلسات لازم و تجربه پزشک یا اپراتور بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/laser-surgery | هزینه لیزر و جراحی در شیراز چقدر است؟ | هزینه لیزر و جراحی در شیراز به نوع دستگاه، ناحیه درمان، تعداد جلسات لازم و تجربه پزشک یا اپراتور بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/laser-titanium-2026 | هزینه لیزر تیتانیوم در شیراز چقدر است؟ | هزینه لیزر تیتانیوم در شیراز به نوع دستگاه، ناحیه درمان، تعداد جلسات لازم و تجربه پزشک یا اپراتور بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/lasik | هزینه لیزیک در شیراز چقدر است؟ | هزینه لیزیک در شیراز به روش اصلاح دید، دستگاه مورد استفاده، معاینات پیش از عمل و تجربه جراح بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/light-therapy | هزینه لایت تراپی در شیراز چقدر است؟ | هزینه لایت تراپی در شیراز به نوع دستگاه، ناحیه درمان، تعداد جلسات لازم و تجربه پزشک یا اپراتور بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/mens-laser-shiraz | هزینه لیزر موهای زائد آقایان در شیراز چقدر است؟ | هزینه لیزر موهای زائد آقایان در شیراز به نوع دستگاه، ناحیه درمان، تعداد جلسات لازم و تجربه پزشک یا اپراتور بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/mesotherapy | هزینه مزوتراپی در شیراز چقدر است؟ | هزینه مزوتراپی در شیراز به نوع و برند ماده تزریقی، مقدار لازم، ناحیه درمان، تعداد جلسات و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/micro-fit-hair-transplant | هزینه کاشت مو Micro FIT در شیراز چقدر است؟ | هزینه کاشت مو Micro FIT در شیراز به روش کاشت، تعداد گرافت لازم، تجربه پزشک و تجهیزات مرکز بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/mole-removal | هزینه برداشتن خال در شیراز چقدر است؟ | هزینه برداشتن خال در شیراز به روش برداشتن خال، تعداد و اندازه خال‌ها، نیاز به آزمایش پاتولوژی و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/pharmacy | هزینه داروخانه در شیراز چقدر است؟ | هزینه خرید از داروخانه در شیراز به نوع و برند دارو یا مکمل و پوشش بیمه بستگی دارد. قیمت دقیق هر قلم را داروخانه اعلام می‌کند. |
| /shiraz/pore-treatment | هزینه درمان منافذ باز پوست در شیراز چقدر است؟ | هزینه درمان منافذ باز پوست در شیراز به روش درمان، تعداد جلسات لازم، دستگاه و محصولات مورد استفاده و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/prk | هزینه پی‌آر‌کی در شیراز چقدر است؟ | هزینه پی‌آر‌کی در شیراز به روش اصلاح دید، دستگاه مورد استفاده، معاینات پیش از عمل و تجربه جراح بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/rhinoplasty | هزینه جراحی بینی در شیراز چقدر است؟ | هزینه جراحی بینی در شیراز به نوع و پیچیدگی عمل، تخصص و تجربه جراح، نوع بیهوشی، امکانات مرکز درمانی و مراقبت‌های پس از عمل بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/skin-biopsy | هزینه نمونه‌برداری پوستی در شیراز چقدر است؟ | هزینه نمونه‌برداری پوستی در شیراز به روش نمونه‌برداری، تعداد نمونه‌ها، آزمایش پاتولوژی و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/skin-rejuvenation | هزینه جوانسازی پوست در شیراز چقدر است؟ | هزینه جوانسازی پوست در شیراز به روش درمان، تعداد جلسات لازم، دستگاه و محصولات مورد استفاده و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/slimming | هزینه لاغری و پیکرتراشی در شیراز چقدر است؟ | هزینه لاغری و پیکرتراشی در شیراز به روش درمان (دستگاهی، تزریقی یا جراحی)، ناحیه و وسعت درمان، تعداد جلسات و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |
| /shiraz/wart-cryotherapy | هزینه درمان زگیل تناسلی در شیراز چقدر است؟ | هزینه درمان زگیل تناسلی در شیراز به روش درمان (مانند کرایو یا لیزر)، وسعت ضایعه، تعداد جلسات لازم و تجربه پزشک بستگی دارد. قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند. |

## 5. Remove «قیمت» / «هزینه» from hub `<title>`, og:title, twitter:title

**Live now:** 25 hubs have «قیمت» or «هزینه» in `<title>`, og:title and twitter:title (all three are currently identical per hub). **No hub H1 contains either word, so leave the H1s alone.** Set all three tags to the new value below (identical across the three). Leave meta descriptions untouched in this deploy.

Titles contain literal `|` characters, so they're listed below rather than in a table. Copy the text between « » exactly (spaces around each `|` included).

- `/shiraz/botox`
  - current: «بهترین مراکز تزریق بوتاکس در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (57 chars): «بهترین مراکز تزریق بوتاکس در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/breast-surgery`
  - current: «بهترین مراکز جراحی سینه در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (55 chars): «بهترین مراکز جراحی سینه در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/buccal-fat`
  - current: «بهترین مراکز بوکال فت در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (53 chars): «بهترین مراکز بوکال فت در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/co2-fractional-laser`
  - current: «لیزر CO2 فرکشنال در شیراز | جای جوش و اسکار + هزینه | سلام دکتر»
  - new (60 chars): «بهترین مراکز لیزر CO2 فرکشنال در شیراز | جای جوش | سلام دکتر»
- `/shiraz/cosmetic-surgery`
  - current: «بهترین مراکز جراحی زیبایی در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (57 chars): «بهترین مراکز جراحی زیبایی در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/dentistry`
  - current: «دندانپزشکی در شیراز | راهنمای انتخاب مرکز و قیمت | سلام دکتر»
  - new (53 chars): «بهترین مراکز دندانپزشکی در شیراز | راهنما | سلام دکتر»
- `/shiraz/dermatology`
  - current: «بهترین مراکز پوست و مو در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (54 chars): «بهترین مراکز پوست و مو در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/ear-piercing`
  - current: «بهترین مراکز پیرسینگ گوش در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (56 chars): «بهترین مراکز پیرسینگ گوش در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/eyebrow-transplant`
  - current: «بهترین مراکز کاشت ابرو در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (54 chars): «بهترین مراکز کاشت ابرو در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/facial`
  - current: «بهترین مراکز فیشیال پوست در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (56 chars): «بهترین مراکز فیشیال پوست در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/femto-lasik`
  - current: «بهترین مراکز فمتولیزیک در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (54 chars): «بهترین مراکز فمتولیزیک در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/fillers`
  - current: «بهترین مراکز فیلر و ژل در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (54 chars): «بهترین مراکز فیلر و ژل در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/fotona-laser`
  - current: «بهترین مراکز لیزر فوتونا در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (56 chars): «بهترین مراکز لیزر فوتونا در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/hair-transplant`
  - current: «بهترین مراکز کاشت مو و ابرو در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (59 chars): «بهترین مراکز کاشت مو و ابرو در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/hifu-doublo-gold`
  - current: «مرکز هایفو دابلو گلد در شیراز + قیمت هایفوتراپی صورت و غبغب»
  - new (50 chars): «بهترین مرکز هایفو دابلو گلد در شیراز | صورت و غبغب»
- `/shiraz/laser-candela-2026`
  - current: «کلینیک‌های دارای لیزر کندلا ۲۰۲۶ در شیراز + لیست قیمت فول بادی»
  - new (53 chars): «بهترین کلینیک‌های لیزر کندلا ۲۰۲۶ در شیراز | فول بادی»
- `/shiraz/laser-hair-removal`
  - current: «بهترین مراکز لیزر موهای زائد در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (60 chars): «بهترین مراکز لیزر موهای زائد در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/laser-surgery`
  - current: «بهترین مراکز لیزر و جراحی در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (57 chars): «بهترین مراکز لیزر و جراحی در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/laser-titanium-2026`
  - current: «بهترین مراکز لیزر تیتانیوم در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (58 chars): «بهترین مراکز لیزر تیتانیوم در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/lasik`
  - current: «بهترین مراکز لیزیک در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (50 chars): «بهترین مراکز لیزیک در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/mesotherapy`
  - current: «بهترین مراکز مزوتراپی در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (53 chars): «بهترین مراکز مزوتراپی در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/micro-fit-hair-transplant`
  - current: «کاشت مو به روش Micro FIT در شیراز + هزینه و نمونه کارها»
  - new (52 chars): «بهترین مرکز کاشت مو Micro FIT در شیراز | نمونه کارها»
- `/shiraz/mole-removal`
  - current: «بهترین مراکز برداشتن خال در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (56 chars): «بهترین مراکز برداشتن خال در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/skin-rejuvenation`
  - current: «بهترین مراکز جوانسازی پوست در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (58 chars): «بهترین مراکز جوانسازی پوست در شیراز | نوبت‌دهی | سلام دکتر»
- `/shiraz/slimming`
  - current: «بهترین مراکز لاغری و پیکرتراشی در شیراز | قیمت و نوبت‌دهی | سلام دکتر»
  - new (51 chars): «بهترین مراکز لاغری و پیکرتراشی در شیراز | سلام دکتر»

## 6. Article hero image (conditional)

**Live now:** `/articles/best-hair-transplant-center-shiraz` uses the fallback `/assets/images/articles/hair-transplant-cover.webp` (550×360) for the hero `<img>`, og:image, twitter:image and BlogPosting JSON-LD `image`. `https://salam-doctor.com/assets/images/articles/best-hair-transplant-center-shiraz.webp` currently returns **404**.

**Implement:**
- **If** `assets/images/articles/best-hair-transplant-center-shiraz.webp` exists in the repo: point all four references at it (hero `src="../assets/images/articles/best-hair-transplant-center-shiraz.webp"` or the root-absolute equivalent the template uses; absolute `https://salam-doctor.com/assets/images/articles/best-hair-transplant-center-shiraz.webp` for og:image, twitter:image and JSON-LD), and set the hero `width="1200" height="630"`. Keep the alt «راهنمای انتخاب بهترین مرکز کاشت مو در شیراز». Update the article's `dateModified` to the deploy date.
- **Otherwise:** change nothing and state in your reply: **"hero: dedicated image not in repo, fallback unchanged"**. Don't create, resize or rename image files.

---

## Acceptance (paste full output)
```bash
B=https://salam-doctor.com; CB="cb=$(date +%s)"
# --- 1. trailing slash -> one-hop 301
for p in articles articles/best-hair-transplant-center-shiraz articles/body-contouring-clinic-guide articles/botox-filler-guide articles/fit-hair-transplant-cost articles/hair-loss-treatment-comparison articles/laser-hair-removal-comparison articles/mesotherapy-vs-prp-hair-loss articles/rhinoplasty-care-guide about category clinic-promote contact faq products; do
  r=$(curl -s -m 20 -o /dev/null -w "%{http_code} %{redirect_url}" "$B/$p/"); echo "1 /$p/ -> $r"            # 301 https://salam-doctor.com/$p
  u=${r#* }; [ -n "$u" ] && t=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "$u") || t="none(no redirect)"; echo "   target $t"            # 200 (one hop)
done
curl -s -m 20 -o /dev/null -w "1 guard %{http_code} -> %{redirect_url}\n" $B/articles/articles/fit-hair-transplant-cost/   # 301 -> /articles/fit-hair-transplant-cost
curl -s -m 20 -o /dev/null -w "1 qs %{http_code} -> %{redirect_url}\n" "$B/articles/botox-filler-guide/?x=1"             # 301 -> /articles/botox-filler-guide?x=1
# --- 2. utility canonicals / og:url / hrefs
for p in about category clinic-promote contact faq products; do
  h=$(curl -s -m 20 "$B/$p?$CB")
  echo "2 /$p canon=$(echo "$h" | grep -oE 'rel="canonical" href="[^"]+"') og=$(echo "$h" | grep -oE 'og:url" content="[^"]+"') html_in_ld=$(echo "$h" | grep -cE '"(url|@id|item)": ?"[^"]*\.html')"   # canonical & og:url = $B/$p ; html_in_ld 0
done
for p in "" articles shiraz shiraz/botox shiraz/hair-transplant doctor/nahal-clinic articles/botox-filler-guide about faq contact; do
  echo "2 hrefs /$p $(curl -s -m 20 "$B/$p?$CB" | grep -cE 'href="[^"]*(about|category|clinic-promote|contact|faq|products)\.html')"   # each 0
done
# --- 3. sitemap.xml
curl -s -m 20 "$B/sitemap.xml?$CB" | grep -c '\.html</loc>'                                        # 0
for u in $(curl -s -m 20 "$B/sitemap.xml?$CB" | grep -oE '<loc>[^<]+' | sed 's/<loc>//'); do
  r=$(curl -s -m 20 -o /tmp/p.html -w "%{http_code}" "$u"); c=$(grep -oE 'rel="canonical" href="[^"]+"' /tmp/p.html | head -1 | sed 's/.*href="//;s/"//')
  [ "$r" = 200 ] && [ "$c" = "$u" ] || echo "3 BAD $u code=$r canon=$c"
done; echo "3 sitemap check done"                                                               # no BAD lines
# --- 4 + 5. hubs
for h in botox breast-surgery buccal-fat co2-fractional-laser cosmetic-surgery dentistry dermatology ear-piercing eyebrow-transplant facial femto-lasik fillers fotona-laser hair-transplant hair-transplant-installment hifu-doublo-gold injectables laser-candela-2026 laser-hair-removal laser-surgery laser-titanium-2026 lasik light-therapy mens-laser-shiraz mesotherapy micro-fit-hair-transplant mole-removal pharmacy pore-treatment prk rhinoplasty skin-biopsy skin-rejuvenation slimming wart-cryotherapy; do
  p=$(curl -s -m 20 "$B/shiraz/$h?$CB")
  ld=$(echo "$p" | python3 -c 'import sys,re,json; s=sys.stdin.read(); b=re.findall(r"<script type=.application/ld.json.>(.*?)</script>",s,re.S); [json.loads(j) for j in b]; print(len(b))' 2>/dev/null || echo FAIL)
  echo "4/5 $h toman=$(echo "$p" | grep -c 'تومان') freeconsult_in_costA=$(echo "$p" | grep -cE 'در شیراز[^<\"]*برای قیمت دقیق مشاوره رایگان') neutral=$(echo "$p" | grep -c 'به‌صورت کتبی اعلام می‌کند') title_price=$(echo "$p" | grep -oE '<title>[^<]*|og:title" content="[^"]*|twitter:title" content="[^"]*' | grep -cE 'قیمت|هزینه') jsonld_blocks=$ld"
done
# expected per hub: toman=0 freeconsult_in_costA=0 neutral>=2 (visible + JSON-LD; >=1 for the pharmacy hub is fine as long as both copies match) title_price=0 jsonld_blocks=a number (not FAIL)
# --- 6. hero
curl -s -m 20 "$B/articles/best-hair-transplant-center-shiraz?$CB" | grep -oE '<img src="[^"]*(cover|best-hair)[^"]*"[^>]*(width="[0-9]+" height="[0-9]+")?|og:image" content="[^"]+"|twitter:image" content="[^"]+"|"image": "[^"]+"'
curl -s -m 20 -o /dev/null -w "6 dedicated hero %{http_code}\n" $B/assets/images/articles/best-hair-transplant-center-shiraz.webp   # 200 if the file shipped (and all 4 refs point at it, 1200x630); otherwise report the fallback
# --- untouched
curl -s -m 20 "$B/shiraz/hair-transplant?$CB" | grep -c 'تاییدشده سلام دکتر'                      # unchanged (>=1)
git rev-parse --short HEAD
```

Commit: `seo: one-hop slash 301s (articles+utility), bare utility canonicals/hrefs, clean sitemap.xml, neutral hub cost FAQs, price-free hub titles, conditional article hero`
