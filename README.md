# Sierentz ⇄ Basel SBB — train delay tracker

Tracks how late my daily commuter trains are, using the **SNCF (Navitia) API**,
and publishes a dashboard on GitHub Pages.

- **Morning** — Sierentz → Basel SBB: **07:02 · 07:32 · 08:02 · 08:32**
- **Evening** — Basel SBB → Sierentz: **17:08 · 17:38 · 18:08 · 18:38**

Each ride is ~18 min. Delay is measured **at arrival** (delay tends to accumulate
after departure). Monday–Friday only. The dashboard also ranks the four morning
and four evening departures by reliability, to advise which to take.

To track different trains, edit `MORNING` / `EVENING` in `src/config.js` — the
collector and dashboard pick them up automatically.

## Why SNCF-only, and why daily

We investigated several sources. The relevant constraints:

- The **SNCF/Navitia API** is the only source that gives the full picture for
  both directions (including the French Sierentz arrival). But it has a
  **rolling ~30-day window** (mostly *forward*; only ~2 days back), and it
  **retains a train's realized delay essentially for the current day** —
  yesterday's runs revert to the theoretical schedule.
- There is **no retroactive history**: you cannot pull the last 30 days of
  realized delays. The dataset therefore starts now and grows forward.
- Consequently the collector must run **daily on weekdays** (a weekly run would
  miss most commutes). One evening run captures both that day's trains.

(The Swiss "Ist-Daten" archive does hold real history, but only the Basel-side
event for each train — morning *arrival* and evening *departure* — so we left it
out to keep a single, consistent source. See the project notes if you want to
backfill from it later.)

## Setup

Requires Node ≥ 22.

```bash
npm ci
cp .env.example .env      # then put your SNCF token in it
```

Get a free token at <https://numerique.sncf.com/startup/api/token-developpeur/>.
It is used as the HTTP Basic auth username (empty password).

## Collecting data

```bash
node src/collect.js                # dry-run, today (Europe/Paris)
node src/collect.js -x              # write today's observations
node src/collect.js -x -b 2         # backfill the last 2 days (max useful)
node src/collect.js -x 2026-06-08   # a specific date
node src/collect.js -h              # help
```

Dry-run by default; pass **`-x`** to actually write files. Weekends are skipped
unless you pass `-w`.

Data is stored as **one JSON file per ISO week** under `docs/data/`
(`2026-W24.json`, …), plus `manifest.json` which the dashboard reads first.
Re-collecting a day overwrites that day's two entries.

## Dashboard

`docs/` is a static site (no build step). Locally:

```bash
python3 -m http.server 8099 --directory docs   # then open http://localhost:8099
```

It shows a stats panel (share of late/cancelled trains, accumulated and average
delay, worst case — overall and per direction) and a table of every train, with
rows shaded **light red** (< 5 min late), **heavy red** (≥ 5 min late) or solid
red (**cancelled**).

## GitHub automation

1. Push this repo to GitHub.
2. **Settings → Secrets and variables → Actions** → add `SNCF_API_TOKEN`.
3. **Settings → Pages** → *Deploy from a branch* → `main` / `/docs`.
4. The workflow `.github/workflows/collect.yml` runs Mon–Fri at 18:00 UTC,
   collects the day's trains, and commits the updated `docs/data/`. You can also
   trigger it manually from the Actions tab.

## Development

```bash
npm test     # node --test
npm run lint # eslint
```

Pure logic (date math, API parsing, observation building, stats, merge) is unit
tested; `src/sncf.js` is verified against real API response fixtures in
`test/fixtures/`.
