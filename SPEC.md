# Dashboard Build Spec — DPRI / 12th MLR / 3/12 Facility Planning

This is the single source of truth for the build. Every agent working on this project reads this file first. If reality diverges from the spec, update the spec — do not silently drift.

## 1. What we are building

A **single, self-contained HTML file** (`dashboard.html`) that a NAVFAC MCIPAC G-F / PPE planner can double-click to open, use, edit, and re-share. No backend, no runtime CDN calls, no build-step for the *consumer*. Maintainers rebuild it with `build.sh` which inlines vendored libs, source modules, and data into the shippable file.

Two data dimensions, three program buckets, one CCN catalog that ties them together over time.

## 2. Handling

- **FOUO.** Every view carries a red/brown FOUO banner at top AND bottom.
- Every export (JSON, CSV, print) also carries "FOR OFFICIAL USE ONLY" in its header.
- No external network calls when `dashboard.html` is opened. Verify with DevTools Network tab (must be empty).
- No Google Fonts, no analytics, no remote images. Icons inline as SVG (Lucide) or emoji fallback.

## 3. Data model (canonical schema)

After normalization, the data lives in three JSON files under `data/`:

### 3.1 `data/projects.json`
Tagged-union with required common fields and source-specific sub-objects.

```ts
type Project = {
  id: string;                       // preserved from source
  source: "dpri" | "mlr";           // which dataset this came from
  program: Program;                 // see §3.4
  title: string;                    // renamed from name|title
  installation: Installation;       // canonicalized per §3.5 (title-case full name)
  unknownInstallation?: boolean;    // true for the 28 SACO rows where install is TBD
  bldg: string | null;              // parsed from title when absent (DPRI) or from field (MLR)
  projectType?: "NEW"|"REPLACEMENT"|"DEMO"|"CONSOLIDATION"|"CONVERSION"|"RELOCATION"; // DPRI only today
  phase?: number;                   // DPRI lifecycle phase 0-5 — kept as requested
  fundingSource?: "FSRM"|"MILCON"|"Mod-Camp"|string; // MLR or future DPRI
  status?: string;                  // "In Planning" | "Complete" | "Not Started" | derived
  priority?: string;                // MLR only; may be dead field
  totalCost?: number;               // USD, MLR only today
  fyPlan?: Record<string, number>;  // { "FY25": 0, "FY26": 7544000, ... }
  dates?: {                         // DPRI only today (10 ISO-date fields)
    fStart?: string|null; fFinish?: string|null;
    bStart?: string|null; bFinish?: string|null;
    dStart?: string|null; dFinish?: string|null;
    cStart?: string|null; cFinish?: string|null;
    aStart?: string|null; aFinish?: string|null;   // a_finish = BOD
  };
  bodFY?: number|null;              // derived: year(dates.aFinish) when source=dpri; null otherwise
  bodFYOverride?: number|null;      // user-editable override; takes precedence over bodFY in heatmap
  foc?: string;                     // MLR only; tier suffix STRIPPED per §3.6
  focTierRaw?: string;              // kept internally (original foc) for audit; never displayed
  replaces?: string|null;           // DPRI
  linked?: string[];                // DPRI
  locked?: boolean;                 // MLR
  notes?: string;                   // carried through; for MLR, program was derived from this field (§3.4)
  ccns?: ProjectCCN[];              // §3.3
};

type ProjectCCN = {
  ccn: string;             // must exist in ccn-catalog.json
  qty: number;             // in the CCN's UM (SF, EA, LF, …)
  scheduledFY: number;     // the FY this CCN lands; default = bodFY of parent project
  note?: string;
};
```

### 3.2 `data/ccn-catalog.json`
Already produced in Wave 1 — 1,059 entries. Do not modify shape. Key fields: `code`, `codeNormalized`, `title`, `um`, `umArea`, `umAlt`, `facCode`, `category`, `subCategory`, `description`, `sourcePage`.

### 3.3 `data/installations.json`
```ts
type Installation = {
  id: string;                  // kebab-case, e.g. "camp-hansen"
  name: string;                // "Camp Hansen"
  service: "USMC"|"USN"|"USAF"|"Joint";
  country: "JPN"|"GUM"|"USA"|"AUS";
  color?: string;              // hex, for badges/heatmap
};
```

Seed with the installations found in source data: Camp Schwab, Camp Hansen, Camp Foster, Camp Courtney, plus an **Unknown** entry for the 28 SACO-orphan projects and for any future data gaps.

### 3.4 `data/programs.json` (enum + metadata)
```ts
type Program = {
  id: string;                  // "dpri-frf" | "dpri-okicon" | "dpri-saco" | "12-mlr" | "3-12" | "3d-mardiv" | "mcipac" | "maw" | "iii-mef" | "other"
  umbrella: "DPRI" | "12th MLR" | "3/12" | "Other";   // primary taxonomy the user cares about
  label: string;               // display label
  color: string;               // hex
  description?: string;
};
```

**Program derivation rules during normalization:**

- Every DPRI row (source="dpri"): umbrella="DPRI". Sub-program from the DPRI `program` field:
  - `"FRF"` → id=`dpri-frf`
  - `"OKICON"` → id=`dpri-okicon`
  - `"SACO"` → id=`dpri-saco`
- Every MLR row (source="mlr"): umbrella and sub-program inferred from the `notes` field:
  - notes contains `"12th MLR (3/12)"` OR `foc` contains `"3/12"` → umbrella="3/12", id=`3-12`
  - notes starts with `"12th MLR"` (and not 3/12) → umbrella="12th MLR", id=`12-mlr`
  - notes contains `"3rdMarDiv"` or `"3rd MarDiv"` → umbrella="Other", id=`3d-mardiv`
  - notes contains `"MCIPAC"` → umbrella="Other", id=`mcipac`
  - notes contains `"MAW"` → umbrella="Other", id=`maw`
  - notes contains `"IIIMEF"` or `"III MEF"` → umbrella="Other", id=`iii-mef`
  - otherwise → umbrella="Other", id=`other`

**Umbrella chips** (DPRI / 12th MLR / 3/12 / Other) are the primary program filter at the top of the UI. Sub-program chips appear as secondary refinements within each umbrella.

### 3.5 Installation canonicalization

Source variation → canonical:
- `"HANSEN"` / `"Camp Hansen"` → `"Camp Hansen"` (id `camp-hansen`)
- `"FOSTER"` / `"Camp Foster"` → `"Camp Foster"` (id `camp-foster`)
- `"SCHWAB"` / `"Camp Schwab"` → `"Camp Schwab"` (id `camp-schwab`)
- `"COURTNEY"` / `"Camp Courtney"` → `"Camp Courtney"` (id `camp-courtney`)
- `"SACO Program"` → installation=`"Unknown"` (id `unknown`), set `unknownInstallation=true`, preserve original in `notes` as "Original installation field: SACO Program".

### 3.6 Tier-suffix stripping

For any MLR row whose `foc` matches `/\s*\(T\d+\)\s*$/`:
- Canonical `foc` = stripped value (e.g. `"FOC #1"`)
- `focTierRaw` = original full value (e.g. `"FOC #1 (T1)"`) — kept for audit, never rendered in UI

### 3.7 `bodFY` derivation

For DPRI rows: `bodFY = year(dates.aFinish)` if `aFinish` non-null, else `null`. Heatmap uses `bodFYOverride ?? bodFY`.

For MLR rows: `bodFY = null` today (no activation dates in source). The user can fill `bodFYOverride` per row. Heatmap falls back to a MLR project's earliest non-zero FY in `fyPlan` when both are null, but **visually dims** those cells to signal "estimated from budget, not programmed BOD."

## 4. UI layout

One-page app with a thin left sidebar for section nav. Top banner + bottom banner = FOUO. Header has title, program-umbrella filter chips, installation filter, global search, export button, "Download updated HTML" button, settings gear (for schema edits).

**Sections (sidebar nav):**

1. **Overview** — KPI cards (project count by umbrella, total cost, CCN sqft total, projects-with-BOD-set, projects-missing-CCNs). Timeline sparkline of BOD by year.
2. **Projects** — editable Tabulator grid with all canonical columns. Row expand → detail panel with full field list + CCN sub-grid. Add/edit/delete rows. Add/remove/rename columns. Column visibility toggle. Filters persist per session.
3. **CCN Catalog** — searchable/filterable table of all 1,059 CCNs. Users can edit or add rows (e.g., local sub-codes). Category pills color-coded by 100/200/300 series.
4. **CCN Assignment** — picker UI: select a project, add CCNs with qty and scheduledFY (defaults to project BOD). Validates CCN code against catalog. Bulk-paste helper for "I have a list of 20 CCNs for this project."
5. **Heatmap** — time-phased view. Axes: installations (columns) × CCN category (rows), with an Installation↔CCN toggle. Cell color = sqft landing in year Y (or cumulative-through-Y toggle). Year slider at bottom with play/pause and step controls. Click cell → drill-down list of contributing projects.
6. **Crosswalk** — two-column view: pick a project on the left; right panel shows all other projects on the same installation, grouped by program umbrella, so the planner can see adjacent work. No auto-merging.
7. **Schema / Admin** — add custom columns, rename fields, change units, add new programs/installations. Every schema change persisted to JSON export.

**Color system (derived from the existing DPRI HTML — preserve look-and-feel):**

```css
--primary: #1E3F5C;
--primary-lt: #2A5678;
--accent: #2E91AE;
--accent-lt: #48AAC5;
--bg: #F2F4F6;
--bg-card: #FFFFFF;
--bg-panel: #EDF0F4;
--text: #1B2535;
--text-muted: #546270;
--border: #CDD5DE;
--banner-red: #C8102E;   /* FOUO banner */
/* Program umbrella colors */
--prog-dpri: #1E3F5C;
--prog-12mlr: #2E91AE;
--prog-3-12: #7A5900;
--prog-other: #546270;
/* Project type colors (carry over from existing) */
--t-new: #1E3F5C; --t-demo: #8C2B0B; --t-replace: #7A5900;
--t-consol: #3A3A9E; --t-convert: #0B6E4F; --t-relocate: #5A0B8C;
/* Installation accents */
--i-schwab: #1E3F5C; --i-saco: #8C2B0B; --i-hansen: #0B6E4F;
--i-foster: #7A5900; --i-courtney: #3A3A9E; --i-unknown: #8A98A8;
```

Typography: `'Segoe UI', system-ui, sans-serif`, 13px base.

## 5. Module contracts (what each `src/modules/*.js` exports)

All modules are plain ES5/ES6 without a bundler. `src/app.js` wires them together.

### 5.1 `src/modules/dataStore.js`
```js
window.DataStore = {
  init(embedded)            // accept {projects, ccnCatalog, installations, programs}
  getAll()                  // returns full store snapshot
  getProjects(filter?)      // filter = {umbrella?, program?, installation?, search?}
  getProject(id)
  upsertProject(p)          // fires 'change' event
  deleteProject(id)
  getCCN(code)
  upsertCCN(c)
  getProgram(id); listPrograms()
  getInstallation(id); listInstallations()
  addSchemaColumn(col); removeSchemaColumn(key); listSchemaColumns()
  on(event, cb); off(event, cb)   // 'change' | 'schema-change'
  serialize()               // -> full JSON for export
  hydrate(json)             // -> replace store from JSON import
};
```
Must auto-save on every mutation to `localStorage` under key `dashboard.v1`.

### 5.2 `src/modules/persistence.js`
```js
window.Persistence = {
  saveLocal(); loadLocal()
  exportJSON()              // download
  importJSON(file)          // read + DataStore.hydrate
  exportCSV(section)        // section = 'projects' | 'ccns' | 'assignments'
  downloadUpdatedHTML()     // re-bakes current DataStore into a fresh HTML file
};
```

### 5.3 `src/modules/grid.js`
Tabulator wrapper for Projects. API: `renderProjectsGrid(container, filter)`, subscribes to DataStore 'change'.

### 5.4 `src/modules/ccn.js`
Renders CCN Catalog view AND the CCN Assignment panel per project. Exposes `renderCatalog(container)` and `renderAssignment(container, projectId)`.

### 5.5 `src/modules/heatmap.js`
D3-based. `renderHeatmap(container, {axis: 'install-x-ccn'|'ccn-x-install', mode: 'annual'|'cumulative'})`. Responds to year-slider events (CustomEvent `heatmap-year-change`).

### 5.6 `src/modules/shell.js`
Renders banners, header, sidebar, routes clicks to sections. Exposes `mount(rootEl)`.

## 6. Build pipeline (`build.sh`)

Single shell script, ~30 lines. Reads `src/dashboard.template.html` which contains these placeholders:

```
<!-- INJECT:style:src/styles.css -->
<!-- INJECT:vendor:vendor/tabulator.min.css -->
<!-- INJECT:vendor:vendor/tabulator.min.js -->
<!-- INJECT:vendor:vendor/d3.min.js -->
<!-- INJECT:vendor:vendor/papaparse.min.js -->
<!-- INJECT:module:src/modules/dataStore.js -->
<!-- INJECT:module:src/modules/persistence.js -->
<!-- INJECT:module:src/modules/grid.js -->
<!-- INJECT:module:src/modules/ccn.js -->
<!-- INJECT:module:src/modules/heatmap.js -->
<!-- INJECT:module:src/modules/shell.js -->
<!-- INJECT:module:src/app.js -->
<!-- INJECT:data:data/projects.json -->
<!-- INJECT:data:data/ccn-catalog.json -->
<!-- INJECT:data:data/installations.json -->
<!-- INJECT:data:data/programs.json -->
```

`build.sh` replaces each placeholder with the file's contents wrapped appropriately (`<style>` for css, `<script>` for js, `<script type="application/json" id="data-X">` for json). Outputs `dashboard.html`. Deterministic — same inputs produce byte-identical output.

## 7. Full editability — add AND delete, anywhere

This is a hard requirement. Any entity the dashboard shows, the user can create, edit, and remove:

- **Projects**: add, edit every field, delete. Duplicate row. Bulk-delete by filter selection.
- **CCN catalog entries**: add new CCN codes (for local/derived codes not in Appendix A), edit titles/UMs/categories, delete obsolete ones. Validate uniqueness of `codeNormalized`.
- **CCN assignments (project × CCN × qty × FY)**: add, edit, delete per project; bulk-paste import.
- **Installations**: add new installation (pop-up form: id, name, service, country, color). Edit existing. Delete — if projects still reference it, warn and offer bulk-reassign.
- **Programs**: add a new program-umbrella or sub-program (label, color, umbrella). Edit. Delete with the same reassign guard.
- **Schema columns on the Projects grid**: add a user-defined column (text, number, date, enum, bool, currency). Rename. Retype. Change unit of measure. Hide. Reorder. Delete.
- **Schema columns on the CCN Catalog grid**: same capabilities.
- **Custom fields on sub-entities** (e.g., CCN assignments): same.
- **Statuses, project types, funding sources, priorities**: the enum lists are themselves editable from the Schema/Admin section. Adding a new status makes it available immediately in dropdowns everywhere.

All additions and deletions must:
- Persist to `localStorage` immediately.
- Survive JSON export/import round-trips (the schema travels with the data — see §3.1 and §5.1).
- Travel in the "Download updated HTML" output so the next viewer sees the same edits.
- Trigger live re-aggregation everywhere (§8).

**Deletion confirmations**: show a confirm dialog when the delete will cascade (e.g., deleting an installation that has 91 projects). Never silently drop referenced data.

## 8. Live roll-ups — everything must add up and make sense

Every aggregate in the UI is computed live from the current `DataStore` state and re-renders on any 'change' event:

- **KPI cards** on Overview: total projects (per umbrella + grand total), total cost (sum of `totalCost` + sum of `fyPlan` values where cost not set), total CCN sqft (sum of `qty` × UM=SF assignments), count of projects with BOD set, count of projects missing CCN assignments.
- **Projects grid** footer: sums for currency columns, counts for categorical columns, weighted averages where meaningful.
- **Heatmap** cells: sum of `qty` of CCN assignments where `ccn.um == "SF"` AND `scheduledFY == year` AND installation matches cell. The "cumulative-through-year" mode sums all assignments with `scheduledFY <= year`.
- **Crosswalk** panel: count of related projects per program on the shared installation, with $ totals if `totalCost` is set.
- **Subtotals in drill-downs**: every drill-down modal shows subtotals at the bottom (count, sum of sqft, sum of cost where available).

Rollups must:
- Handle partial data gracefully — a project with no CCN assignments contributes 0 to sqft but is still counted in "projects missing CCNs."
- Show units in every cell (`12,450 SF`, `$7,544,000`, `60 projects`).
- Refresh within 300 ms of any data mutation.

## 9. Interactivity — the "over time" story

This dashboard exists to let a planner show a client "where does the laydown land, what space is available when." Interactive affordances:

- **Tooltips everywhere.** Every chip, badge, column header, KPI card, heatmap cell has a tooltip explaining what it represents and how it's computed. Field definitions come from the schema so they update when users rename.
- **Hover overs** on project rows reveal a mini-card: title, installation, program badge, BOD FY, top-3 CCN assignments by sqft, cost.
- **Drill-downs** on every aggregate: click a KPI → filtered list; click a heatmap cell → list of contributing projects + CCNs; click an installation chip → installation detail with all projects + CCN time series.
- **Year slider** (heatmap section) is the primary narrative tool: drag it / hit play to watch the CCN laydown fill in across FYs. Shows FY label + play/pause/step/loop controls. The slider also controls a "Projects delivered by FY X" side panel that updates as the user scrubs.
- **Installation-detail page** (accessible via drill-down): per-installation page shows cumulative CCN sqft by category over time (stacked area chart), a project list grouped by program umbrella with BOD FY, and a "what will be available in [FY]" mode that projects forward.
- **Export views**: every drill-down has a "Print/Export" action that produces a FOUO-banner'd snapshot suitable for a briefing slide.

## 10. Verification checklist (Wave 3)

- [ ] `dashboard.html` opens by double-click in Chrome/Edge, no console errors.
- [ ] DevTools Network tab is empty on load (no external calls).
- [ ] Banner visible top + bottom, exports carry the banner too.
- [ ] Project count = 412 DPRI + 60 MLR = 472 rows rendered (filterable by umbrella).
- [ ] Umbrella filter chips: DPRI, 12th MLR, 3/12, Other — each works.
- [ ] Sub-program filters: FRF, OKICON, SACO under DPRI; 3rdMarDiv, MCIPAC, MAW, IIIMEF under Other.
- [ ] Installation canonicalized (Camp Hansen not HANSEN); Unknown shows the 28 SACO orphans.
- [ ] Tier suffixes (T1..T6) never appear in the UI.
- [ ] Phase field (DPRI) is filterable.
- [ ] CCN catalog shows 1,059 entries, filterable by category and UM.
- [ ] Add a new column in Projects → appears in grid → persists in exported JSON.
- [ ] **Delete** a project, a CCN, an installation, a program — each works, triggers cascade warning when referenced.
- [ ] Add a new installation with custom color → appears in filters + heatmap.
- [ ] Add a new status value in Admin → appears in the status dropdown everywhere.
- [ ] Add a CCN assignment to a project → appears in heatmap that same render cycle.
- [ ] Heatmap year slider spans derived FY range; dragging scrubs cells smoothly.
- [ ] Every KPI card and grid total re-computes within 300 ms of a data mutation.
- [ ] Every interactive element (chip, cell, badge, KPI) has a tooltip explaining it.
- [ ] Row hover shows mini-card with top-3 CCN assignments by sqft.
- [ ] Drill-down on a heatmap cell lists contributing projects with subtotals.
- [ ] "Download updated HTML" produces a fresh file; open it offline, edits persisted.
- [ ] Import a JSON file → DataStore hydrates, grid rerenders.
- [ ] CSV export of projects/CCNs/assignments works and carries FOUO header.
