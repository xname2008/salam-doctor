# Cursor prompt: CTR titles for /shiraz/light-therapy and /doctor/nahal-clinic, a single robots meta on /category, neutral descriptions on 6 hubs, and a clean hub→article link (salam-doctor.com)

**Standing rules:** No prices (تومان / ریال / numeric price / «لیست قیمت»). Do not add «قیمت», «هزینه» or «مشاوره رایگان» to any text you write in this deploy. No medical-endorsement or review claims, and no invented facts: every fact below is already on the live page. Bare root-absolute canonicals stay as they are.
**Do not touch:** the Nahal badge («مرکز تایید شده» on the profile, «تاییدشده سلام دکتر» on hubs), any star rating / review count UI or schema, the paid-listing disclosure line, H1s, FAQ Q&As, body copy (except the hub lead paragraphs described in items 1 and 4, and only where they share their source with the meta description, plus the single `rel` attribute in item 5), «مشاوره رایگان» CTA **button labels**, or any other page.
After deploy, reply `deployed` + the real short SHA (run `git rev-parse --short HEAD` and paste its **output**, not the command) + the acceptance output.

All Persian text you need is below. Copy it exactly, including ZWNJ (e.g. «مراقبت‌ها»). Live state verified 2026-10-08 (Asia/Tehran) against the live site and `/workspace/daily-2026-10-08/gsc.json` (GSC data through 2026-10-05).

---

## 1. `/shiraz/light-therapy`: title + description for «لایت تراپی در شیراز» / «نور درمانی در شیراز»

**Why:** GSC 28 days: «لایت تراپی در شیراز» 12 impressions at position 2.75, «نور درمانی در شیراز» 13 impressions at position 2.6, both 0 clicks. The current snippet promises «بهترین کلینیک‌ها» while the page itself says the clinic list is «در حال تکمیل», and the description ends in «مشاوره رایگان».

**Current (static HTML, identical in all three title tags and all three description tags):**
- `<title>`, `og:title`, `twitter:title`: «لایت تراپی و نور درمانی در شیراز | بهترین کلینیک‌ها | سلام دکتر»
- `meta description`, `og:description`, `twitter:description`: «راهنمای لایت تراپی و نور درمانی در شیراز؛ کاربرد، مراقبت‌ها و معرفی مراکز پوست و زیبایی برای مشاوره رایگان.»
- JSON-LD `MedicalWebPage` (`@id` `https://salam-doctor.com/shiraz/light-therapy#webpage`) `"description"`: «راهنمای لایت تراپی در شیراز؛ معیارهای انتخاب مرکز و مشاوره رایگان سلام دکتر.»
- Visible lead `<p>` under the H1 (live line ~217) repeats the meta description text verbatim.

**New:**
- `<title>`, `og:title`, `twitter:title` (55 characters):
  «لایت تراپی و نور درمانی در شیراز | کاربرد و انتخاب مرکز»
- `meta description`, `og:description`, `twitter:description`, and the JSON-LD `MedicalWebPage` `"description"` (146 characters):
  «لایت تراپی یا نور درمانی در شیراز برای چه مشکلات پوستی مناسب است و درد دارد؟ کاربرد، مراقبت‌ها، معیار انتخاب مرکز و مراکز پوست مرتبط در سلام دکتر.»

**Implement:**
1. Change the hub's source data or template field for this slug (wherever the generator reads title and description), not just the built HTML, so a rebuild doesn't revert it. Change only `light-therapy`; other hubs keep their titles and descriptions.
2. Leave the JSON-LD `"name"` («لایت تراپی و نور درمانی در شیراز») and the H1 unchanged.
3. Visible lead `<p>`: if it renders from the same field as the meta description, let it show the new text (it has no prohibited words). If it has its own source, leave it alone and say so in your reply. Do not add new logic just for this.
4. Do not change the FAQ, the «مراکز مرتبط» block, the disclosure line or the rating UI.

---

## 2. `/doctor/nahal-clinic`: title + description with the address

**Why:** GSC 28 days: «کلینیک نهال شیراز» 136 impressions at position 10.6 with 1 click. «آدرس کلینیک نهال شیراز» 19 impressions at position 9.6 with 0 clicks. In the last 7 days the page had 111 impressions and 1 click (0.9% CTR). The current snippet says «آدرس» but never gives it.

**Facts already on the live page (use only these):** the address «شیراز- ستارخان- بین فرعی 4 و 6» (visible, and in JSON-LD `PostalAddress.streetAddress`), the «راه‌های ارتباطی» section, the «مسیریابی» button and «موقعیت روی نقشه» map, the «درخواست نوبت فوری» button, and the FAQ about «کاشت مو FIT و میکروگرافت». Do **not** use the footer address «روبروی پاسارگاد شرقی، جنب نگین عدالت»; that is salam-doctor's own address, not Nahal's.

**Current:**
- Static `<title>`, `og:title`, `twitter:title` **and** the JS `clinicProfileTitle(clinic)` output: «کلینیک نهال شیراز | پوست، مو و زیبایی | آدرس و نوبت | سلام دکتر» (65 characters, which gets truncated)
- Static `meta description`, `og:description`, `twitter:description` **and** the JS `clinicProfileDescription(clinic)` branch for `id === 114 || slug === 'nahal-clinic'`: «آدرس، تلفن و نوبت‌دهی کلینیک نهال در شیراز (پوست، مو، زیبایی و کاشت مو). مشاهده جزئیات و رزرو از طریق سلام دکتر.»
- `updateProfileMeta()` rewrites `document.title`, the description, `og:*` and `twitter:*` at runtime from those two functions, so the static tags **and** the JS must both change, or Google's rendered title will revert to the old text.

**New:**
- Title (57 characters):
  «کلینیک نهال شیراز | ستارخان، بین فرعی ۴ و ۶ | آدرس و نوبت»
- Description (148 characters; **no phone number**, because the hubs show 09016594365 while the profile shows 07136265696 and that conflict is unresolved, so do not put either number in the title or description):
  «آدرس کلینیک نهال شیراز: ستارخان، بین فرعی ۴ و ۶. مسیریابی روی نقشه، راه‌های ارتباطی و درخواست نوبت برای پوست، مو، زیبایی و کاشت مو FIT و میکروگرافت.»

**Implement:**
1. Static head: set `<title>`, `og:title`, `twitter:title` to the new title, and `meta description`, `og:description`, `twitter:description` to the new description.
2. JS: in `clinicProfileTitle(clinic)`, add a Nahal-only branch (same condition as `clinicProfileDescription`: `id === 114 || slug === 'nahal-clinic'`) that returns the new title. **Keep the generic return for every other clinic unchanged.** In `clinicProfileDescription(clinic)`, replace the Nahal string with the new description.
3. If the profile is generated from a shared template or a clinic data file, make the same change at the source so a rebuild keeps it.
4. Do **not** change `clinicLocalSeoHeadline` / the H1 («کلینیک نهال شیراز | پوست، مو و زیبایی»), the JSON-LD address, the badge «مرکز تایید شده», the ratings, the FAQ or the disclosure line. Do not change the visible address format.

---

## 3. `/category` and `/category?type=*`: one robots meta

**Current:** the head has `<meta name="robots" content="noindex,follow">` **twice** (live lines 16 and 19, around `<title>` and the description).
**Implement:** remove one, so exactly one `<meta name="robots" content="noindex,follow">` remains in the static head for `/category` and every `?type=` variant. Do not change its value, the canonical, the sitemap exclusion or the JS `catMeta` title logic. Make sure no JS adds a second robots tag.

---

## 4. Neutral meta descriptions on the 6 hubs that still say «قیمت», «هزینه» or «تعرفه»

**Live check 2026-10-08:** I checked all 35 `/shiraz/` hubs in `sitemap.xml`. These 6 have «قیمت», «هزینه» or «تعرفه» (which counts as price) in `meta description`, `og:description` and `twitter:description` (all three tags identical): `co2-fractional-laser`, `hair-transplant`, `hifu-doublo-gold`, `laser-titanium-2026`, `mens-laser-shiraz`, `skin-rejuvenation`. On each one the visible lead `<p>` under the H1 repeats the same text. None of their JSON-LD `"description"` values repeat the meta description; those use the shared «راهنمای … در شیراز؛ معیارهای انتخاب مرکز و مشاوره رایگان سلام دکتر.» pattern and are **out of scope here, so leave them alone**.

Set all three description tags for each hub to the new text. Change the hub's source data or template field, not just built HTML, and leave every other hub alone. Where the lead `<p>` renders from the same field, let it show the new text. If it has its own source, leave it and say so. Titles, H1s, FAQ, badges, ratings, the disclosure line and the CTA labels stay unchanged.

| Hub | Current (description = og = twitter) | New (description = og = twitter) |
|---|---|---|
| `/shiraz/co2-fractional-laser` | «بهترین مراکز و کلینیک‌های لیزر CO2 فرکشنال در شیراز برای درمان جای جوش، اسکار و جوانسازی پوست به همراه مقایسه تعرفه و مشاوره رایگان با سلام دکتر.» | «لیزر CO2 فرکشنال در شیراز؛ کاربرد در جای جوش، اسکار و بهبود بافت پوست، تفاوت با لیزر CO2، معیارهای انتخاب مرکز، پرسش‌های رایج و پروفایل مراکز مرتبط.» (148 characters) |
| `/shiraz/laser-titanium-2026` | «معرفی برترین کلینیک‌های دارای دستگاه لیزر تیتانیوم و پلاتینیوم در شیراز به همراه مقایسه تعرفه و مشاوره رایگان در سلام دکتر.» | «لیزر موهای زائد با دستگاه تیتانیوم و پلاتینیوم در شیراز؛ مناسب چه پوست‌هایی است، تفاوت با کندلا، معیارهای انتخاب مرکز و پرسش‌های رایج در سلام دکتر.» (147 characters) |
| `/shiraz/hair-transplant` | «معرفی بهترین کلینیک‌های کاشت مو و ابرو در شیراز. مقایسه مراکز، قیمت و مشاوره رایگان با سلام دکتر.» | «راهنمای انتخاب مرکز کاشت مو و ابرو در شیراز؛ روش‌های FUT، FUE و DHI، نکات قبل از انتخاب مرکز، پرسش‌های رایج و پروفایل مراکز مرتبط در سلام دکتر.» (143 characters) |
| `/shiraz/hifu-doublo-gold` | «لیست کلینیک‌های دارای دستگاه هایفو دابلو گلد (HIFU Doublo Gold) در شیراز. مقایسه امتیاز کاربران و هزینه شات‌ها.» | «هایفو دابلو گلد (HIFU Doublo Gold) در شیراز؛ معیارهای انتخاب مرکز، روش نوبت‌گیری، پرسش‌های رایج و پروفایل مراکز مرتبط در سلام دکتر.» (131 characters) |
| `/shiraz/mens-laser-shiraz` | «لیست برترین کلینیک‌های لیزر ویژه آقایان در شیراز با فضا و اپراتور مجزا. مقایسه قیمت و دستگاه‌ها.» | «لیزر موهای زائد آقایان در شیراز؛ معیارهای انتخاب مرکز (مجوز، تجربه پزشک، نمونه کار)، پرسش‌های رایج و پروفایل مراکز مرتبط در سلام دکتر.» (134 characters) |
| `/shiraz/skin-rejuvenation` | «لیست کلینیک‌های جوانسازی و پوست در شیراز. مقایسه مراکز معتبر، قیمت و مشاوره رایگان با سلام دکتر.» | «جوانسازی پوست در شیراز؛ آشنایی با فیشیال، میکرونیدلینگ، هایفو و درمان‌های لیزری، نکات انتخاب مرکز، پرسش‌های رایج و پروفایل مراکز مرتبط در سلام دکتر.» (148 characters) |

Every new phrase maps to content already on that hub. Hair-transplant covers the FUT/FUE/DHI methods section, «چه نکاتی را قبل از انتخاب مرکز بررسی کنیم؟» and the FAQ. Skin-rejuvenation covers «روش‌های رایج جوانسازی پوست» (فیشیال، میکرونیدلینگ، هایفو، لیزر). HIFU and men's laser cover the FAQ criteria (مجوز، تجربه پزشک، نمونه کار) and «برای رزرو نوبت … چه کنیم؟». CO2 covers «لیزر CO2 فرکشنال چیست؟» and the FAQ (CO2 vs fractional CO2, suitable uses). Laser-titanium covers its FAQ (which skin types, titanium vs Candela, choosing a centre). Five of the six show a related clinic profile. **laser-titanium-2026 lists no clinic** («در حال تکمیل»), so its new text deliberately does not mention clinic profiles. The new text deliberately drops «امتیاز کاربران» (hifu) and «فضا و اپراتور مجزا» (mens-laser), because nothing on those pages supports them.

---

## 5. Hub → article link: drop `rel="noopener noreferrer"`

**Live:** in the `/shiraz/hair-transplant` body (inside `<main>`, after the checklist) the link is `<a href="/articles/best-hair-transplant-center-shiraz" rel="noopener noreferrer">چک‌لیست انتخاب مرکز کاشت مو و سوالات جلسه مشاوره</a>`. `noreferrer` on an internal link strips the referrer in analytics, and `noopener` does nothing without `target="_blank"`.

**Implement:** remove the `rel` attribute from that one link, so it reads `<a href="/articles/best-hair-transplant-center-shiraz">چک‌لیست انتخاب مرکز کاشت مو و سوالات جلسه مشاوره</a>`. Keep the href and anchor text exactly. If a body-copy sanitizer or link helper adds `rel` automatically, make it skip root-absolute internal hrefs (starting with `/`) instead of adding a one-off hack. That will also clean about 40 other internal hub links; that is acceptable, but list how many changed in your reply. Leave `rel` on external links as it is.

---

## Acceptance checks (run after deploy; paste the output)

```bash
B=https://salam-doctor.com; CB="cb=$(date +%s)"
# --- 1. light-therapy ---
L=$(curl -s -m 20 "$B/shiraz/light-therapy?$CB")
echo "$L" | grep -oE '<title>[^<]*</title>|<meta (name|property)="(description|og:title|og:description|twitter:title|twitter:description)" content="[^"]*"'
echo "1 new_title $(echo "$L" | grep -c 'لایت تراپی و نور درمانی در شیراز | کاربرد و انتخاب مرکز')"        # ≥3 lines (title, og, twitter)
echo "1 new_desc $(echo "$L" | grep -o 'برای چه مشکلات پوستی مناسب است و درد دارد؟' | wc -l)"             # ≥4 (3 meta + JSON-LD; 5 if lead <p> shares source)
echo "1 old_title $(echo "$L" | grep -c 'نور درمانی در شیراز | بهترین کلینیک‌ها')"                           # 0
echo "1 old_desc $(echo "$L" | grep -c 'مراکز پوست و زیبایی برای مشاوره رایگان')"                           # 0 (or 1 only if lead <p> has its own source; say so)
echo "1 ld_old $(echo "$L" | grep -c 'معیارهای انتخاب مرکز و مشاوره رایگان سلام دکتر')"                   # 0
echo "1 disclosure $(echo "$L" | grep -c 'تیم سلام دکتر مراکز را حضوری بازدید می‌کند')"                     # 1 (unchanged)
echo "$L" | python3 -c 'import sys,re,json;h=sys.stdin.read();[json.loads(m) for m in re.findall(r"<script[^>]*ld\+json[^>]*>(.*?)</script>",h,re.S)];print("1 jsonld ok")'
# --- 2. Nahal ---
N=$(curl -s -m 20 "$B/doctor/nahal-clinic?$CB")
echo "$N" | grep -oE '<title>[^<]*</title>|<meta (name|property)="(description|og:title|og:description|twitter:title|twitter:description)" content="[^"]*"'
echo "2 new_title $(echo "$N" | grep -o 'کلینیک نهال شیراز | ستارخان، بین فرعی ۴ و ۶ | آدرس و نوبت' | wc -l)"   # ≥4 (3 static tags + JS branch)
echo "2 new_desc $(echo "$N" | grep -o 'ستارخان، بین فرعی ۴ و ۶. مسیریابی روی نقشه، راه‌های ارتباطی' | wc -l)"             # ≥4 (3 static tags + JS)
echo "2 phone_in_meta $(echo "$N" | grep -oE '<title>[^<]*</title>|<meta (name|property)="(description|og:title|og:description|twitter:title|twitter:description)" content="[^"]*"' | grep -cE '09016594365|07136265696|۰۹۰۱۶۵۹۴۳۶۵|۰۷۱۳۶۲۶۵۶۹۶')"   # 0
echo "2 old_title_tags $(echo "$N" | grep -cE '(<title>|title" content=")کلینیک نهال شیراز \| پوست، مو و زیبایی \| آدرس و نوبت')"   # 0 (the generic JS template for other clinics may still contain «| پوست، مو و زیبایی | آدرس و نوبت | سلام دکتر»; that is expected)
echo "2 old_desc $(echo "$N" | grep -c 'آدرس، تلفن و نوبت‌دهی کلینیک نهال')"                                   # 0
echo "2 h1 $(echo "$N" | grep -c 'id="clinic-name">کلینیک نهال شیراز | پوست، مو و زیبایی<')"                   # 1 (unchanged)
echo "2 badge $(echo "$N" | grep -c 'مرکز تایید شده')"                                                        # ≥1 (unchanged)
echo "2 address_ld $(echo "$N" | grep -c 'شیراز- ستارخان- بین فرعی 4 و 6')"                                   # ≥1 (unchanged)
echo "2 written_cost $(echo "$N" | grep -c 'به‌صورت کتبی اعلام می‌کند')"                                     # ≥1 (unchanged from 63c80a1)
echo "$N" | python3 -c 'import sys,re,json;h=sys.stdin.read();[json.loads(m) for m in re.findall(r"<script[^>]*ld\+json[^>]*>(.*?)</script>",h,re.S)];print("2 jsonld ok")'
git grep -n "function clinicProfileTitle" -A8 | head -30   # show the Nahal-only branch and the unchanged generic return
# --- 3. category robots ---
for u in "category?$CB" "category?type=skin&$CB" "category?type=laser&$CB" "category?type=hair&$CB" "category?type=injection&$CB"; do
  echo "3 /$u $(curl -s -m 20 "$B/$u" | grep -c 'name="robots"') $(curl -s -m 20 "$B/$u" | grep -oE 'name="robots" content="[^"]+"' | sort -u)"
done
# each: 1 name="robots" content="noindex,follow"
# --- guardrails ---
for p in shiraz/light-therapy doctor/nahal-clinic; do
  H=$(curl -s -m 20 "$B/$p?$CB" | python3 -c 'import sys,re;h=sys.stdin.read();print("\n".join(re.findall(r"<title>[^<]*</title>|<meta[^>]*(?:description|og:title|twitter:title)[^>]*>",h)))')
  echo "G /$p money_in_head $(echo "$H" | grep -cE 'قیمت|هزینه|مشاوره رایگان|تومان|بهترین')"   # 0
done
for p in shiraz/hair-transplant shiraz/botox shiraz/laser-candela-2026; do
  echo "G /$p title $(curl -s -m 20 "$B/$p?$CB" | grep -oE '<title>[^<]*</title>')"   # unchanged from before this deploy
done
# --- 4. hub descriptions ---
for h in co2-fractional-laser hair-transplant hifu-doublo-gold laser-titanium-2026 mens-laser-shiraz skin-rejuvenation; do
  P=$(curl -s -m 20 "$B/shiraz/$h?$CB")
  D=$(echo "$P" | grep -oE '<meta (name|property)="(description|og:description|twitter:description)" content="[^"]*"')
  echo "4 /shiraz/$h tags=$(echo "$D" | wc -l) distinct=$(echo "$D" | sed -E 's/.*content="//' | sort -u | wc -l) banned=$(echo "$D" | grep -cE 'قیمت|هزینه|مشاوره رایگان|تومان|تعرفه')"   # tags=3 distinct=1 banned=0
done
H=$(curl -s -m 20 "$B/shiraz/hair-transplant?$CB");  echo "4 ht_new $(echo "$H" | grep -c 'روش‌های FUT، FUE و DHI، نکات قبل از انتخاب مرکز')"            # ≥3
echo "4 hifu_new $(curl -s -m 20 "$B/shiraz/hifu-doublo-gold?$CB" | grep -c 'در شیراز؛ معیارهای انتخاب مرکز، روش نوبت‌گیری')"                  # ≥3
echo "4 mens_new $(curl -s -m 20 "$B/shiraz/mens-laser-shiraz?$CB" | grep -c 'لیزر موهای زائد آقایان در شیراز؛ معیارهای انتخاب مرکز (مجوز')"     # ≥3
echo "4 co2_new $(curl -s -m 20 "$B/shiraz/co2-fractional-laser?$CB" | grep -c 'کاربرد در جای جوش، اسکار و بهبود بافت پوست، تفاوت با لیزر CO2')"   # ≥3
echo "4 ti_new $(curl -s -m 20 "$B/shiraz/laser-titanium-2026?$CB" | grep -c 'در شیراز؛ مناسب چه پوست‌هایی است، تفاوت با کندلا')"               # ≥3
echo "4 skin_new $(curl -s -m 20 "$B/shiraz/skin-rejuvenation?$CB" | grep -c 'آشنایی با فیشیال، میکرونیدلینگ، هایفو و درمان‌های لیزری')"        # ≥3
# sweep: no hub description tag left with قیمت/هزینه/تعرفه
for u in $(curl -s -m 20 "$B/sitemap.xml?$CB" | grep -oE 'https://salam-doctor.com/shiraz/[^<]+'); do
  n=$(curl -s -m 20 "$u?$CB" | grep -oE '<meta (name|property)="(description|og:description|twitter:description)" content="[^"]*"' | grep -cE 'قیمت|هزینه|تعرفه')
  [ "$n" != "0" ] && echo "4 STILL $u $n"
done; echo "4 sweep done"                                                                                                  # no STILL lines
for h in hair-transplant skin-rejuvenation; do echo "4 /shiraz/$h badge $(curl -s -m 20 "$B/shiraz/$h?$CB" | grep -c 'تاییدشده سلام دکتر') disclosure $(curl -s -m 20 "$B/shiraz/$h?$CB" | grep -c 'تیم سلام دکتر مراکز را حضوری بازدید می‌کند')"; done   # badge ≥1, disclosure 1 (unchanged)
# --- 5. hub → article link ---
echo "5 clean_link $(echo "$H" | grep -c '<a href="/articles/best-hair-transplant-center-shiraz">چک‌لیست انتخاب مرکز کاشت مو و سوالات جلسه مشاوره</a>')"   # 1
echo "5 rel_left $(echo "$H" | grep -oE '<a href="/articles/best-hair-transplant-center-shiraz"[^>]*>' | grep -c 'rel=')"                              # 0
echo "$H" | python3 -c 'import sys,re,json;h=sys.stdin.read();[json.loads(m) for m in re.findall(r"<script[^>]*ld\+json[^>]*>(.*?)</script>",h,re.S)];print("4/5 hair-transplant jsonld ok")'
git rev-parse --short HEAD
```

---

## Reply format

`deployed <short-sha>`

Then paste the acceptance output. For light-therapy and each of the 6 hubs in item 4, say whether the lead `<p>` changed (shared source) or stayed (separate source). For item 5, say whether you removed `rel` on one link or in the sanitizer, and how many links changed.
