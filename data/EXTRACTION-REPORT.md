# Project Data Extraction Report

Generated: 2026-04-23
Handling: **FOUO** — local use only. No external posting; no WebSearch/WebFetch used during extraction.

## 1. Source files and counts

| Source HTML | Inline data block | Variable | Output JSON | Records |
|---|---|---|---|---|
| `DPRI_FRF_Master_Schedule_Dashboard.html` | line 450 - 1059 | `const PROJECTS = [ ... ];` (strict JSON) | `data/projects-dpri-raw.json` | **412** |
| `12th_MLR_LRFP_Dashboard.html` | line 409 - 470 | `var PROJECTS = [ ... ];` (JS literal, unquoted keys) | `data/projects-12mlr-raw.json` | **60** |

- DPRI parsed directly with `json.loads` after regex-extracting the array.
- 12MLR used unquoted keys and single-quoted strings, so it was `eval`-coerced in Node.js (`node -e`) and re-emitted as JSON.
- No values were altered during extraction; fields preserved verbatim.

**User expectation check:** DPRI was believed to be 400+. Actual is **412** — the "~250" seen in prior web builds is a downstream filtering bug, not a source-data problem. The raw array contains 412 objects.

## 2. Field inventories

### DPRI (18 fields, all 412 records share the same schema)
```
id, name, phase, program, installation,
f_start, f_finish, b_start, b_finish,
d_start, d_finish, c_start, c_finish,
a_start, a_finish,
type, replaces, linked
```
Meaning of prefixed date pairs: **f_** = funding/form, **b_** = budgeting, **d_** = design, **c_** = construction, **a_** = activation/award (inferred from context — confirm with program office).

### 12MLR (18 fields, all 60 records share the same schema)
```
id, foc, title, camp, bldg, fs, status, priority,
total, fy25, fy26, fy27, fy28, fy29, fy30, fy31,
locked, notes
```

### Overlap / divergence

| Field present in... | Fields |
|---|---|
| **Both** | `id` only |
| **DPRI only** | `name`, `phase`, `program`, `installation`, `f_start/f_finish`, `b_start/b_finish`, `d_start/d_finish`, `c_start/c_finish`, `a_start/a_finish`, `type`, `replaces`, `linked` |
| **12MLR only** | `foc`, `title`, `camp`, `bldg`, `fs`, `status`, `priority`, `total`, `fy25..fy31`, `locked`, `notes` |

The two files describe **different dimensions** of program data. DPRI is a schedule (phases + milestone dates + project typing). 12MLR is a budget plan (FY-phased dollars + status/locked flags + FOC categorization). Only `id` overlaps by name — and the id namespaces are disjoint (DPRI uses `MC0506-T-A`, `AF798S-1` style; 12MLR uses `F-001`, `H-012`).

## 3. Suggested unified schema

Canonical names in **bold**. Types are target TS/JSON types.

| Canonical field | Type | DPRI source | 12MLR source | Notes |
|---|---|---|---|---|
| **id** | string | `id` | `id` | Disjoint namespaces; keep `source` to disambiguate. |
| **source** | `"dpri"` \| `"12mlr"` | (derived) | (derived) | Required; added at normalization. |
| **title** | string | `name` | `title` | **Name conflict** — DPRI calls it `name`, 12MLR calls it `title`. Canonicalize to `title`. |
| **installation** | enum string | `installation` | `camp` (mapped) | **Name + value conflict.** DPRI uses `"Camp Hansen"` / `"Camp Foster"`, 12MLR uses `"HANSEN"` / `"FOSTER"`. Canonicalize to `"Camp Hansen"` form. |
| **program** | enum string | `program` (`FRF`/`OKICON`/`SACO`) | (derived = `"12MLR"`) | 12MLR has no program field. |
| **project_type** | enum string | `type` (NEW/REPLACEMENT/DEMO/CONSOLIDATION/CONVERSION/RELOCATION) | — | DPRI only. |
| **phase** | int 0-5 | `phase` | — | DPRI only; semantics need SME confirmation (appears to be lifecycle stage). |
| **foc** | string | — | `foc` | 12MLR only; "FOC #NN (TN)" tier tag. |
| **bldg** | string \| null | (parseable from `name`) | `bldg` | 12MLR has it explicit; DPRI embeds in `name` string. |
| **funding_source** | enum | — | `fs` (FSRM/MILCON/Mod-Camp) | 12MLR only. |
| **status** | enum | (derived from phase/dates) | `status` (In Planning/Complete/Not Started) | 12MLR explicit; DPRI inferable. |
| **priority** | enum | — | `priority` (currently all `"2-HIGH"`) | 12MLR only; effectively a no-op today. |
| **total_cost** | number (USD) | — | `total` | 12MLR only. |
| **fy_plan** | `{ [fyNN]: number }` | — | `fy25..fy31` | 12MLR only. Flatten into a map. |
| **dates** | object with 10 ISO-date fields | `{f,b,d,c,a}_{start,finish}` | — | DPRI only. |
| **replaces** | string \| null | `replaces` | — | DPRI only. |
| **linked** | string[] | `linked` | — | DPRI only. |
| **locked** | bool | — | `locked` | 12MLR only. |
| **notes** | string | — | `notes` | 12MLR only. |
| **ccn** | string \| null | — | — | **Neither file has CCN data today.** Placeholder for upcoming CCN catalog join. |

### Field-name conflicts to resolve

1. `name` (DPRI) vs `title` (12MLR) -> canonical **`title`**.
2. `installation` (DPRI, title-case) vs `camp` (12MLR, ALLCAPS short form) -> canonical **`installation`** with title-case full name (`"Camp Hansen"`). Mapping: `HANSEN -> Camp Hansen`, `FOSTER -> Camp Foster`.
3. `type` (DPRI) — generic name, collides with any future "type" concept. Rename canonical to **`project_type`**.
4. `fs` (12MLR) — abbreviation unclear to outsiders. Canonical **`funding_source`**.
5. `total` (12MLR) — rename to **`total_cost`** for clarity.

The schema will be **moderately messy to unify**: only `id` is shared, the two sources overlap on roughly 0% of field semantics beyond identifier + installation. A tagged-union (`source: "dpri" | "12mlr"`) with optional subobjects (`dates`, `fy_plan`) is probably cleaner than a flat union.

## 4. Cross-walk candidates (DPRI <-> 12MLR)

- **ID overlap: 0.** Namespaces are disjoint (MC####-T / AF###S-# vs F-### / H-###).
- **Title + installation fuzzy match: 0 confirmed pairs.** Tried matching by 12MLR `bldg` number (e.g., `2496`, `5603`) appearing inside DPRI `name` strings within the same installation. Zero hits.

The two datasets appear to be **complementary, not overlapping**:
- DPRI covers historical + programmed MILCON for the Marine Corps relocation (Schwab, Hansen, Foster, Courtney, SACO) — mostly building-complex / mission-suite projects.
- 12MLR covers FSRM + a few MILCON line items tied to specific existing buildings (2xxx series at Hansen, 56xx at Foster) for the new MLR stand-up — maintenance / conversion of existing structures.

**Recommendation:** Do not auto-merge. If a cross-walk is needed, it will come from the upcoming CCN catalog or from a human-curated link table keyed on (installation, building_number).

Up to 20 pairs requested — **none available** from deterministic matching.

## 5. Data quality issues

### DPRI
1. **Null date fields are common:** 11-31 records missing each of the 10 milestone dates. No nulls in `id`, `name`, `installation`, `program`, `phase`, `type`.
2. Dates are **strings in ISO `YYYY-MM-DD`** format (good — consistent), or `null`. No mixed numeric/string issues.
3. `installation` is clean and consistent across all 412 rows:
   - `Camp Schwab` (186), `Camp Hansen` (91), `Camp Foster` (78), `Camp Courtney` (29), `SACO Program` (28)
   - Note: **`SACO Program` is not an installation** — it's a program category that landed in the installation field. Will need to split to `program="SACO", installation=<actual site>` during normalization.
4. `phase` = 0 for 258 of 412 records (63%). Semantics unclear — likely "baseline/historical/complete," but worth confirming with the planner; if phase 0 means "not staged," the field is near-useless.
5. No duplicate ids.
6. `linked` is used on only 29 rows; `replaces` on 15. Most projects are unlinked.
7. `program` values (`FRF`, `OKICON`, `SACO`) are clean categoricals — no typos.
8. `type` values (`NEW`, `REPLACEMENT`, `DEMO`, `CONSOLIDATION`, `CONVERSION`, `RELOCATION`) are clean.

### 12MLR
1. **3 records have empty `bldg`** (`H-006` MADIS MILCON, `H-035` NMESIS Maint, `H-036` NMESIS Storage — all new-build MILCON, not keyed to an existing facility). Empty string, not null.
2. All `fy25..fy31` and `total` values are **integers** (consistent). Zero used as "no spend this year."
3. `camp` is ALLCAPS (`FOSTER`, `HANSEN`) and short-form — **inconsistent with DPRI's title-case `Camp Foster` / `Camp Hansen`.** Needs normalization.
4. `priority` is **`2-HIGH` on all 60 rows** — effectively a dead field in current data.
5. `fs` has three values: `FSRM` (51), `MILCON` (7), `Mod-Camp` (2). `Mod-Camp` is a non-standard funding source (probably local shorthand for the modular-campus initiative) — flag for SME review.
6. `status` is three-valued: `In Planning` (39), `Complete` (14), `Not Started` (7). Complete records all have `total=0` and `fy*=0` (data convention: zeroed after completion).
7. No duplicate ids.
8. `foc` has several formats: `FOC #N (TN)`, `12th MLR (3/12)`, free-form like `3/12 Mod Campus`, `NMESIS Maint`. Inconsistent but all human-readable — categorize during normalization.
9. `title` uses installation-abbreviation prefix (`FOS 5603 ...`, `HAN 2496 ...`) — redundant with `camp` field.

### Cross-file
1. **No shared identifier scheme** — id namespaces are disjoint (`MC####-T` vs `F-###`/`H-###`).
2. **Installation-name casing conflict** (`Camp Hansen` vs `HANSEN`) — pick one canonical form; recommend title-case `"Camp Hansen"`.
3. **Same concept, different field names:** `name` vs `title`, `installation` vs `camp`, `type` vs (none), `total` vs (none).
4. **No links between the two datasets.** A project that appears in both would need to be manually matched.

## 6. CCN codes / CCN-related fields

- **CCN fields in DPRI:** none.
- **CCN fields in 12MLR:** none.
- **CCN substring appearances in any string value:** 0 in DPRI, 0 in 12MLR.

Neither dataset has CCN data today. The CCN catalog cross-walk will be an additive layer.

## 7. Extraction method log

- DPRI: `re.search(r'const PROJECTS\s*=\s*(\[.*?\]);', html, re.DOTALL)` + `json.loads` — succeeded first try (it is strict JSON).
- 12MLR: same regex with `var PROJECTS`, then `node -e "var arr = <literal>; console.log(JSON.stringify(arr));"` to coerce unquoted-key JS to JSON.
- Round-trip verified against the existing `data/projects-*-raw.json` files — byte-equal after key sort.
- No values modified.
