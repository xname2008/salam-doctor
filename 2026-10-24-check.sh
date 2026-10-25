#!/usr/bin/env bash
# Acceptance for docs/2026-10-24-rhinoplasty-redirects-titles-links.md
set -euo pipefail
B="${B:-https://salam-doctor.com}"
CB="cb=$(date +%s)"
fail=0

pass() { echo "PASS $1"; }
failf() { echo "FAIL $1"; fail=1; }

# Follow redirects manually: report final status + hop count + final URL
redir_check() {
  local path="$1" expect="$2" label="$3"
  local out hops final code
  out=$(curl -sS -m 25 -o /dev/null -w '%{http_code} %{url_effective} %{num_redirects}' -L --max-redirs 5 "$B$path?$CB" || true)
  code=$(echo "$out" | awk '{print $1}')
  final=$(echo "$out" | awk '{print $2}' | sed "s/[?].*//")
  hops=$(echo "$out" | awk '{print $3}')
  # One-hop: first response must be 301 to expect
  local first loc
  first=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' -D - "$B$path?$CB" 2>/dev/null | tr -d '\r' | awk 'NR==1{print $2}')
  loc=$(curl -sS -m 20 -o /dev/null -D - "$B$path?$CB" 2>/dev/null | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')
  loc_path=$(echo "$loc" | sed -E 's#https?://[^/]+##; s/[?].*//; s#/$##')
  expect_norm=$(echo "$expect" | sed 's#/$##')
  if [ "$first" = "301" ] && [ "$loc_path" = "$expect_norm" ]; then
    pass "$label 301→$expect (1 hop)"
  else
    failf "$label got first=$first loc=$loc_path (want 301→$expect_norm) hops=$hops final=$final"
  fi
}

code_check() {
  local path="$1" want="$2" label="$3"
  local code
  code=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' "$B$path?$CB" || echo 000)
  if [ "$code" = "$want" ]; then pass "$label $want"; else failf "$label got $code want $want"; fi
}

html_has() {
  local path="$1" pat="$2" label="$3"
  local n
  n=$(curl -sS -m 25 "$B$path?$CB" | grep -cF -- "$pat" || true)
  if [ "$n" -ge 1 ]; then pass "$label"; else failf "$label missing: $pat"; fi
}

html_lacks() {
  local path="$1" pat="$2" label="$3"
  local n
  n=$(curl -sS -m 25 "$B$path?$CB" | grep -cF -- "$pat" || true)
  if [ "$n" -eq 0 ]; then pass "$label"; else failf "$label still has: $pat ($n)"; fi
}

echo "=== 2026-10-24 rhinoplasty / redirects / titles / links ==="
echo "BASE=$B"

# --- §2 redirects ---
redir_check "/services/qswitch" "/shiraz/qswitch" "R1 /services/qswitch"
redir_check "/services/qswitch/" "/shiraz/qswitch" "R1b /services/qswitch/"
redir_check "/articles/hair-loss-treatment-comparison" "/articles/mesotherapy-vs-prp-hair-loss" "R2 hair-loss bare"
redir_check "/articles/hair-loss-treatment-comparison.html" "/articles/mesotherapy-vs-prp-hair-loss" "R2 hair-loss .html"
redir_check "/articles/hair-loss-treatment-comparison/" "/articles/mesotherapy-vs-prp-hair-loss" "R2 hair-loss /"
redir_check "/articles/skin-rejuvenation-guide" "/shiraz/skin-rejuvenation" "R3 skin-guide bare"
redir_check "/articles/skin-rejuvenation-guide.html" "/shiraz/skin-rejuvenation" "R3 skin-guide .html"
redir_check "/articles/skin-rejuvenation-guide/" "/shiraz/skin-rejuvenation" "R3 skin-guide /"

code_check "/shiraz/qswitch" "200" "R1 dest /shiraz/qswitch"
code_check "/articles/mesotherapy-vs-prp-hair-loss" "200" "R2 dest mesotherapy"
code_check "/shiraz/skin-rejuvenation" "200" "R3 dest skin-rejuvenation"
code_check "/articles/botox-filler-guide" "200" "R3 KEEP botox-filler-guide"

# --- §1 rhinoplasty article ---
RH="/articles/best-rhinoplasty-surgeon-shiraz"
code_check "$RH" "200" "A1 bare article"
html_has "$RH" 'انتخاب جراح بینی در شیراز: معیارها و سوالات جلسه مشاوره | سلام دکتر' "A1 title"
html_has "$RH" 'انتخاب جراح بینی در شیراز: معیارها، سبک‌های جراحی و سوالات جلسه مشاوره' "A1 H1/headline"
html_has "$RH" '۶. هزینه جراحی بینی به چه عواملی بستگی دارد؟' "A1 §6 heading"
html_has "$RH" 'قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند.' "A1 cost close"
html_has "$RH" 'هزینه جراحی بینی در شیراز چقدر است؟' "A1 cost FAQ"
html_has "$RH" '۲ آبان ۱۴۰۵' "A1 jalali date"
html_has "$RH" 'datetime="2026-10-24"' "A1 datePublished"
html_has "$RH" 'href="/articles/rhinoplasty-care-guide"' "A1 → care-guide"
html_lacks "$RH" 'تاریخ انتشار:</p>' "A1 date not empty shell"
# no number next to قیمت/هزینه/تعرفه/تومان in article body (rough)
BODY=$(curl -sS -m 25 "$B$RH?$CB")
if echo "$BODY" | grep -oE '.{0,12}(قیمت|هزینه|تعرفه|تومان).{0,12}' | grep -E '[0-9۰-۹]+' >/dev/null; then
  failf "A1 priced number near cost words"
else
  pass "A1 no priced numbers near cost words"
fi

# reverse + hub + homepage
html_has "/articles/rhinoplasty-care-guide" 'href="/articles/best-rhinoplasty-surgeon-shiraz"' "A1 care-guide reverse"
html_has "/articles/rhinoplasty-care-guide" 'انتخاب جراح بینی در شیراز' "A1 care-guide anchor"
html_has "/shiraz/rhinoplasty" 'href="/articles/best-rhinoplasty-surgeon-shiraz"' "A1 rhino hub link"
html_has "/shiraz/rhinoplasty" 'راهنمای انتخاب جراح بینی در شیراز و سوالات جلسه مشاوره' "A1 rhino hub anchor"
html_has "/" 'href="/articles/best-rhinoplasty-surgeon-shiraz"' "A1 homepage listing"

# --- §3 titles ---
html_has "/shiraz/light-therapy" 'نور درمانی در شیراز | لایت تراپی پوست، کاربردها و انتخاب مرکز' "T1 light-therapy title"
html_has "/shiraz/light-therapy" 'نور درمانی (لایت تراپی) در شیراز برای آکنه، جوانسازی و التهاب پوست چگونه انجام می‌شود؟' "T1 light-therapy desc"
html_lacks "/shiraz/light-therapy" 'لایت تراپی و نور درمانی در شیراز | کاربرد و انتخاب مرکز' "T1 old light-therapy title gone"
html_has "/about" 'درباره سایت دکتر سلام | معرفی کلینیک‌های زیبایی شیراز' "T2 about title"
html_has "/about" 'سایت دکتر سلام (سلام دکتر) کلینیک‌های پوست، مو و زیبایی شیراز را پس از بازدید حضوری تیم ما معرفی می‌کند.' "T2 about desc"

# --- §4 hair-transplant links ---
html_has "/shiraz/hair-transplant" 'href="/articles/best-hair-transplant-center-shiraz"' "L1 hair hub link"
html_has "/shiraz/hair-transplant" 'راهنمای انتخاب بهترین مرکز کاشت مو در شیراز' "L1 hair hub anchor"
# Intro is loaded client-side from /api/clinic-profile (and /clinic-intros/114.html).
# Parse JSON so escaped quotes in the intro HTML don't false-fail grep.
NINTRO=$(curl -sS -m 20 "$B/api/clinic-profile?clinic_id=114&$CB" || true)
if printf '%s' "$NINTRO" | python3 -c 'import sys,json; d=json.load(sys.stdin); t=d.get("intro") or ""; sys.exit(0 if "/articles/best-hair-transplant-center-shiraz" in t else 1)'; then
  pass "L2 nahal link (api intro)"
else
  failf "L2 nahal link missing in /api/clinic-profile?clinic_id=114"
fi
if printf '%s' "$NINTRO" | python3 -c 'import sys,json; d=json.load(sys.stdin); t=d.get("intro") or ""; sys.exit(0 if "راهنمای انتخاب مرکز کاشت مو در شیراز" in t else 1)'; then
  pass "L2 nahal anchor (api intro)"
else
  failf "L2 nahal anchor missing in api intro"
fi
html_has "/clinic-intros/114.html" 'href="/articles/best-hair-transplant-center-shiraz"' "L2 nahal static intro file"
html_has "/shiraz/laser-candela-2026" 'href="/articles/best-hair-transplant-center-shiraz"' "L3 candela link"
html_has "/shiraz/laser-candela-2026" 'راهنمای انتخاب مرکز کاشت مو در شیراز' "L3 candela anchor"

# --- catalog / sitemap cleanup ---
SM=$(curl -sS -m 20 "$B/sitemap-articles.xml?$CB")
if echo "$SM" | grep -q 'hair-loss-treatment-comparison'; then
  failf "S1 sitemap still lists hair-loss-treatment-comparison"
else
  pass "S1 sitemap omits hair-loss-treatment-comparison"
fi
if echo "$SM" | grep -q 'best-rhinoplasty-surgeon-shiraz'; then
  pass "S1 sitemap lists rhinoplasty article"
else
  failf "S1 sitemap missing rhinoplasty article"
fi
CAT=$(curl -sS -m 20 "$B/assets/js/articles-catalog.generated.js?$CB")
if echo "$CAT" | grep -q 'hair-loss-treatment-comparison'; then
  failf "S2 catalog still has hair-loss-treatment-comparison"
else
  pass "S2 catalog omits hair-loss-treatment-comparison"
fi
if echo "$CAT" | grep -q 'best-rhinoplasty-surgeon-shiraz'; then
  pass "S2 catalog lists rhinoplasty article"
else
  failf "S2 catalog missing rhinoplasty article"
fi
html_has "/" 'href="/articles/mesotherapy-vs-prp-hair-loss"' "S3 homepage mesotherapy link"
html_lacks "/" 'href="/articles/hair-loss-treatment-comparison"' "S3 homepage no old hair-loss href"

# Nahal badge untouched
html_has "/doctor/nahal-clinic" 'مرکز تایید شده' "G nahal badge kept"

echo "=== done ==="
if [ "$fail" -ne 0 ]; then
  echo "RESULT FAIL"
  exit 1
fi
echo "RESULT PASS"
exit 0
