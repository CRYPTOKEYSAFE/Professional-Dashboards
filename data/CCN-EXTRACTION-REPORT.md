# NAVFAC CCN Catalog — Extraction Report

**Source:** `fc_2_000_05n_appendixa.pdf` (196 pages, 318 KB)
**Output:** `data/ccn-catalog.json` (1059 entries)
**Processing:** Local only (pdfplumber). No data sent to any external service. FOUO preserved.

## 1. Total CCN count
**1059** CCN entries extracted.

## 2. Category breakdown

| Series | Category | Count |
|--------|----------|-------|
| 100 | Operational and Training Facilities | 336 |
| 200 | Maintenance and Production Facilities | 227 |
| 300 | Research, Development, Test and Evaluation Facilities | 74 |
| 400 | Supply Facilities | 55 |
| 500 | Hospital and Medical Facilities | 20 |
| 600 | Administrative Facilities | 16 |
| 700 | Housing, Community, and Personnel Support Facilities | 154 |
| 800 | Utilities and Ground Improvements | 151 |
| 900 | Real Estate | 26 |
| **Total** | | **1059** |

## 3. Parse issues

`parseIssues: []` — no rows failed to parse. Every page's visual structure was recoverable using column x-coordinate bucketing.

### Known residual artifacts (low-severity)

- **OCR apostrophes** — the source PDF rendered curly apostrophes as `¿` in 17 descriptions and some titles (e.g. "VISITOR¿S RECEPTION CENTER"). All occurrences were replaced with straight apostrophes `'` during post-processing.
- **`planningFactor`** — FC 2-000-05N Appendix A's table does **not** have a planning-factor column. Planning factors live in the per-category narrative sections of the parent FC (not in Appendix A), so every entry's `planningFactor` is `null`. This matches the source, it is not a parse miss.
- **UM interpretation** — Appendix A provides two UM columns: `UNITS OF MEASURE AREA` (bracketed, e.g. `[SF]`, `[EA]`) and `UNITS OF MEASURE OTHER/ALT` (unbracketed qualifier + unit, e.g. `OL GM` = outlets + gallons-per-minute). The extractor records both in `umArea` and `umAlt` and chooses a canonical `um` (area takes precedence; otherwise the unit portion of the alt column).
- **Page 196 (UM legend)** intentionally skipped — it is a reference table, not CCN data.

## 4. Confidence assessment

**Rating: HIGH.**

Reasoning:
- 0 bad/non-5-digit codes.
- 0 duplicate codes across 1059 entries.
- 0 entries missing a title or a UM.
- 0 titles >60 chars (i.e. no evidence of cross-entry text bleeding).
- 0 orphan continuation lines.
- UM distribution aligns with the legend on page 196: SF (583), EA (138), AC (109), SY (74), LF (43), GA (23), BL (17), GM (13), KG (12), etc.
- Category counts sum exactly to 1059 and cluster reasonably (100-series is the largest at 336; 600-series smallest at 16, matching the fact that admin CCNs are a narrow group).
- All 1059 codes start with a digit 1-9 and all fall in their expected subcategory bucket.

The primary residual risk is **subCategory blurb capture**: the parser concatenates multi-line narrative blurbs that appear directly under 3-digit sub-group headings (e.g. "111 RUNWAYS"). Those blurbs contain useful context but are unstructured and may include trailing text that belongs to a later sub-group if the PDF's layout is irregular. Spot checks of 15+ entries across all 9 top-level series show correct assignment, but this field should be treated as a descriptive convenience, not authoritative metadata.

## 5. Sample entries (shape check)

```json
[
  {
    "code": "11110",
    "codeNormalized": "11110",
    "title": "RUNWAY / FW",
    "um": "SY",
    "umArea": "SY",
    "umAlt": "LF",
    "facCode": "1111",
    "rpaType": "LS",
    "reportingIndicator": "Y",
    "category": "100 — Operational and Training Facilities",
    "subCategory": "111 RUNWAYS Series 111 Category Codes include criteria for runways for fixed wing aircraft and runways or landing pads for rotary wing aircraft. Runways are prepared surfaces for the landing and takeoff of both fixed wing and rotary wing aircraft. Landing pads are prepared surfaces for the Vertical Takeoff and Landing (VTOL) of rotary wing aircraft (including V-22).",
    "planningFactor": null,
    "notes": "PREPARED SURFACES FOR THE LANDING AND TAKEOFF OF AIRCRAFT.",
    "description": "PREPARED SURFACES FOR THE LANDING AND TAKEOFF OF AIRCRAFT.",
    "sourcePage": 1
  },
  {
    "code": "21877",
    "codeNormalized": "21877",
    "title": "REPAIR SHOP STORAGE",
    "um": "SF",
    "umArea": "SF",
    "umAlt": null,
    "facCode": "2182",
    "rpaType": "B",
    "reportingIndicator": "Y",
    "category": "200 — Maintenance and Production Facilities",
    "subCategory": "218 MAINT - MISC MATL & EQUIPT Facilities for maintaining/repairing equipments/material not coded in the 211 through 217 and the 219 series.",
    "planningFactor": null,
    "notes": "REPAIR SHOP STORAGE FACILITY.",
    "description": "REPAIR SHOP STORAGE FACILITY.",
    "sourcePage": 102
  },
  {
    "code": "42132",
    "codeNormalized": "42132",
    "title": "INERT STOREHOUSE",
    "um": "SF",
    "umArea": "SF",
    "umAlt": "CF",
    "facCode": "4211",
    "rpaType": "B",
    "reportingIndicator": "Y",
    "category": "400 — Supply Facilities",
    "subCategory": "421 AMMUNITION STRG DEP/INSTLN Above/underground ammunition and ammunition component magazines and storehouses (including their explosion barriers.)",
    "planningFactor": null,
    "notes": "THESE STOREHOUSES ARE USED FOR THE STORAGE OF SUCH NON-EXPLOSIVE ITEMS AS BOMB TAILS, MACHINE GUN LINKS, EMPTY CARTRIDGE CASES, AND PACKING MATERIALS.",
    "description": "THESE STOREHOUSES ARE USED FOR THE STORAGE OF SUCH NON-EXPLOSIVE ITEMS AS BOMB TAILS, MACHINE GUN LINKS, EMPTY CARTRIDGE CASES, AND PACKING MATERIALS.",
    "sourcePage": 127
  },
  {
    "code": "72114",
    "codeNormalized": "72114",
    "title": "STUDENT BARRACKS",
    "um": "SF",
    "umArea": "SF",
    "umAlt": "PN",
    "facCode": "7213",
    "rpaType": "B",
    "reportingIndicator": "Y",
    "category": "700 — Housing, Community, and Personnel Support Facilities",
    "subCategory": "721 UNACOMP PERS HOUS-ENL PERS Unaccompanied Enlisted Quarters refers to apartment style, hotel style, dormitory style living quarters and the open bay barracks for recruits. If messing facilities are attached, use category code numbers 721-11 through 721-40 for the quarters portion as appropriate and category code number 721-45 for the mess hall portion. For detached mess halls, use category group 722.",
    "planningFactor": null,
    "notes": "UNACCOMPANIED QUARTERS FOR 'A' SCHOOL STUDENTS.",
    "description": "UNACCOMPANIED QUARTERS FOR 'A' SCHOOL STUDENTS.",
    "sourcePage": 141
  },
  {
    "code": "91215",
    "codeNormalized": "91215",
    "title": "LAND - SET ASIDE- HAWAII",
    "um": "AC",
    "umArea": "AC",
    "umAlt": null,
    "facCode": "9111",
    "rpaType": "L",
    "reportingIndicator": "N",
    "category": "900 — Real Estate",
    "subCategory": "912 LAND-PUB DOMAIN WITHDRAWAL The Navy Department may acquire land by withdrawal from public domain under jurisdiction of the Department of the Interior. Withdrawals of less than 5,000 acres are made by Public Land Order. Withdrawal of more than 5,000 acres for any one project must be approved by Act of Congress. In addition to securing authorization from the Armed Services Committees of Congress, a bill must be introduced in the Committees on Public Land and Insular Affairs for acquisition of public domain lands in excess of 5,000 acres.",
    "planningFactor": null,
    "notes": "FEDERAL GOVERNMENT LAND RESERVED THROUGH LAND TRUST IN STATE OF HAWAII",
    "description": "FEDERAL GOVERNMENT LAND RESERVED THROUGH LAND TRUST IN STATE OF HAWAII",
    "sourcePage": 191
  }
]
```

## Field reference

| Field | Type | Notes |
|-------|------|-------|
| `code` | string | 5-digit CCN, e.g. `"11110"`. Appendix A uses only the unspaced form. |
| `codeNormalized` | string | Same as `code` (provided for API symmetry with future sources that use spaced form like `"171 10"`). |
| `title` | string | Preserves original capitalization/punctuation (all-caps with abbreviations, e.g. `"AIRFIELD PAVEMENT / SHOULDER"`). |
| `um` | string | Canonical 2-letter unit-of-measure code (see page-196 legend). |
| `umArea` | string/null | Raw value from the `UNITS OF MEASURE AREA` column, bracket-stripped. |
| `umAlt` | string/null | Raw value from the `UNITS OF MEASURE OTHER/ALT` column. May be a qualifier + unit pair (e.g. `"OL GM"`). |
| `facCode` | string/null | 4-digit FAC (Facility Analysis Category) code. |
| `rpaType` | string/null | RPA (Real Property Asset) type: `B` = building, `S` = structure, `LS` = linear structure, `L` = land. |
| `reportingIndicator` | `"Y"` / `"N"` / null | Requirements reporting indicator column. |
| `category` | string | Top-level NAVFAC series (derived from leading digit of `code`). |
| `subCategory` | string | 3-digit group heading + any narrative blurb directly under it. |
| `planningFactor` | null | Not in Appendix A source; retained for future enrichment. |
| `notes` | string | Mirrors `description` for the deliverable spec. |
| `description` | string | CCN definition as printed in the `DESCRIPTION` column. |
| `sourcePage` | int | Originating PDF page (1-indexed). |