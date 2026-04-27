# APEX OMEGA — 4th Marines Dashboard Project Handoff

You are picking up an in-flight dashboard project. The user has limited patience for redundant questions; **read this entire briefing before responding**.

## 1 — CONTEXT

**Project:** A single-file HTML dashboard for the **4th Marine Regiment / CLB-4 Master Relocation Plan** (Camp Schwab consolidation, FY26–FY28, FRF vacation deadline 1 June 2028). This is real military facility-planning work (MCIPAC G-F / PPE).

**User profile:**
- Direct, military / DoD background. Speaks in voice-to-text — messages have artifacts ("third grade" = "3d", "fourth grade" = "4th MAR", etc).
- Limited bandwidth — wants **surgical edits**, not rewrites.
- Hates: timeouts, dead clicks, dark-on-dark text, icons in chrome, "APEX OMEGA" appearing anywhere in visible UI, made-up data, redundant questions.
- Loves: every field editable, polished visual, COA Comparison briefing artifacts, brevity.

## 2 — WHERE THINGS LIVE

| Asset | Location |
|---|---|
| Repo | `cryptokeysafe/professional-dashboards` |
| Branch | `claude/apex-omega-dashboard-upgrade-GT3fa` (push only here) |
| File | `/home/user/Professional-Dashboards/4th_MAR_CLB4_Relocation_APEX_v6_EDIT.html` |
| Size | ~6400 lines / ~320 KB single self-contained HTML |
| Live URL | `https://github.com/CRYPTOKEYSAFE/Professional-Dashboards/blob/claude/apex-omega-dashboard-upgrade-GT3fa/4th_MAR_CLB4_Relocation_APEX_v6_EDIT.html` |
| Skill | `/root/.claude/skills/apex-omega/SKILL.md` (445 lines, 20 sections — invoke via `/apex-omega` or any APEX OMEGA mention) |
| Latest commit | `66ff18d` — Reset: bring t-clb-sup back home + clear its dynamic fy-tag |

## 3 — WHAT EXISTS RIGHT NOW

**Architecture:** Single-page app, fixed sidebar (240 px / collapsible), 10 tabs. Self-contained HTML. No external deps.

**Tabs (1–9 keyboard shortcut + Compare via sidebar/palette):**

1. Overview (mission summary, FRF countdown, total-cost card, mini-charts)
2. Interactive Map (animated execution demonstration, dual-COA aware)
3. Phase Grid (5-column FY26→Post-FRF cards)
4. Unit Roster (sortable table, drawer drill-down, COA-aware)
5. Building Schedule (sortable table, COA-aware)
6. Projects & Cost (10 rows + 2 COA-2-only, editable cells, live total per COA)
7. Timeline (Building Lifecycle Swim-Lane — 13 rows × 5 phases)
8. Charts (4 SVG: moves/phase, types donut, zone bars, FRF countdown)
9. Data Editor (full CRUD)
- COA Comparison (side-by-side cards with per-section view toggle)
- Help

**Overlays (z-index stack documented in CSS):** detail drawer (slide right), command palette (Ctrl+K), edit panel, modal, confirmation, toast stack.

**Edit paths (all wired, all editable):**

- Detail Drawer Edit button → inline form with EVERY field including COA 2 alt fields (`altEndBldg`, `altPhase`, `altDate`, `altStatus`, `altNote`, `altUnresolved`, `coa2Note`, `altOccupants`)
- Data Editor tab — full CRUD inline tables for UNITS + BUILDINGS
- Projects tab — every cell free-text including the COA scope select (`coa: 'both' | 'coa1' | 'coa2'`)
- Map Edit Mode (E key) — every `[data-editable]` text, tile drag, building reposition

## 4 — DATA MODEL

```js
const UNITS = [
  // 15 entries. Sparse alt* fields override when COA 2 is active.
  { id:'t-saf', name:'Safety/Fire/Env', type:'div', startBldg:'3413', endBldg:'3335',
    phase:1, date:'Q3 FY26', status:'Permanent Move', note:'...' },
  { id:'t-clb-sup', name:'CLB-4 Supply', type:'mlg', startBldg:'3237', endBldg:'3237',
    phase:0, date:'Resident', status:'Resident', note:'...',
    altEndBldg:'3213', altPhase:2, altDate:'Q2 FY27', altStatus:'Permanent Move',
    altNote:'COA 2: moves to SCH-3213 (DOD/EOD WHSE space, CCN 21730; 2,045 sq ft).' },
  { id:'t-4th-sup', name:'4th MAR Supply', type:'div', startBldg:'3237', endBldg:'3237',
    phase:0, date:'Resident', status:'Resident', note:'...',
    altEndBldg:'3237', altStatus:'Resident', altUnresolved:true,
    altNote:'COA 2: stays at 3237. UNRESOLVED — no swing space plan during 2-yr SCH-3235 DPRI renovation.' },
  { id:'t-reg', name:'4th MAR Regimental HQ', type:'reg', startBldg:'3509', endBldg:'3314',
    phase:4, date:'Q3 FY28', status:'FRF Action', note:'...',
    altEndBldg:'1024', altPhase:4, altDate:'Q3 FY28', altStatus:'FRF Action',
    altNote:'COA 2: 3314 not ready in time. Lands at SCH-1024 2nd floor (admin conversion above the Armory).' },
  // ...others
];

const BUILDINGS = [
  // 13 entries. Bldgs 3413, 3213, 1024, 3410, 3237, 3235, 3314 carry coa2Note.
  // 3213, 1024, 3237, 3314 also carry altOccupants[].
];

const PROJECTS = [
  // 12 entries (10 from slide + 2 COA-2 add-scope items: SCH-1024 2nd-floor admin, SCH-3235 HVAC).
  // coa: 'both' | 'coa1' | 'coa2'   altCost: number | null (falls back to cost)
  // Top 5 have real PAX IDs + FIWEB IDs from user's portfolio summary slide:
  //   1024 PAX 387356 BU26PPE70M $10,413,140.40
  //   3314 PAX 387433 BU26PPE71M  $1,949,382.00
  //   3213 PAX 387624 BU26PPE72M  $5,428,425.00
  //   3237 PAX 387622 BU26PPE73M  $1,486,818.00 (coa: 'coa1' — removed in COA 2)
  //   3270 PAX 387568 BU26PPE74R  $3,527,753.00
  // COA 1 total: $23,565,518.40   COA 2 total: depends on user's TBD inputs
];
```

**localStorage keys:** `4thMAR_data_v1` (units+buildings), `4thMAR_projects_v3` (projects), `4thMAR_active_coa` (coa1|coa2), `4thMAR_edits_v1` (edit-mode overrides), `apex_theme`, `apex_sidebar`.

## 5 — COA 1 vs COA 2 (memorize)

**COA 1 (Primary):** Current scope. Total $23,565,518.40. SCH-3237 re-partitioned to consolidate 4th MAR Regt + CLB-4 + UDP-W Supply. 4th MAR Regt HQ lands at SCH-3314 2nd Deck.

**COA 2 (Alternate):** Per "PROPOSAL: Amend Scope of 4th Marines Project" slide.
- **REMOVE** SCH-3237 from scope (CLB-4 Supply re-routes elsewhere → no re-partition needed)
- **ADD** SCH-1024 2nd-floor barracks → admin (8x Co HQ spaces, lose 16x barracks). TBD cost.
- **ADD** SCH-3235 HVAC upgrade. TBD cost.
- **CLB-4 Supply** moves to SCH-3213 (DOD/EOD WHSE, CCN 21730; 2,045 sq ft)
- **UDP-W Supply** still moves 3446 → 3237 (3446 still demolished)
- **4th MAR Regt HQ** lands at SCH-1024 2nd floor (because 3314 won't be done in time)
- **4th MAR Regt Supply** stays at 3237 BUT marked UNRESOLVED for the 2-yr SCH-3235 DPRI renovation window
- **3410 + 3413** stay as-is (DOW projects). 3413 = swing space for CLB-4 (HQ, A, B, GS Cos), 3410 = swing space for 4th MAR Regt (HQ, ACV, LAR Cos), both during future SCH-3235 DPRI work.

**Map COA 2 dispatch (in IIFE 2 phase engine):**
```js
var COA2_PHASE2 = { 't-clb-sup': { top: 410, left: 42 } };  // 3213
var COA2_PHASE4 = { 't-reg':     { top: 280, left: 344 } };  // 1024 2nd floor
function activeCoa() { return localStorage.getItem('4thMAR_active_coa') === 'coa2' ? 'coa2' : 'coa1'; }
```
`nextPhase()` Phase 2 + Phase 4 dispatch on `activeCoa()`. `setActiveCoa()` calls `window.__APEX_resetMapForCoa()` to snap the map to phase 0 in the new COA.

## 6 — KEY VOCABULARY (use these EXACTLY)

| Term | Meaning |
|---|---|
| **3d MARDIV** | echelon type label (NOT "Division") |
| **4th MAR Regt** | echelon type label (NOT "Regiment") |
| **4th Marine Regiment** | the unit's formal full name (OK in narrative title) |
| **PAX ID** | 6-digit project assignment number, e.g. 387356 |
| **FIWEB ID** | Fire Web project ID, format `BU26PPE##M/R` |
| **SCH-XXXX** | Camp Schwab building reference |
| **DB to FEAD** / **DOW to P&E** | Delivery method codes |
| **HN-funded FRF** | Host-Nation funded Force Realignment Facility (DEMO=`*`, renovation=`**`) |
| **DPRI** | Defense Posture Realignment Initiative |
| **GOJ** | Government of Japan |
| **3509** | current 4th MAR HQ — gets demolished Phase 4 |
| **3446** | UDP-W Supply current — gets demolished Phase 2, ALREADY positioned on FRF demo line |
| **3510** | Med/ATC — stays pending GOJ replacement clinic |
| **1024** | BEQ → Swing → Armory (1st floor) → 2nd floor admin in COA 2 |
| Q# FY## | fiscal-year quarter notation, never `FY27-Q3` |
| Cost format | `$XX,XXX,XXX.XX` (always 2 decimals via `toLocaleString`) |

## 7 — THINGS THAT BURNED ME (don't repeat)

1. **Stream timeout on Writes >2000 lines.** Always use small `Edit` operations, 100–300 lines max.
2. **CSS cascade conflict** — duplicate `.cal-*` rules made the calendar dark-on-dark. Always `grep -n` for the selector after editing CSS.
3. **`typeMap` defined in two scopes** — one updated, one didn't. Charts kept showing "Division". Single source of truth.
4. **Made up the armory position** — user had to correct me. ASK first when scope is ambiguous.
5. **Added "RES" tags to resident tiles** — user explicitly hated them. Residents need NO tag.
6. **APEX OMEGA leaked into title tag, sidebar subtitle, JSON exports** — user wants ZERO visible references.
7. **`4M` icon in sidebar** — user said no icons in chrome. Plain text only.
8. **Header gradient + dark accent text** — unreadable. Always use `#FFFFFF`/`#FFE082`/`#B3E5FC` for accents on navy, with `!important` if needed.
9. **map-stage-wrap with overflow-x:auto + min-width** — caused layout thrash → flashing during animations + visual map duplication. **Don't wrap the map-stage**. Use fixed `width: 100%; height: 700px; overflow: hidden` and live with FRF clip on narrow viewports (user can press `K` to collapse sidebar).
10. **Forgot t-clb-sup in `resetMap()` mover list** after adding it as a COA 2 mover. Reset left it orphaned, next EXECUTE flashed. **When you add a new mover, add it to BOTH `nextPhase()` AND `resetMap()`.**

## 8 — WORKING STYLE

- **Small chunks. Commit after each.** If next edit fails, you haven't lost prior work.
- **Verify after every edit:** `node -e "..."` for `<script>` syntax, Python `HTMLParser` for tag balance, `grep` for orphans, `grep` for acronym drift.
- **Don't make stuff up.** Ask before guessing positions, costs, names.
- **Show GitHub `/blob/` URL, not `/raw/`.** Better navigation.
- **Status updates between edits** — one short sentence ("done; next: X"). Don't narrate thinking.
- **End-of-turn:** 1–2 sentences. What changed, what's next.
- **Don't push to main, ever.** Branch is `claude/apex-omega-dashboard-upgrade-GT3fa`.

## 9 — KNOWN OPEN ITEMS

- **Mobile responsive pass** — dashboard is desktop-only (1600 px ideal). User may want a tablet/phone layout.
- **Map COA 2 alt coordinates** — `COA2_PHASE2` / `COA2_PHASE4` are JS hardcoded. To make COA 2 tile positions editable via map Edit Mode, would need to expose those overlays through the tile edit panel.
- **FRF zone clipping on narrow viewports** — reverted the wrap that caused flashing. Map clips on viewports < ~1500 px. Workaround: collapse sidebar with `K`. Permanent fix would be a "fit to width" zoom toggle.
- **1024 label after COA 2 Phase 4** — currently shows "CONSOL ARMORY" (Phase 3 change). Could update to "ARMORY + 4TH MAR REGT" when COA 2 Phase 4 fires.
- **3270 motor pool tiles** — `t-4th-mtr` and `t-clb-mtr` are stacked tightly inside 3270 (90 px tall building, two 28 px tiles). One tile may hang slightly out the bottom. User accepted this.

## 10 — INVOKE THE SKILL

Type `/apex-omega` or mention APEX OMEGA in your reply to load the full architecture, anti-pattern, COA, and editable-everywhere reference.

The skill at `/root/.claude/skills/apex-omega/SKILL.md` is the source of truth for all patterns. **Update it whenever you discover a new gotcha** so future sessions inherit the lesson.

---

**First action in the new session:**

1. Run `git status` to confirm branch + clean working tree
2. Run `git log --oneline -10` to see recent commits
3. Open the file, verify it parses (`node -e` script-syntax check + `HTMLParser` balance check)
4. Ask the user what they want to work on — DON'T guess

The user's last verified-working state: commit `66ff18d` — Reset and EXECUTE both functional after fixing t-clb-sup orphan bug.
