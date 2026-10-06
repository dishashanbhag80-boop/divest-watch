# Divest Contract Watch

Tracks UK public contracts held by companies on the
[BDS divestment shortlist](https://investigate.info/divest), and whether each one
is still running.

**Live site: https://dishashanbhag80-boop.github.io/divest-watch/**

A Python pipeline reads the monthly UK procurement export and writes a dataset;
a SvelteKit app turns that dataset into a browsable site. Both live in this repo
and both run in CI.

- **Dashboard** — summary figures, the companies index, and a filterable register
  of every procurement. Filters live in the URL, so any view is a shareable link.
- **Companies** — one page per company: its live work, how it was matched, which
  supplier names it trades under, and which buyers it sells to most.
- **Buyers** — one page per public body. Departments that publish their name more
  than one way are merged into a single page.
- **Procurements** — a permalink per procurement, down to the individual award
  and lot rows behind the summary.
- **Method** — where the data comes from, how status is decided, and what the
  figures do not cover.
- **API** — `/api/contracts.json`, `/api/awards.json`, `/api/companies.json` and
  `/api/contracts.csv`, all prerendered as static files.

## Run it

```bash
npm install
npm run dev
```

The app reads `data/contracts.json` and `data/awards.json`, which are committed,
so it runs without touching the pipeline.

```bash
npm run check    # svelte-check + tsc
npm test         # vitest
npm run build    # prerenders every page into build/
npm run preview  # serve build/
```

Node 22 or newer.

## Refreshing the data

The dataset is rebuilt by `pipeline/tracker.py`, which needs Python 3.9+ and
pandas. It takes the Open Contracting Partnership's export of UK
[Find a Tender](https://data.open-contracting.org/en/publication/41) — one
compiled release per procurement, the merged latest state of every notice.

```bash
pip install -r pipeline/requirements.txt

# download full.csv.tar.gz from the Find a Tender publication page
python3 pipeline/tracker.py full.csv.tar.gz

# optionally fill in missing end dates from Contracts Finder yearly exports
python3 pipeline/tracker.py full.csv.tar.gz \
  --contracts-finder cf_2021.csv.tar.gz cf_2022.csv.tar.gz
```

It writes four files to `data/`:

| File                | Contents                                                            |
| ------------------- | ------------------------------------------------------------------- |
| `contracts.json`    | summary rows the app is built from, one per procurement per company |
| `awards.json`       | one row per award or lot, which the summary rolls up                |
| `contracts.csv`     | the same summary rows, diffable in the commit history               |
| `awards_detail.csv` | the same award rows                                                 |

Options: `--strict` drops broad name matches, `--framework-max` estimates undated
frameworks from the legal maximum term (4 years, 7 for defence).

## How it fits together

```
pipeline/tracker.py          reads the OCP export, matches suppliers, decides status
  └─ pipeline/shortlist.json the company list and its matching rules
data/*.json                  committed output; the app's only data source
src/lib/status.ts            status recomputed against today, in the browser
src/lib/filters.ts           filter state ⇄ query string
src/lib/server/data.ts       inlines data/ at build time (prerender only)
src/routes/                  every page prerendered to a static file
```

Two pieces of logic are deliberately duplicated between Python and TypeScript:
deciding a contract's status, and deciding what evidence its end date rests on.
The pipeline stamps a status when it runs; the app recomputes it against the
current date on every page view, so a contract that expired since last month's
refresh shows as expired rather than active. `src/lib/status.spec.ts` pins that
behaviour down.

## Deploying

`.github/workflows/deploy.yml` typechecks, tests, builds and publishes to GitHub
Pages on every push to `main`. Pages is already configured to build from GitHub
Actions; a fresh fork needs that set under **Settings → Pages → Build and
deployment → Source: GitHub Actions**.

Every internal link is resolved relative to the page it sits on, so the same
build works at a domain root or under `/<repo>` on Project Pages — there is no
base path to configure.

`.github/workflows/refresh.yml` runs on the 7th of each month at 06:17 UTC, a few
days after the registry's monthly update. It downloads the newest export, rebuilds
`data/`, and commits only if something changed — which then triggers a deploy. It
can also be run on demand from the **Actions** tab.

## Editing the company list

Each company in `pipeline/shortlist.json` has:

- `aliases` — phrases that identify it in a supplier name (whole words, case-insensitive)
- `broad` — looser phrases, surfaced as _check_ and hidden by default
- `exclude` — phrases that veto a match (e.g. "leonardo hotel")
- `ch` — Companies House numbers, the most reliable match

## Caveats

- Values are **published values, not payments**. Framework values are usually a
  ceiling shared by every supplier, so the headline total counts single-supplier
  contracts only.
- Covers Find a Tender (above-threshold UK procurement, 2021 onwards) plus
  Contracts Finder dates. Classified defence contracts are not published.
- Supplier matching is by name and can miss or wrongly include an entity. Check
  the original notice before relying on a row.
- Sub-contracting is invisible: a company supplying a prime contractor does not
  appear as a supplier on the notice.

## Data licence

Contains public sector information licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/),
via the Open Contracting Partnership data registry.
