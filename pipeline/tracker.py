#!/usr/bin/env python3
"""
Divest Tender Tracker
---------------------
Finds UK public contracts awarded to companies on the BDS divestment
shortlist (shortlist.json) and works out each contract's current status.

Data source: the Open Contracting Partnership data registry's export of
UK Find a Tender (FTS). It holds one *compiled release* per procurement:
the merged latest state of every notice (award, contract details, changes,
terminations), flattened into linked CSV tables.

Usage
  python3 pipeline/tracker.py united_kingdom_fts_full.csv.tar.gz
  python3 pipeline/tracker.py path/to/extracted/full/   # or an extracted folder
  python3 pipeline/tracker.py ... --out data --strict

Outputs (in --out, default <repo>/data). The SvelteKit app in src/ reads the
two JSON files at build time; the CSVs are the human-readable diffable record.
  contracts.json    summary rows + metadata, one row per (procurement, company)
  awards.json       one row per (award/lot, contract, company)
  contracts.csv     same rows as contracts.json
  awards_detail.csv same rows as awards.json

Needs: Python 3.9+ and pandas  (pip install pandas)
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import tarfile
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
NOTICE_URL = "https://www.find-tender.service.gov.uk/Notice/"
RECORD_URL = "https://www.find-tender.service.gov.uk/api/1.0/ocdsRecordPackages/"

LIVE = ["Active", "Extension window", "Upcoming", "Pending"]
ORDER = LIVE + ["Probably active", "No end date", "Probably ended", "Expired", "Terminated", "Cancelled",
                "Not awarded"]
ESTIMATED = ("notice text", "framework legal maximum")
NUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8,
       "nine": 9, "ten": 10, "twelve": 12, "eighteen": 18, "twenty four": 24, "thirty six": 36}
DURATION = re.compile(
    r"(?:period|term|duration|contract will run|contract length|for)\b[^.;]{0,60}?\b"
    r"(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|eighteen|twenty four|thirty six)"
    r"\s*(?:\(\d{1,2}\)\s*)?(years?|yrs?|months?)\b", re.I)


def parse_duration(text: str):
    """Days from phrases like 'for a period of 3 years' or 'term of 36 months'."""
    m = DURATION.search((text or "").replace("-", " "))
    if not m:
        return None
    n = m.group(1).lower()
    n = int(n) if n.isdigit() else NUM.get(n)
    if not n:
        return None
    days = n * (365 if m.group(2).lower().startswith("y") else 30.4)
    return int(days) if 30 <= days <= 365 * 25 else None


def log(msg):
    print(msg, file=sys.stderr, flush=True)


# --------------------------------------------------------------------------
# Reading the OCP export
# --------------------------------------------------------------------------
TABLES = {
    "awards_suppliers": ["id", "name", "main_ocid", "awards_id"],
    "awards": ["id", "status", "relatedLots", "main_ocid", "title", "date", "value_amount",
               "value_currency", "contractPeriod_startDate", "contractPeriod_endDate",
               "contractPeriod_maxExtentDate"],
    "contracts": ["id", "dateSigned", "status", "awardID", "value_amount", "value_currency",
                  "main_ocid", "title", "period_durationInDays", "period_startDate",
                  "period_endDate", "period_maxExtentDate", "finalStatusDate"],
    "tender_lots": ["id", "main_ocid", "value_amount", "contractPeriod_durationInDays",
                    "contractPeriod_startDate", "contractPeriod_endDate",
                    "contractPeriod_maxExtentDate"],
    "main": ["ocid", "date", "buyer_name", "tender_title", "tender_status",
             "tender_mainProcurementCategory", "tender_procurementMethod",
             "tender_value_amount", "tender_value_currency",
             "tender_techniques_hasFrameworkAgreement", "tender_contractPeriod_durationInDays",
             "tender_contractPeriod_startDate", "tender_contractPeriod_endDate",
             "description", "tender_description", "tender_legalBasis_id"],
}


class Source:
    """Reads tables from a .tar.gz export or an extracted folder."""

    def __init__(self, path: Path):
        self.path = path
        self.tar = tarfile.open(path, "r:gz") if path.is_file() else None
        self.members = {}
        if self.tar:
            for m in self.tar.getmembers():
                if m.name.endswith(".csv"):
                    self.members[Path(m.name).stem] = m

    def read(self, table: str, ocids: set | None = None) -> pd.DataFrame:
        want = TABLES[table]
        if self.tar:
            fh = self.tar.extractfile(self.members[table])
        else:
            fh = open(self.path / f"{table}.csv", "rb")
        key = "ocid" if table == "main" else "main_ocid"
        if ocids is None:
            df = pd.read_csv(fh, dtype=str, usecols=lambda c: c in want, keep_default_na=False)
        else:  # stream big tables, keep only matched procurements
            parts = []
            for chunk in pd.read_csv(fh, dtype=str, usecols=lambda c: c in want,
                                     keep_default_na=False, chunksize=100_000):
                parts.append(chunk[chunk[key].isin(ocids)])
            df = pd.concat(parts) if parts else pd.DataFrame(columns=want)
        for c in want:  # tolerate schema drift between exports
            if c not in df.columns:
                df[c] = ""
        return df


# --------------------------------------------------------------------------
# Matching suppliers to the shortlist
# --------------------------------------------------------------------------
def norm(s: str) -> str:
    s = (s or "").lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return f" {' '.join(s.split())} "


class Matcher:
    def __init__(self, shortlist: dict):
        self.companies = []
        for c in shortlist["companies"]:
            n = lambda xs: [norm(x) for x in xs if x.strip()]
            self.companies.append({
                "name": c["name"], "country": c.get("country", ""),
                "aliases": n(c.get("aliases", [])), "broad": n(c.get("broad", [])),
                "exclude": n(c.get("exclude", [])),
                "ch": {str(x).lstrip("0") for x in c.get("ch", [])},
            })

    def match(self, name: str, ident: str = ""):
        nm = norm(name)
        coh = ident.split("GB-COH-", 1)[1].lstrip("0") if "GB-COH-" in ident else None
        out = []
        for c in self.companies:
            if coh and coh in c["ch"]:
                out.append((c, "high"))
            elif any(x in nm for x in c["exclude"]):
                continue
            elif any(a in nm for a in c["aliases"]):
                out.append((c, "name"))
            elif any(a in nm for a in c["broad"]):
                out.append((c, "check"))
        return out


# --------------------------------------------------------------------------
# Status
# --------------------------------------------------------------------------
def first(*vals):
    for v in vals:
        if v not in ("", None) and not (isinstance(v, float) and pd.isna(v)):
            return v
    return ""


def to_date(s):
    try:
        return dt.date.fromisoformat(str(s)[:10]) if s else None
    except ValueError:
        return None


def add_days(start, days):
    try:
        d = to_date(start)
        return (d + dt.timedelta(days=int(float(days)))).isoformat() if d else ""
    except (TypeError, ValueError):
        return ""


def status_for(r, today: dt.date) -> str:
    st = _status(r, today)
    src = r.get("end_date_source", "")
    if src.startswith(ESTIMATED) and st in ("Active", "Upcoming", "Extension window"):
        return "Probably active"
    if src.startswith(ESTIMATED) and st == "Expired":
        return "Probably ended"
    if st == "No end date" and src.startswith("age"):
        return "Probably ended"
    return st


def _status(r, today: dt.date) -> str:
    cs, as_, ts = r["contract_status"], r["award_status"], r["tender_status"]
    if cs == "terminated":
        return "Terminated"
    if cs == "cancelled" or as_ == "cancelled" or ts in ("cancelled", "withdrawn"):
        return "Cancelled"
    if as_ == "unsuccessful":
        return "Not awarded"
    start, end, mx = to_date(r["start_date"]), to_date(r["end_date"]), to_date(r["max_end_date"])
    if start and start > today:
        return "Upcoming"
    if end and end < today:
        return "Extension window" if mx and mx >= today else "Expired"
    if as_ == "pending" and not cs:
        return "Pending"
    if end:
        return "Active"
    return "No end date"


# --------------------------------------------------------------------------
# Pipeline
# --------------------------------------------------------------------------
# --------------------------------------------------------------------------
# Contracts Finder cross-check (option 1)
# --------------------------------------------------------------------------
STOP = set("the of and for to a an in on ltd limited services service contract supply provision "
           "framework agreement lot uk council nhs trust".split())


def tokens(s):
    return {w for w in norm(s).split() if len(w) > 2 and w not in STOP}


def jaccard(a, b):
    return len(a & b) / len(a | b) if a and b else 0.0


class ContractsFinder:
    """Contract periods from the OCP Contracts Finder export, matched to FTS rows by
    company + buyer + title (or identical value). Contracts Finder award notices
    must carry a start and end date, so it fills many gaps in FTS."""

    def __init__(self, paths, matcher: Matcher):
        self.by_company = {}
        for p in paths:
            p = Path(p)
            if p.is_dir() and (p / "full").is_dir():
                p = p / "full"
            src = Source(p)
            log(f"Contracts Finder: reading {p.name}…")
            sup = src.read("awards_suppliers")
            names = sup[["name", "id"]].drop_duplicates()
            hit = [(n, i, c["name"]) for n, i in names.itertuples(index=False) for c, conf in matcher.match(n, i)
                   if conf != "check"]
            hit = pd.DataFrame(hit, columns=["name", "id", "company"])
            m = sup.merge(hit, on=["name", "id"]).rename(columns={"awards_id": "award_id"})
            ocids = set(m.main_ocid)
            aw = src.read("awards", ocids).rename(columns={"id": "award_id"})
            ct = src.read("contracts", ocids).rename(columns={"awardID": "award_id"})
            mn = src.read("main", ocids).rename(columns={"ocid": "main_ocid"}).drop_duplicates("main_ocid")
            d = (m.merge(aw.drop_duplicates(["main_ocid", "award_id"]), on=["main_ocid", "award_id"], how="left")
                  .merge(ct.drop_duplicates(["main_ocid", "award_id"]), on=["main_ocid", "award_id"], how="left",
                         suffixes=("", "_c"))
                  .merge(mn, on="main_ocid", how="left").fillna(""))
            for r in d.to_dict("records"):
                end = first(r.get("period_endDate", ""), r.get("contractPeriod_endDate", ""),
                            r.get("tender_contractPeriod_endDate", ""))
                if not end:
                    continue
                self.by_company.setdefault(r["company"], []).append({
                    "buyer": tokens(r.get("buyer_name", "")),
                    "title": tokens(first(r.get("title", ""), r.get("title_c", ""), r.get("tender_title", ""))),
                    "value": first(r.get("value_amount_c", ""), r.get("value_amount", "")),
                    "start": str(first(r.get("period_startDate", ""), r.get("contractPeriod_startDate", "")))[:10],
                    "end": str(end)[:10],
                    "max_end": str(first(r.get("period_maxExtentDate", ""),
                                         r.get("contractPeriod_maxExtentDate", "")))[:10],
                    "ocid": r["main_ocid"],
                })
            log(f"  {sum(len(v) for v in self.by_company.values())} dated awards for shortlisted companies")

    def find(self, company, buyer, title, value):
        b, t = tokens(buyer), tokens(title)
        best, score = None, 0.0
        for c in self.by_company.get(company, []):
            sb = jaccard(b, c["buyer"])
            if sb < 0.4:
                continue
            st = jaccard(t, c["title"])
            same_value = bool(value) and c["value"] and abs(float(c["value"]) - float(value)) < 1
            sc = sb * 0.4 + st * 0.6 + (0.3 if same_value else 0)
            if (st >= 0.5 or same_value) and sc > score:
                best, score = c, sc
        return best, score


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def build(src: Source, matcher: Matcher, include_check: bool, cf: "ContractsFinder | None" = None,
          framework_max: bool = False) -> tuple[pd.DataFrame, dict]:
    today = dt.date.today()

    log("Matching suppliers…")
    sup = src.read("awards_suppliers")
    uniq = sup[["name", "id"]].drop_duplicates()
    hits = []
    for name, ident in uniq.itertuples(index=False):
        for comp, conf in matcher.match(name, ident):
            hits.append((name, ident, comp["name"], comp["country"], conf))
    hits = pd.DataFrame(hits, columns=["name", "id", "company", "company_country", "confidence"])
    if not include_check:
        hits = hits[hits.confidence != "check"]
    m = sup.merge(hits, on=["name", "id"])
    m = m.rename(columns={"name": "supplier_name", "id": "supplier_id", "awards_id": "award_id"})
    m = m.drop_duplicates(["main_ocid", "award_id", "company", "supplier_name"])
    ocids = set(m.main_ocid)
    log(f"  {len(m)} supplier-award matches across {len(ocids)} procurements")

    log("Joining awards, contracts, lots, procurement details…")
    aw = src.read("awards", ocids).add_prefix("a_").rename(columns={"a_main_ocid": "main_ocid", "a_id": "award_id"})
    ct = src.read("contracts", ocids).add_prefix("c_").rename(columns={"c_main_ocid": "main_ocid", "c_awardID": "award_id"})
    lots = src.read("tender_lots", ocids).add_prefix("l_").rename(columns={"l_main_ocid": "main_ocid"})
    mn = src.read("main", ocids).rename(columns={"ocid": "main_ocid"})
    # ~6% of notices repeat a row; keep one per key
    aw = aw.drop_duplicates(["main_ocid", "award_id"])
    lots = lots.drop_duplicates(["main_ocid", "l_id"])
    mn = mn.drop_duplicates(["main_ocid"])

    # count suppliers per award (shared frameworks)
    n_sup = sup.groupby(["main_ocid", "awards_id"]).size().rename("suppliers_on_award").reset_index()
    n_sup = n_sup.rename(columns={"awards_id": "award_id"})

    d = (m.merge(aw, on=["main_ocid", "award_id"], how="left")
          .merge(ct, on=["main_ocid", "award_id"], how="left")
          .merge(n_sup, on=["main_ocid", "award_id"], how="left")
          .merge(mn, on="main_ocid", how="left"))
    d["a_relatedLots"] = d["a_relatedLots"].fillna("").astype(str).str.split(",").str[0].str.strip()
    d = d.merge(lots, left_on=["main_ocid", "a_relatedLots"], right_on=["main_ocid", "l_id"], how="left")
    d = d.fillna("")

    rows = []
    for r in d.to_dict("records"):
        start = first(r["c_period_startDate"], r["a_contractPeriod_startDate"],
                      r["l_contractPeriod_startDate"], r["tender_contractPeriod_startDate"])
        end, src_end = "", ""
        for col, label in [("c_period_endDate", "contract"), ("a_contractPeriod_endDate", "award"),
                           ("l_contractPeriod_endDate", "lot"), ("tender_contractPeriod_endDate", "tender")]:
            if r[col]:
                end, src_end = r[col], label
                break
        if not end:
            base = first(start, r["c_dateSigned"], r["a_date"])
            dur = first(r["c_period_durationInDays"], r["l_contractPeriod_durationInDays"],
                        r["tender_contractPeriod_durationInDays"])
            if base and dur:
                end, src_end = add_days(base, dur), "estimated (start + duration)"
        nid = next((x[:11] for x in (r["award_id"], r["c_id"]) if re.match(r"\d{6}-\d{4}", str(x))), "")
        n_sup = int(r["suppliers_on_award"] or 0)
        multi = n_sup > 1 or str(r["tender_techniques_hasFrameworkAgreement"]).lower() == "true"
        title = str(first(r["c_title"], r["a_title"], r["tender_title"]))
        max_end = str(first(r["c_period_maxExtentDate"], r["a_contractPeriod_maxExtentDate"],
                            r["l_contractPeriod_maxExtentDate"]))[:10]
        if not end and cf:
            val = _num(first(r["c_value_amount"], r["a_value_amount"]))
            hit, sc = cf.find(r["company"], r["buyer_name"], title, val)
            if hit:
                end, src_end = hit["end"], f"Contracts Finder ({hit['ocid']}, match {sc:.2f})"
                start = start or hit["start"]
                max_end = max_end or hit["max_end"]
        if not end:
            # no published period: fall back to clearly-labelled estimates
            base, note = first(start, r["c_dateSigned"], r["a_date"]), ""
            if not base and nid:
                base, note = f"{nid[7:11]}-07-01", ", approx. start from notice year"
            days = parse_duration(" ".join([r["description"], r["tender_description"],
                                            str(first(r["c_title"], r["a_title"], r["tender_title"]))]))
            defence = "32009L0081" in r["tender_legalBasis_id"] or re.search(
                r"defence|defense|\bmod\b|dstl|royal navy|british army|royal air force", r["buyer_name"], re.I)
            if base and days:
                end, src_end = add_days(base, days), f"notice text{note}"
            elif multi and framework_max:
                if not base:
                    base, note = r["date"][:10], ", counted from latest notice date"
                yrs = 7 if defence else 4
                end, src_end = add_days(base, yrs * 365), f"framework legal maximum ({yrs} yrs{note})"
            elif base and to_date(base) and to_date(base) < today - dt.timedelta(days=5 * 365):
                src_end = "age (awarded over 5 years ago, no period published)"
        value, basis = "", ""
        for col, label in [("c_value_amount", "contract"), ("a_value_amount", "award"), ("l_value_amount", "lot"),
                           ("tender_value_amount", "tender")]:
            if r[col]:
                value, basis = r[col], label
                break
        currency = first(r["c_value_currency"], r["a_value_currency"], r["tender_value_currency"], "GBP")
        row = {
            "company": r["company"],
            "company_country": r["company_country"],
            "confidence": r["confidence"],
            "supplier_name": r["supplier_name"].strip(),
            "buyer": r["buyer_name"],
            "title": first(r["c_title"], r["a_title"], r["tender_title"]),
            "status": "",
            "award_status": r["a_status"],
            "contract_status": r["c_status"],
            "tender_status": r["tender_status"],
            "value": float(value) if re.fullmatch(r"-?\d+(\.\d+)?", str(value)) else None,
            "value_basis": basis,
            "currency": currency,
            "framework": str(r["tender_techniques_hasFrameworkAgreement"]).lower() == "true",
            "suppliers_on_award": n_sup,
            "category": r["tender_mainProcurementCategory"],
            "award_date": r["a_date"][:10],
            "date_signed": r["c_dateSigned"][:10],
            "start_date": str(start)[:10],
            "end_date": str(end)[:10],
            "end_date_source": src_end,
            "max_end_date": max_end,
            "last_updated": r["date"][:10],
            "ocid": r["main_ocid"],
            "award_id": r["award_id"],
            "contract_id": r["c_id"],
            "notice_url": NOTICE_URL + nid if nid else RECORD_URL + r["main_ocid"],
        }
        row["status"] = status_for(row, today)
        rows.append(row)

    out = pd.DataFrame(rows)
    rank = {s: i for i, s in enumerate(ORDER)}
    if not out.empty:
        # the same company listed twice on one award (name variants) -> one row
        key = ["ocid", "award_id", "contract_id", "company"]
        names = out.groupby(key)["supplier_name"].agg(lambda s: "; ".join(sorted(set(s))))
        out = out.drop_duplicates(key).drop(columns="supplier_name").merge(names.reset_index(), on=key)
        out["_o"] = out.status.map(rank)
        out = out.sort_values(["_o", "company", "end_date"]).drop(columns="_o")
    meta = {
        "generated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_as_of": mn["date"].max()[:10] if len(mn) else "",
        "source": src.path.name,
        "procurements": len(ocids),
    }
    return out, meta


def summarise(df: pd.DataFrame) -> pd.DataFrame:
    """One row per (procurement, company). Big frameworks split into dozens of
    lots would otherwise flood the list; lots are counted instead."""
    if df.empty:
        return df
    rank = {s: i for i, s in enumerate(ORDER)}
    out = []
    for (ocid, company), g in df.groupby(["ocid", "company"], sort=False):
        g = g.assign(_o=g.status.map(rank)).sort_values("_o")
        top = g.iloc[0]
        per_award = g.drop_duplicates("award_id")
        own = per_award[per_award.value_basis.isin(["contract", "award", "lot"])]
        if len(own):
            value, basis = own.value.sum(min_count=1), own.value_basis.iloc[0]
        else:
            value, basis = per_award.value.max(), "tender"
        multi = int(g.suppliers_on_award.max() or 0) > 1 or bool(g.framework.any())
        out.append({
            "company": company, "company_country": top.company_country,
            "confidence": "check" if (g.confidence == "check").all() else top.confidence,
            "status": top.status,
            "buyer": top.buyer, "title": top.title,
            "type": "Framework / multi-supplier" if multi else "Contract",
            "suppliers_on_award": int(g.suppliers_on_award.max() or 0),
            "lots_won": int(g.award_id.nunique()),
            "value": None if pd.isna(value) else float(value),
            "value_basis": basis, "currency": top.currency,
            "start_date": min([d for d in g.start_date if d] or [""]),
            "end_date": max([d for d in g.end_date if d] or [""]),
            "end_date_source": top.end_date_source,
            "max_end_date": max([d for d in g.max_end_date if d] or [""]),
            "date_signed": min([d for d in g.date_signed if d] or [""]),
            "last_updated": g.last_updated.max(),
            "category": top.category,
            "supplier_name": "; ".join(sorted(set("; ".join(g.supplier_name).split("; ")))),
            "ocid": ocid, "notice_url": top.notice_url,
            "record_url": RECORD_URL + ocid,
        })
    s = pd.DataFrame(out)
    s["_o"] = s.status.map(rank)
    return s.sort_values(["_o", "company", "end_date"]).drop(columns="_o")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", help="OCP export: the .csv.tar.gz file or its extracted folder")
    ap.add_argument("--out", default=str(HERE.parent / "data"))
    ap.add_argument("--shortlist", default=str(HERE / "shortlist.json"))
    ap.add_argument("--strict", action="store_true", help="leave out 'check' (broad-name) matches")
    ap.add_argument("--contracts-finder", nargs="*", default=[], metavar="EXPORT",
                    help="OCP Contracts Finder export(s) (.csv.tar.gz or folder) to fill missing end dates")
    ap.add_argument("--framework-max", action="store_true",
                    help="estimate undated frameworks' end from the legal maximum term (4 yrs, 7 defence)")
    args = ap.parse_args(argv)

    src_path = Path(args.source)
    if src_path.is_dir() and (src_path / "full").is_dir():
        src_path = src_path / "full"
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    matcher = Matcher(json.loads(Path(args.shortlist).read_text(encoding="utf-8")))
    cf = ContractsFinder(args.contracts_finder, matcher) if args.contracts_finder else None
    df, meta = build(Source(src_path), matcher, include_check=not args.strict, cf=cf,
                     framework_max=args.framework_max)

    summary = summarise(df)
    df.to_csv(out / "awards_detail.csv", index=False)
    summary.to_csv(out / "contracts.csv", index=False)
    rows = json.loads(summary.to_json(orient="records"))
    awards = json.loads(df.to_json(orient="records"))
    (out / "contracts.json").write_text(json.dumps({"meta": meta, "rows": rows}, indent=1))
    (out / "awards.json").write_text(json.dumps({"meta": meta, "rows": awards}, indent=1))

    live = summary[summary.status.isin(LIVE)] if len(summary) else summary
    log(f"\n{len(summary)} procurements ({len(live)} live) across "
        f"{summary.company.nunique() if len(summary) else 0} companies; {len(df)} award-level rows")
    log(f"Wrote contracts.json, awards.json, contracts.csv, awards_detail.csv to {out}")


if __name__ == "__main__":
    main()
