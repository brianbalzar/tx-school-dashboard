# Texas School District Opportunity Research (Upchurch)

A private research and briefing tool: it surfaces Texas school districts with evidence-backed facilities hypotheses under three lenses (performance contracting, facilities O&M, capital planning / FCA). You can investigate each district, pin findings, and export one-page briefs and charts.

> The dashboard identifies credible, evidence-backed hypotheses. It cannot diagnose building condition or guarantee savings without district-specific facility and utility data.

## Layout

```
scripts/fetch_data.py          download raw public data -> data/raw/  (see data/MANUAL_DOWNLOADS.md)
scripts/build_reference.py     raw -> data/processed/ (districts, campuses, enrollment, tax, values, bonds, debt)
scripts/build_peims_detail.py  PEIMS detail -> data/processed/peims_detail_agg.csv
scripts/build_app_data.py      processed -> app/data/bundle.json  (peers, signals, sizing, series; thresholds at top)
config/sizing.json             Upchurch ESCO / Uptime Ops / EMaaS sizing assumptions (internal)
app/                           Vite + React single-page app
  scripts/prepare-data.mjs     encrypts bundle.json -> app/public/data/bundle.enc.json (AES-GCM, team key)
docs/                          DESIGN_BRIEF.md, DATA_INVENTORY.md, SIZING_METHODOLOGY.md
design/handoff/                Claude Design prototype (reference only)
assets/brand/                  official Upchurch logos
archive/observable-v0/         the first Observable Framework prototype (retired)
```

## Refresh the data (once a year, or when TEA publishes)

```powershell
pip install -r requirements.txt
python scripts/fetch_data.py                 # new files only
python scripts/build_reference.py            # also reads data/raw/reference/tips_members_*.xlsx (newest)
python scripts/build_peims_detail.py         # rerun until it says "combined …" (it checkpoints)
cd app
npm install
$env:TEAM_KEY = "the team key"; npm run data # builds bundle.json and encrypts it
npm run dev                                  # check it locally
```

Commit `app/public/data/bundle.enc.json` and push. The GitHub Action builds and publishes the site. **Never commit `app/data/bundle.json`** (plaintext; it's git-ignored).

## Changing the team key

Run `npm run data` (or `npm run encrypt`) with the new `TEAM_KEY`, commit the new `bundle.enc.json`, push, and share the new key. Old keys stop working immediately. Browsers that remembered the old key get the unlock screen again.

## Publish to GitHub Pages (one-time)

1. Create a **private** repo and push this folder to `main`. Publishing Pages from a private repo needs GitHub Pro or Team.
2. In the repo, open **Settings → Pages → Source** and choose **GitHub Actions**.

The site is public at its URL, but it shows only the unlock screen and holds only encrypted data.

## Tuning signals

Thresholds live in `THRESH` at the top of `scripts/build_app_data.py`. The Methodology page in the app lists every rule. After changing them, rerun `npm run data`; the script prints how many districts each signal flags.

## Sizing assumptions

ESCO, Uptime Ops and Energy Manager as a Service sizing come from `config/sizing.json` (see `docs/SIZING_METHODOLOGY.md`). Edit the file, then rerun `npm run data` with your `TEAM_KEY`. Sizing and TIPS contacts exist only inside the encrypted bundle, and they're kept off the client-facing brief. To refresh TIPS membership, drop a new `tips_members_YYYY-MM-DD.xlsx` into `data/raw/reference/` and rerun `build_reference.py`.
