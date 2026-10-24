#!/usr/bin/env bash
# Acceptance for 2026-10-25 prompt. Usage: bash check.sh [base]
B=${1:-https://salam-doctor.com}; F=0; T=$(mktemp -d)
p(){ echo "PASS $1"; }; f(){ echo "FAIL $1"; F=1; }
CLOSE='قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند.'
curl -s "$B/sitemap.xml?nc=$RANDOM" > $T/sm.xml
python3 -c "import xml.dom.minidom as m;m.parse('$T/sm.xml')" && p "sitemap.xml valid" || f "sitemap.xml invalid"
for s in skin-biopsy wart-cryotherapy; do
  grep -A1 "<loc>$B/shiraz/$s</loc>" $T/sm.xml | grep -q '<lastmod>2026-10-25</lastmod>' && p "lastmod 2026-10-25 $s" || f "lastmod $s"
done
other=$(grep -A1 '<loc>' $T/sm.xml | grep -c '2026-10-25'); [ "$other" -le 2 ] && p "only 2 URLs have lastmod 2026-10-25 ($other)" || f "$other URLs bumped to 2026-10-25"

# --- 1. the two YMYL hubs ---
audit(){ # slug minwords faqs
python3 - "$B/shiraz/$1" "$2" "$3" <<'PY'
import sys,re,json,urllib.request
u,mw,nf=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]);ok=True
def out(c,m):
  global ok; print(('PASS ' if c else 'FAIL ')+m); ok=ok and c
r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'check'}));h=r.read().decode()
out(r.status==200,f'{u} 200')
out(f'rel="canonical" href="{u}"' in h,f'{u} canonical bare self')
rb=re.findall(r'name="robots" content="([^"]*)',h); out(not any('noindex' in x for x in rb),f'{u} indexable')
m=re.search(r'<main.*?</main>',h,re.S); b=m.group(0) if m else h
t=' '.join(re.sub('<[^>]+>',' ',re.sub(r'<script.*?</script>|<style.*?</style>','',b,flags=re.S)).split())
out(len(t.split())>=mw,f'{u} words {len(t.split())} >= {mw}')
out(len(re.findall('<h2',b))>=5,f'{u} h2 {len(re.findall("<h2",b))} >= 5')
vis=[' '.join(re.sub('<[^>]+>',' ',x).split()) for x in re.findall(r'<summary[^>]*>(.*?)</summary>',b,re.S)]
out(len(vis)==nf,f'{u} visible FAQs {len(vis)} == {nf}')
js=[]
for s in re.findall(r'<script type="application/ld\+json">(.*?)</script>',h,re.S):
  d=json.loads(s)
  for x in (d.get('@graph',[d]) if isinstance(d,dict) else d):
    if x.get('@type')=='FAQPage': js=x['mainEntity']
q=[e['name'].strip() for e in js]
out(q==vis,f'{u} FAQPage JSON-LD 1:1 with visible ({len(q)})')
cost=[e for e in js if re.search('هزینه|قیمت',e['name'])]
out(len(cost)>=1 and all(e['acceptedAnswer']['text'].strip().endswith('قیمت دقیق را مرکز پس از معاینه، به‌صورت کتبی اعلام می‌کند.') for e in cost),f'{u} cost answers end with closing sentence')
full=re.sub('<[^>]+>',' ',h)
out(not re.search(r'(قیمت|هزینه|تعرفه)[^.؛]{0,40}[0-9۰-۹]|تومان',full),f'{u} no price figures')
out(not re.search(r'جلوگیری از اسکار|بدون (جای|اسکار)|خوش‌خیم است|سرطان نیست',full),f'{u} no scar/benign guarantees')
if 'biopsy' in u: out('پاتولوژی' in full and 'پزشک معالج' in full,f'{u} diagnosis-by-pathology disclaimer')
sys.exit(0 if ok else 1)
PY
}
audit skin-biopsy 700 6 || F=1
audit wart-cryotherapy 900 9 || F=1

# --- 3. every /shiraz hub in sitemap ---
grep -o "<loc>$B/shiraz[^<]*</loc>" $T/sm.xml | sed 's#</\?loc>##g' > $T/hubs
echo "hubs: $(wc -l < $T/hubs)"
while read u; do
  h=$(curl -s "$u"); [ -z "$h" ] && { f "$u empty"; continue; }
  bad=""
  echo "$h" | grep -qE '\[cite|\[cite_start\]' && bad+=" cite-artifact"
  echo "$h" | grep -qF 'مشاوره رایگان' && bad+=" مشاوره-رایگان"
  echo "$h" | grep -qF 'مشاوره اولیه رایگان' && bad+=" مشاوره-اولیه-رایگان"
  echo "$h" | grep -qF 'تضمین اصالت مجوز پزشکی' && bad+=" badge-تضمین"
  echo "$h" | grep -qF 'بررسی تخصصی تیم سلام دکتر' && bad+=" badge-بررسی-تخصصی"
  echo "$h" | grep -qE 'بررسی و (تأیید|تایید) شده|دستگاه‌های تأیید‌شده' && bad+=" device-verified-claim"
  echo "$h" | grep -qE 'بهترین مرکز[^<]{0,40}را متناسب با شرایط شما معرفی' && bad+=" endorsement-cta"
  echo "$h" | grep -qE '\(0 نظر\)' && bad+=" zero-review-rating"
  echo "$h" | python3 -c "
import sys,re,json
h=sys.stdin.read();bad=0
for s in re.findall(r'<script type=\"application/ld\+json\">(.*?)</script>',h,re.S):
  for m in re.finditer(r'\"aggregateRating\"\s*:\s*\{[^}]*\}',s):
    c=re.search(r'\"(reviewCount|ratingCount)\"\s*:\s*\"?(\d+)',m.group(0))
    if not c or int(c.group(2))==0: bad=1
sys.exit(bad)" || bad+=" AggregateRating-0"
  echo "$h" | grep -qF 'بازدید حضوری و قرارداد با مرکز' || bad+=" no-new-badge"
  echo "$h" | grep -qE 'هزینه پرداخت می‌کنند|پرداخت هزینه|ترتیب نمایش' || bad+=" no-paid-disclosure"
  [ -z "$bad" ] && p "$u template" || f "$u:$bad"
done < $T/hubs

# --- Nahal untouched (card on hair-transplant hub renders server-side) ---
curl -s "$B/shiraz/hair-transplant" | grep -qF '(206 نظر)' && p "Nahal card (206 نظر) still rendered" || f "Nahal rating changed/missing on /shiraz/hair-transplant"
echo "INFO Nahal badge «تاییدشده سلام دکتر» is client-rendered; confirm visually on /doctor/nahal-clinic"
for u in /uploads/seo-config.js /uploads/seoRouter.js; do c=$(curl -s -o /dev/null -w %{http_code} "$B$u"); [ "$c" != 200 ] && p "$u not served ($c)" || f "$u publicly served (source leak)"; done
echo; [ $F = 0 ] && echo "ALL PASS" || echo "SOME FAIL"; exit $F
