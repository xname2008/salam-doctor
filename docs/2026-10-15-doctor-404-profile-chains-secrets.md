# Cursor prompt: /doctor 404s, one-hop profile.html redirects, fixture cleanup, secrets hygiene, PR to main (salam-doctor.com)

> ## ⚠️ READ FIRST, Jessie (not for Cursor to act on)
> The GitHub repo `xname2008/salam-doctor` is **public**, and `leads.db`, `.env` and `.env.shirazbeauty` are committed on both `main` and `cursor/seo-hub-sitemap-consolidation` (checked 2026-10-15, file names only).
> Step 4 below only **stops tracking** these files from now on. **It does not remove them from git history.** Anyone who cloned or browsed the repo can still read every past version.
> 1. **Make the repo private now** (GitHub → Settings → General → Danger Zone → Change visibility).
> 2. **Rotate every credential** that was ever in `.env` / `.env.shirazbeauty`: database passwords (`DATABASE_URL`), API keys, SMTP, tokens, and any Google or service-account keys. Treat them as leaked.
> 3. `leads.db` likely contains people's contact details. Decide whether you have a duty to notify anyone.
> 4. Scrubbing history (`git filter-repo` + force-push of every branch) is **destructive**: it rewrites all commit SHAs and breaks other clones and open PRs. It is **not** part of this prompt. Do it only with your explicit go, as a separate step.

**Standing rules:** No prices or «قیمت»/«هزینه»/«تعرفه»/«مشاوره رایگان» in new copy. Don't touch the Nahal badge, ratings, disclosure line, titles or descriptions. Bare root-absolute URLs. Only one-hop redirects.
**Do not:** force-push, rewrite history, run `git filter-repo`/BFG, delete local copies of `leads.db` or `.env*`, or merge to `main` yourself.
After deploy, reply `deployed` + the real short SHA (paste the **output** of `git rev-parse --short HEAD`) + **the branch it was deployed from** (`git rev-parse --abbrev-ref HEAD`) + the PR URL + the acceptance output.

---

## Live state (verified 2026-10-15, Asia/Tehran)

- **Real clinics:** `/api/clinic-profile?clinic_id=N` returns data **only for 114** (Nahal, «کلینیک تخصصی پوست مو و زیبایی نهال»). Ids 1–300 were probed; every other id returns `null` with HTTP 200. `sitemap.xml` lists only `/doctor/nahal-clinic`, and all 35 hubs link only to `/doctor/nahal-clinic`. Before hardcoding, confirm against the real data source (DB / clinics JSON) and keep any other clinic that has a real name, address and contract. List what you kept in your reply.
- `/doctor/{anything}` returns **200** with title «پروفایل کلینیک | سلام دکتر», a self-canonical and no robots meta. Examples: `/doctor/clinic-1`, `/doctor/clinic-99999`.
- `profile.html?id=N`:
  - `114` → 301 `/doctor/nahal-clinic` (OK)
  - `101`–`113` and `115`–`129` (28 ids) → 301 `/doctor/sample-clinic-1`…`-28` → 301 `/shiraz` (**two hops through a fixture**)
  - every other id checked (1–100, 130–200, 250, 500, 1000) → 301 `/doctor/clinic-N` → 200 empty profile (171 of ids 1–200)
- `/doctor/sample-clinic-1` currently → 301 `/shiraz`.

---

## 1. `/doctor/{slug}`: real 404 for anything that isn't a real clinic

1. Resolve the slug **server-side** (in the route handler, not in client JS) against the real clinic data. Real clinic → 200 as today. Anything else → **HTTP 404** with a minimal not-found page that has `<meta name="robots" content="noindex">` and **no** canonical. That covers `clinic-N` with no data, `sample-clinic-*`, and random strings.
2. Retired fixture slugs `sample-clinic-1`…`sample-clinic-28`: return **410 Gone** with noindex (404 is acceptable). Do **not** 301 them to `/shiraz` any more.
3. The empty-template fallback must never return 200. If the client JS gets `null` from `/api/clinic-profile`, it must not render an indexable shell. Server-side status is what counts.
4. Delete the `sample-clinic-*` fixture records, seed data and slug mappings from the data, generators and route tables. Keep Nahal (114) untouched, including `/clinics/114/*` assets.
5. Optional hardening: make `/api/clinic-profile?clinic_id=<unknown>` return 404 instead of `200 null`, if nothing else depends on that.

## 2. `profile.html?id=N`: exactly one hop

| id | Response |
|---|---|
| real ids (today only `114`) | **301 → `https://salam-doctor.com/doctor/nahal-clinic`** (its real slug), one hop |
| retired fixture ids `101`–`113`, `115`–`129` | **301 → `https://salam-doctor.com/shiraz`** in one hop (or 410). Never via `/doctor/sample-clinic-*` |
| any other id (unknown, non-numeric, missing) | **404** + noindex, never a redirect to `/doctor/clinic-N` |

Build the redirect map from the real data (id → slug) plus an explicit retired-id list. Also cover `profile.html` and `/profile` (and their trailing-slash and `.html` variants if they exist) the same way.

## 3. No internal pointers to fake clinics

Grep the repo and built output for `sample-clinic`, `clinic-[0-9]`, `profile.html?id=`, `/doctor/` and fixture names. Remove or retarget any link, sitemap entry, JS catalog/menu entry, JSON-LD `url`, preload or `og:url` that points at a non-real clinic. `sitemap.xml` must list only real `/doctor/` URLs (today: `/doctor/nahal-clinic`). Internal links to Nahal should point at `/doctor/nahal-clinic`, not `profile.html?id=114`.

## 4. Secrets hygiene (no history rewrite)

```bash
cat >> .gitignore <<'GI'
# secrets / local data — never commit
leads.db
*.db
.env
.env.*
!.env.example
!.env.*.example
GI
git rm --cached --ignore-unmatch leads.db .env .env.shirazbeauty
git ls-files | grep -E '(^|/)(.*\.db|\.env(\..*)?)$' | grep -vE '\.example$' | xargs -r git rm --cached
git commit -m "chore: stop tracking leads.db and .env files (local copies kept)"
ls -la leads.db .env .env.shirazbeauty   # must still exist locally
```
- Keep `.env.example` and `.env.shirazbeauty.example` tracked. Check that they hold placeholders only, with no real values. If one has real values, replace them with placeholders and say so.
- Check that the deploy still finds its env and DB on the server (not via git). If the deploy pulled `.env` or `leads.db` from git, stop and report before deploying, rather than breaking production.
- **No** `git filter-repo`, BFG, `git push --force`, or `--force-with-lease`.

## 5. PR to main (do not merge)

After items 1–4 are committed and pushed to `cursor/seo-hub-sitemap-consolidation`, open a PR **from `cursor/seo-hub-sitemap-consolidation` into `main`**. Title: `SEO consolidation: hubs, sitemap, articles, profile 404s, untrack secrets`. In the body, list the commits since `6b6d7c3` and note "history still contains secrets; repo must be made private and credentials rotated". **Do not merge, auto-merge or enable auto-merge.** Paste the PR URL.

---

## Acceptance checks (run after deploy; paste the output)

```bash
B=https://salam-doctor.com; CB="cb=$(date +%s)"
s(){ curl -s -o /dev/null -m 20 -w "%{http_code} %{redirect_url}" "$1"; }
echo "1 clinic-99999 $(s "$B/doctor/clinic-99999?$CB")"                 # 404
echo "1 clinic-1 $(s "$B/doctor/clinic-1?$CB")"                         # 404
echo "1 sample-clinic-1 $(s "$B/doctor/sample-clinic-1?$CB")"           # 410 (or 404), no redirect
echo "1 sample-clinic-28 $(s "$B/doctor/sample-clinic-28?$CB")"         # 410 (or 404)
echo "1 random $(s "$B/doctor/zzz-not-real?$CB")"                       # 404
echo "1 404_noindex $(curl -s -m 20 "$B/doctor/clinic-99999?$CB" | grep -c 'name="robots" content="noindex')"   # ≥1
echo "1 404_canonical $(curl -s -m 20 "$B/doctor/clinic-99999?$CB" | grep -c 'rel="canonical"')"                # 0
echo "1 nahal $(s "$B/doctor/nahal-clinic?$CB")"                        # 200
echo "1 nahal_title $(curl -s -m 20 "$B/doctor/nahal-clinic?$CB" | grep -c 'کلینیک نهال شیراز | ستارخان، بین فرعی ۴ و ۶ | آدرس و نوبت')"   # ≥1 (unchanged)
# --- 2. profile.html one hop ---
echo "2 id114 $(s "$B/profile.html?id=114")"                            # 301 https://salam-doctor.com/doctor/nahal-clinic
echo "2 id101 $(s "$B/profile.html?id=101")"                            # 301 https://salam-doctor.com/shiraz  (or 410)
echo "2 id129 $(s "$B/profile.html?id=129")"                            # 301 https://salam-doctor.com/shiraz  (or 410)
echo "2 id1 $(s "$B/profile.html?id=1")"                                # 404
echo "2 id99999 $(s "$B/profile.html?id=99999")"                        # 404
echo "2 noid $(s "$B/profile.html")"                                    # 404 (or 301 /shiraz; say which)
for i in 101 114 129; do echo "2 hops id=$i $(curl -s -o /dev/null -L -m 20 -w '%{num_redirects} %{http_code} %{url_effective}' "$B/profile.html?id=$i")"; done   # 1 200 final URL
# fixture sweep across ids 1–200: no hop may land on /doctor/sample-clinic-* or /doctor/clinic-N
for i in $(seq 1 200); do r=$(s "$B/profile.html?id=$i"); case "$r" in *sample-clinic*|*/doctor/clinic-*) echo "2 BAD id=$i $r";; esac; done; echo "2 sweep done"   # no BAD lines
# --- 3. no fake clinic pointers ---
curl -s -m 20 "$B/sitemap.xml?$CB" | grep -oE '<loc>[^<]*/doctor/[^<]*' # only /doctor/nahal-clinic
for p in "" shiraz shiraz/hair-transplant shiraz/light-therapy doctor/nahal-clinic articles; do echo "3 /$p $(curl -s -m 20 "$B/$p?$CB" | grep -cE 'sample-clinic|/doctor/clinic-[0-9]|profile\.html\?id=')"; done   # each 0
git grep -nE 'sample-clinic|/doctor/clinic-[0-9]' -- ':!*.md' | head                                   # empty
# --- 4. secrets untracked, local kept ---
git ls-files | grep -E '(^|/)(leads\.db|.*\.db|\.env(\..*)?)$' | grep -vE '\.example$'                 # empty
git check-ignore -v leads.db .env .env.shirazbeauty                                                     # all ignored
ls leads.db .env .env.shirazbeauty                                                                      # still exist locally
git log --oneline -1 -- .gitignore
# --- 5. PR ---
gh pr list --head cursor/seo-hub-sitemap-consolidation --base main --json number,url,state,autoMergeRequest   # 1 open PR, autoMergeRequest null
git rev-parse --short HEAD; git rev-parse --abbrev-ref HEAD
```

---

## Reply format

`deployed <short-sha> from <branch>`

Then paste: the PR URL, the list of clinics kept as real, and the acceptance output. If anything in item 4 would break production (env or DB loaded from git), stop and report instead of deploying.
