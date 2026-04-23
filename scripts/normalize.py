#!/usr/bin/env python3
"""Normalize raw DPRI + 12MLR project data into the canonical schema.

Rules live in /home/user/Professional-Dashboards/SPEC.md §3.
This script is the only authoritative implementation of those rules.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

DPRI_RAW = DATA / "projects-dpri-raw.json"
MLR_RAW = DATA / "projects-12mlr-raw.json"

OUT_PROJECTS = DATA / "projects.json"
OUT_INSTALLATIONS = DATA / "installations.json"
OUT_PROGRAMS = DATA / "programs.json"
OUT_REPORT = DATA / "NORMALIZATION-REPORT.md"


# ---------- Installation canonicalization (SPEC §3.5) ----------

INSTALLATION_ALIASES = {
    "HANSEN": "Camp Hansen",
    "CAMP HANSEN": "Camp Hansen",
    "FOSTER": "Camp Foster",
    "CAMP FOSTER": "Camp Foster",
    "SCHWAB": "Camp Schwab",
    "CAMP SCHWAB": "Camp Schwab",
    "COURTNEY": "Camp Courtney",
    "CAMP COURTNEY": "Camp Courtney",
}

INSTALLATION_ID = {
    "Camp Hansen": "camp-hansen",
    "Camp Foster": "camp-foster",
    "Camp Schwab": "camp-schwab",
    "Camp Courtney": "camp-courtney",
    "Unknown": "unknown",
}

INSTALLATION_COLOR = {
    "Camp Schwab": "#1E3F5C",
    "Camp Hansen": "#0B6E4F",
    "Camp Foster": "#7A5900",
    "Camp Courtney": "#3A3A9E",
    "Unknown": "#8A98A8",
}


def canon_installation(raw: str) -> tuple[str, bool, str | None]:
    """Return (canonical_name, unknownInstallation_flag, original_if_unknown)."""
    if raw is None:
        return ("Unknown", True, None)
    up = raw.strip().upper()
    if up in INSTALLATION_ALIASES:
        return (INSTALLATION_ALIASES[up], False, None)
    # SPEC §3.5: SACO Program -> Unknown with original preserved
    if "SACO" in up and "PROGRAM" in up:
        return ("Unknown", True, raw)
    # Unknown installation — preserve original in notes
    return ("Unknown", True, raw)


# ---------- Program derivation (SPEC §3.4) ----------

DPRI_SUBPROGRAM_ID = {
    "FRF": "dpri-frf",
    "OKICON": "dpri-okicon",
    "SACO": "dpri-saco",
}

PROGRAMS = [
    {"id": "dpri-frf", "umbrella": "DPRI", "label": "DPRI / FRF", "color": "#1E3F5C",
     "description": "Futenma Replacement Facility"},
    {"id": "dpri-okicon", "umbrella": "DPRI", "label": "DPRI / OKICON", "color": "#2A5678",
     "description": "Okinawa Consolidation"},
    {"id": "dpri-saco", "umbrella": "DPRI", "label": "DPRI / SACO", "color": "#8C2B0B",
     "description": "Special Action Committee on Okinawa"},
    {"id": "12-mlr", "umbrella": "12th MLR", "label": "12th MLR", "color": "#2E91AE",
     "description": "12th Marine Littoral Regiment"},
    {"id": "3-12", "umbrella": "3/12", "label": "3/12", "color": "#7A5900",
     "description": "3rd Battalion, 12th Marines"},
    {"id": "3d-mardiv", "umbrella": "Other", "label": "3rd MarDiv", "color": "#3A3A9E",
     "description": "3rd Marine Division"},
    {"id": "mcipac", "umbrella": "Other", "label": "MCIPAC", "color": "#0B6E4F",
     "description": "Marine Corps Installations Pacific"},
    {"id": "maw", "umbrella": "Other", "label": "MAW", "color": "#5A0B8C",
     "description": "Marine Aircraft Wing"},
    {"id": "iii-mef", "umbrella": "Other", "label": "III MEF", "color": "#8A5900",
     "description": "III Marine Expeditionary Force"},
    {"id": "other", "umbrella": "Other", "label": "Other", "color": "#546270",
     "description": "Unclassified / miscellaneous"},
]


def derive_mlr_program(notes: str, foc: str) -> str:
    """Return the program id per SPEC §3.4 MLR rules. Order matters."""
    n = (notes or "").strip()
    f = (foc or "").strip()
    # 3/12 wins when explicitly tagged, even if "12th MLR" also appears
    if "12th MLR (3/12)" in n or "3/12" in f:
        return "3-12"
    if n.startswith("12th MLR") or "12th MLR" in n:
        return "12-mlr"
    if "3rdMarDiv" in n or "3rd MarDiv" in n:
        return "3d-mardiv"
    if "MCIPAC" in n:
        return "mcipac"
    if "MAW" in n:
        return "maw"
    if "IIIMEF" in n or "III MEF" in n:
        return "iii-mef"
    return "other"


# ---------- Tier-suffix stripping (SPEC §3.6) ----------

TIER_RE = re.compile(r"\s*\(T\d+\)\s*$")


def strip_tier(foc: str | None) -> tuple[str | None, str | None]:
    """Return (stripped, original_if_had_tier)."""
    if not foc:
        return (foc, None)
    if TIER_RE.search(foc):
        return (TIER_RE.sub("", foc).strip(), foc)
    return (foc, None)


# ---------- BOD derivation (SPEC §3.7) ----------

def year_of(iso: str | None) -> int | None:
    if not iso:
        return None
    m = re.match(r"(\d{4})", iso)
    return int(m.group(1)) if m else None


# ---------- Building-number extraction for DPRI (SPEC §3 note on `bldg`) ----------

# Match patterns like: "FACILITY 3216", "FACILITY 3235", "(F-2496)", "PL3401" etc.
# Prefer the 4-digit-after-FACILITY pattern; fall back to a generic 3-4 digit token.
BLDG_RE_PRIMARY = re.compile(r"\bFACILITY\s+(\d{3,4})\b", re.IGNORECASE)
BLDG_RE_SECONDARY = re.compile(r"\b([A-Z]{1,3}\d{3,5})\b")
BLDG_RE_TERTIARY = re.compile(r"\b(\d{4})\b")


def parse_bldg_from_dpri_name(name: str | None) -> str | None:
    if not name:
        return None
    m = BLDG_RE_PRIMARY.search(name)
    if m:
        return m.group(1)
    # Skip obvious non-bldg patterns (PL codes are DPRI project lines, not bldgs)
    m = BLDG_RE_SECONDARY.search(name)
    if m and not m.group(1).startswith("PL"):
        return m.group(1)
    m = BLDG_RE_TERTIARY.search(name)
    if m:
        return m.group(1)
    return None


# ---------- Normalization functions ----------

def normalize_dpri(rec: dict) -> dict:
    installation, unk, unk_orig = canon_installation(rec.get("installation"))
    sub_prog_raw = rec.get("program") or ""
    program_id = DPRI_SUBPROGRAM_ID.get(sub_prog_raw, "other")

    dates = {
        "fStart": rec.get("f_start"),
        "fFinish": rec.get("f_finish"),
        "bStart": rec.get("b_start"),
        "bFinish": rec.get("b_finish"),
        "dStart": rec.get("d_start"),
        "dFinish": rec.get("d_finish"),
        "cStart": rec.get("c_start"),
        "cFinish": rec.get("c_finish"),
        "aStart": rec.get("a_start"),
        "aFinish": rec.get("a_finish"),
    }
    bod_fy = year_of(dates["aFinish"])

    notes_parts = []
    if unk and unk_orig:
        notes_parts.append(f"Original installation field: {unk_orig}")

    return {
        "id": rec["id"],
        "source": "dpri",
        "program": program_id,
        "title": rec.get("name", ""),
        "installation": installation,
        "unknownInstallation": unk,
        "bldg": parse_bldg_from_dpri_name(rec.get("name")),
        "projectType": rec.get("type"),
        "phase": rec.get("phase"),
        "fundingSource": None,
        "status": None,
        "priority": None,
        "totalCost": None,
        "fyPlan": {},
        "dates": dates,
        "activationFY": bod_fy,
        "activationFYOverride": None,
        "foc": None,
        "focTierRaw": None,
        "replaces": rec.get("replaces"),
        "linked": rec.get("linked", []),
        "locked": False,
        "notes": "; ".join(notes_parts) if notes_parts else "",
        "ccns": [],
    }


def normalize_mlr(rec: dict) -> dict:
    installation, unk, unk_orig = canon_installation(rec.get("camp"))
    foc_stripped, foc_raw = strip_tier(rec.get("foc"))
    program_id = derive_mlr_program(rec.get("notes", ""), rec.get("foc", ""))

    fy_plan = {f"FY{yr}": rec.get(f"fy{yr}", 0) for yr in range(25, 32)}

    notes_parts = []
    if rec.get("notes"):
        notes_parts.append(rec["notes"])
    if unk and unk_orig:
        notes_parts.append(f"Original installation field: {unk_orig}")

    return {
        "id": rec["id"],
        "source": "mlr",
        "program": program_id,
        "title": rec.get("title", ""),
        "installation": installation,
        "unknownInstallation": unk,
        "bldg": rec.get("bldg") or None,
        "projectType": None,
        "phase": None,
        "fundingSource": rec.get("fs"),
        "status": rec.get("status"),
        "priority": rec.get("priority"),
        "totalCost": rec.get("total"),
        "fyPlan": fy_plan,
        "dates": None,
        "activationFY": None,
        "activationFYOverride": None,
        "foc": foc_stripped,
        "focTierRaw": foc_raw,
        "replaces": None,
        "linked": [],
        "locked": bool(rec.get("locked", False)),
        "notes": "; ".join(notes_parts),
        "ccns": [],
    }


# ---------- Main ----------

def main() -> None:
    dpri_raw = json.loads(DPRI_RAW.read_text())
    mlr_raw = json.loads(MLR_RAW.read_text())

    projects = [normalize_dpri(r) for r in dpri_raw] + [normalize_mlr(r) for r in mlr_raw]
    projects.sort(key=lambda p: p["id"])

    # Installations
    installations = [
        {"id": INSTALLATION_ID[name], "name": name, "service": "USMC",
         "country": "JPN", "color": INSTALLATION_COLOR[name]}
        for name in ["Camp Schwab", "Camp Hansen", "Camp Foster", "Camp Courtney", "Unknown"]
    ]

    # ---- Report stats ----
    umbrellas = Counter()
    programs_c = Counter()
    unknown_count = 0
    tier_stripped = 0
    dpri_bod_set = 0

    prog_by_id = {p["id"]: p for p in PROGRAMS}
    for p in projects:
        prog = prog_by_id[p["program"]]
        umbrellas[prog["umbrella"]] += 1
        programs_c[p["program"]] += 1
        if p["unknownInstallation"]:
            unknown_count += 1
        if p["focTierRaw"]:
            tier_stripped += 1
        if p["source"] == "dpri" and p["activationFY"] is not None:
            dpri_bod_set += 1

    # ---- Write outputs ----
    OUT_PROJECTS.write_text(json.dumps(projects, indent=2, ensure_ascii=False))
    OUT_INSTALLATIONS.write_text(json.dumps(installations, indent=2, ensure_ascii=False))
    OUT_PROGRAMS.write_text(json.dumps(PROGRAMS, indent=2, ensure_ascii=False))

    # ---- Report ----
    sample_dpri = next(p for p in projects if p["source"] == "dpri")
    sample_mlr_12 = next((p for p in projects if p["program"] == "12-mlr"), None)
    sample_mlr_312 = next((p for p in projects if p["program"] == "3-12"), None)
    sample_mlr_other = next((p for p in projects
                             if p["source"] == "mlr" and p["program"] not in ("12-mlr", "3-12")), None)

    report_lines = []
    w = report_lines.append
    w("# Normalization Report")
    w("")
    w("Generated by `scripts/normalize.py` per SPEC.md §3.")
    w("")
    w(f"- **Total projects:** {len(projects)}")
    w(f"- **DPRI rows:** {sum(1 for p in projects if p['source']=='dpri')}")
    w(f"- **MLR rows:** {sum(1 for p in projects if p['source']=='mlr')}")
    w("")
    w("## By umbrella")
    for u in ["DPRI", "12th MLR", "3/12", "Other"]:
        w(f"- **{u}**: {umbrellas[u]}")
    w("")
    w("## By sub-program")
    for pid, _ in sorted(programs_c.items(), key=lambda kv: (-kv[1], kv[0])):
        w(f"- `{pid}`: {programs_c[pid]}")
    w("")
    w("## Integrity")
    w(f"- `unknownInstallation=true`: **{unknown_count}** rows (expected 28 from SACO Program installation collision).")
    w(f"- FOC tier suffix stripped: **{tier_stripped}** rows (source counter was T1=15 + T2=6 + T3=10 + T4=6 + T5=4 + T6=4 = 45).")
    w(f"- DPRI rows with derived `activationFY` (from `dates.aFinish`): **{dpri_bod_set}** of 412.")
    w("")
    w("## Samples")
    w("### DPRI sample")
    w("```json")
    w(json.dumps(sample_dpri, indent=2, ensure_ascii=False))
    w("```")
    if sample_mlr_12:
        w("### MLR 12-mlr sample")
        w("```json")
        w(json.dumps(sample_mlr_12, indent=2, ensure_ascii=False))
        w("```")
    if sample_mlr_312:
        w("### MLR 3-12 sample")
        w("```json")
        w(json.dumps(sample_mlr_312, indent=2, ensure_ascii=False))
        w("```")
    if sample_mlr_other:
        w("### MLR Other-umbrella sample")
        w("```json")
        w(json.dumps(sample_mlr_other, indent=2, ensure_ascii=False))
        w("```")

    OUT_REPORT.write_text("\n".join(report_lines))
    print(f"Wrote {OUT_PROJECTS} ({len(projects)} rows)")
    print(f"Wrote {OUT_INSTALLATIONS} ({len(installations)} rows)")
    print(f"Wrote {OUT_PROGRAMS} ({len(PROGRAMS)} rows)")
    print(f"Wrote {OUT_REPORT}")
    print()
    print(f"Umbrella breakdown: {dict(umbrellas)}")
    print(f"Program breakdown: {dict(programs_c)}")
    print(f"Unknown installation: {unknown_count}  "
          f"Tier stripped: {tier_stripped}  "
          f"DPRI BOD set: {dpri_bod_set}/412")


if __name__ == "__main__":
    main()
