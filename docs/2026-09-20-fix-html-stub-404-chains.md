# Cursor prompt — FIX `.html` / bare stub → 404 equity dump (CRITICAL)

**Site:** salam-doctor.com  
**Standing rule:** money hubs under `/shiraz/{slug}` only. One-hop 301. Never strip `.html` to a root stub that 404s.

## Broken live (verified 2026-09-20)

These 301 to extensionless root paths that **404**:

| From | Current target (BAD) | Required KEEP |
|------|----------------------|---------------|
| `/laser-hair.html` | `/laser-hair` → 404 | `/shiraz/laser-hair-removal` |
| `/skin-rejuvenation.html` | `/skin-rejuvenation` → 404 | `/shiraz/skin-rejuvenation` |
| `/slimming.html` | `/slimming` → 404 | `/shiraz/slimming` |
| `/injection.html` | `/injection` → 404 | `/shiraz/injectables` |
| `/hair-transplant.html` | `/hair-transplant` → 404 | `/shiraz/hair-transplant` |
| `/cosmetic-surgery.html` | `/cosmetic-surgery` → 404 | `/shiraz/cosmetic-surgery` |
| `/botox.html` | `/botox` → 404 | `/shiraz/botox` |
| `/facial.html` | `/facial` → 404 | `/shiraz/facial` |

Also add one-hop 301 for the **dead stubs themselves** (in case Google or links hit them):

- `/laser-hair`, `/laser-hair/` → `/shiraz/laser-hair-removal`
- `/skin-rejuvenation`, `/slimming`, `/injection`, `/hair-transplant`, `/cosmetic-surgery`, `/botox`, `/facial` (root, no `/shiraz/`) → matching KEEP above

## Root cause to kill

Find any nginx/`server.js` rule that maps `*.html` → `/:slug` (strip extension). That pattern is dumping equity. Replace with explicit loser → `/shiraz/…` KEEP map above.

## Leave alone (already PASS)

- `/services/لیزر-co2`, `/services/co2-laser` → `/shiraz/co2-fractional-laser`
- `/services/hair-transplant-fit` → `/shiraz/micro-fit-hair-transplant`
- `/services/botox` → `/shiraz/botox`
- `/services/light-therapy` → **200** (utility)
- `/shiraz/pores` → `/shiraz/pore-treatment`
- Persian service ghosts for منافذ / کاشت-مو / لیزر-موهای-زائد → KEEP

## Acceptance

```bash
curl -sI https://salam-doctor.com/laser-hair.html
# 301 Location: …/shiraz/laser-hair-removal   (NOT /laser-hair)

curl -sI https://salam-doctor.com/laser-hair
# 301 …/shiraz/laser-hair-removal

curl -sI https://salam-doctor.com/botox.html
# 301 …/shiraz/botox

curl -sI https://salam-doctor.com/hair-transplant.html
# 301 …/shiraz/hair-transplant
```

No root stub may end in 404 for the rows above.

Commit: `seo: fix .html/bare stub 404 chains → /shiraz KEEP`

Reply “deployed” + SHA when live.
