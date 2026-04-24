/* instructions.js - in-dashboard help for every tab, KPI, button, chart, chip, and interaction.
 * Planner voice. No AI-ese. Written for a PPE planner opening the tool for the first time.
 */
window.Sections = window.Sections || {};

(function () {
  "use strict";

  const $ = (tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  };

  window.Sections.instructions = function (container) {
    container.innerHTML = "";
    const wrap = $("div", { class: "instructions-wrap" });

    const sections = [
      { h: "What this dashboard is",
        body: `
<p>A single HTML file covering facility programming for three program umbrellas that share the same Okinawa installation footprint: DPRI, 12th MLR, and 3/12. Opens by double click. No server. No runtime network calls. All libraries, icons, and data are embedded.</p>
<p>Data lives in three layers. <strong>Projects</strong> (412 DPRI plus 60 MLR and 3/12 rows) carry program, installation, milestones, and notes. The <strong>CCN Catalog</strong> is 1,059 five digit category codes from FC 2-000-05N Appendix A. <strong>CCN Assignments</strong> tie a project to one or more CCNs with a square footage and a scheduled fiscal year. Assignments are what light up the Heatmap.</p>
<p>Every edit saves to your browser automatically under the key <code>dashboard.v1</code>. When you click <strong>HTML</strong> in the header, the tool re-bakes a fresh self contained file with your edits embedded in it. That new file is what you share.</p>` },

      { h: "Who edits, who views",
        body: `
<p>Only PPE edits. The client is a viewer. The workflow is:</p>
<ol>
  <li>PPE opens the file, sets the <strong>Prepared By</strong> name once, and works through filters, projects, and CCNs.</li>
  <li>When a working session ends, click <strong>HTML</strong> in the header. That downloads <code>dashboard-prepared-by-NAME-YYYY-MM-DD.html</code> with all edits baked in.</li>
  <li>Share that copy. The client sees the same views but their local edits do not travel back to PPE unless they send the file or a JSON export.</li>
</ol>
<p>The <strong>Prepared By</strong> name is stamped on every export (JSON, CSV, print view, re-baked HTML) as part of the FOUO watermark. Change it in Admin at any time.</p>` },

      { h: "Daily workflow",
        body: `
<ol>
  <li>Open the HTML. On first run you are prompted for your name; it is saved to your browser.</li>
  <li>Use the <strong>installation tabs</strong> and the <strong>program umbrella tabs</strong> in the header to narrow the view. The whole dashboard responds: Overview counts, Projects list, Heatmap cells, Crosswalk, everything.</li>
  <li>Go to <strong>Projects</strong>. Toggle between <strong>Table</strong> (fast scan, bulk edit) and <strong>Cards</strong> (full detail, milestone boxes, inline CCN block). The choice is remembered per browser.</li>
  <li>On a project card, set milestone dates. DPRI uses Form 42, Budget and BCP, Design, Construction, and Activation. MLR and 3/12 use IOC and FOC. Tick the box when a milestone is achieved.</li>
  <li>In the <strong>CCN Assignments</strong> block on the card, click <strong>+ Add CCN</strong>. Type a five digit code. The catalog title fills in. Enter the square footage and the scheduled FY (it defaults to the project's activation FY).</li>
  <li>Open <strong>Heatmap</strong>. The year slider runs FY2010 through FY2055. Drag it, or press play, and the grid recomputes. Cells are sums of SF for CCNs that activate in or before that FY (Cumulative) or exactly that FY (Annual).</li>
  <li>When the session is done, click <strong>HTML</strong> in the header. Share that file.</li>
</ol>` },

      { h: "The header",
        body: `
<p>The header has three rows.</p>
<p><strong>Row 1 left:</strong> organization (MCIPAC G-F / PPE), title (DPRI / MCIPAC Integrated Facilities), subtitle spelling out the three programs, and an attribution line showing the current project count and CCN catalog count with the source reference (FC 2-000-05N Appendix A).</p>
<p><strong>Row 1 right:</strong> five clocks that tick once a second. JST (Tokyo), HST (Honolulu), EST (New York), PST (Los Angeles), ZULU (UTC). Hover for the IANA timezone.</p>
<p><strong>Row 2 left (installation tabs):</strong> one button per installation with a live project count. The leftmost tab is <strong>All</strong>. Clicking a tab filters the whole dashboard to that installation. Click again to unset. Counts reflect the current program and search filter.</p>
<p><strong>Row 2 middle (program umbrella tabs):</strong> DPRI, 12th MLR, 3/12, Other. Same click to toggle behavior. Clicking DPRI and Camp Hansen together narrows to DPRI projects on Camp Hansen.</p>
<p><strong>Row 2 right:</strong> the <strong>search box</strong> (project title, project ID, or building number) and the <strong>Prepared By</strong> chip. Click the chip to change your name.</p>
<p><strong>Row 3 (actions):</strong></p>
<ul>
  <li><strong>Undo</strong>. Reverts the last data change. Ring buffer of 20 states. Same as Ctrl+Z.</li>
  <li><strong>Redo</strong>. Ctrl+Shift+Z or Ctrl+Y.</li>
  <li><strong>JSON</strong>. Full data snapshot download. Re-importable.</li>
  <li><strong>HTML</strong>. Re-bakes a fresh self contained dashboard file carrying your current edits. This is the file you hand to the client.</li>
  <li><strong>Print</strong>. Opens the OS print dialog. Chrome is hidden in the print layout.</li>
  <li><strong>Brief</strong>. Switches to the client briefing layout. Esc exits.</li>
  <li><strong>Clear</strong>. Resets umbrella, installation, and search filters.</li>
</ul>` },

      { h: "Sidebar navigation",
        body: `
<p>Eight sections. Click an icon in the left rail or use the <code>g</code> leader keys (see Keyboard).</p>
<ul>
  <li><strong>Overview</strong>. KPI strip, phase distribution, installation donut, activation timeline, program by installation matrix, open items.</li>
  <li><strong>Projects</strong>. Full list. Toggle Table or Cards.</li>
  <li><strong>CCN Catalog</strong>. 1,059 five digit codes with titles, units of measure, and categories.</li>
  <li><strong>CCN Assignment</strong>. Pick a project on the left, edit its assignments on the right.</li>
  <li><strong>Heatmap</strong>. Time phased square footage grid with a year slider.</li>
  <li><strong>Crosswalk</strong>. Pick a project and see all other projects on the same installation grouped by program umbrella.</li>
  <li><strong>Admin</strong>. Installations, programs, column schema, viewer name.</li>
  <li><strong>Instructions</strong>. This page.</li>
</ul>` },

      { h: "Overview tab: KPIs",
        body: `
<p>The horizontal strip at the top of Overview has six KPI cards separated by thin dividers. Each card shows a headline number, a label, and a one line note. Click any clickable card to jump to the relevant tab.</p>
<ul>
  <li><strong>Total Projects</strong>. Count of projects under the current filter. The note breaks the count down by umbrella (DPRI / 12th MLR / 3/12 / Other). Click to open Projects.</li>
  <li><strong>Schedule Span</strong>. Years between the earliest and latest Activation Finish date across the filtered projects. Note gives the FY range, for example "FY2025 to FY2041".</li>
  <li><strong>Programmed Cost</strong>. Sum of <code>totalCost</code> plus summed <code>fyPlan</code> values where no total is set. Formatted short ($7M, $1.2B). Click to open Projects.</li>
  <li><strong>CCN Sq Ft</strong>. Sum of SF across all CCN assignments whose unit of measure is SF, inside the filter. Click to open the Heatmap.</li>
  <li><strong>Activation FY Entered</strong>. How many projects have either a DPRI Activation Finish date or an Activation FY override set. Shown as "X of Y" with a percent in the note. Click to open Projects.</li>
  <li><strong>No CCNs</strong>. Projects in the filter that have zero CCN assignments. Click to open the CCN Assignment tab.</li>
</ul>` },

      { h: "Overview tab: charts and matrix",
        body: `
<p>After the KPI strip the Overview stacks four blocks.</p>
<p><strong>Phase Distribution</strong>. Six vertical bars labeled P0 through P5. DPRI projects are tagged with a lifecycle phase. Hover a bar for the count.</p>
<p><strong>By Installation</strong>. A donut with one wedge per installation colored to match the installation palette. Click a wedge or a legend row to toggle that installation as a filter.</p>
<p><strong>Activation Finish by Fiscal Year</strong>. A bar chart, one bar per FY from the earliest to the latest Activation Finish in the filtered set. Each bar shows the count above it and a tooltip. Bars with zero activations are rendered as thin placeholders so the year gap is visible.</p>
<p><strong>Projects by Program and Installation</strong>. A matrix table with umbrellas as rows and installations as columns. Each cell is a count. Click any count to filter Projects to that umbrella and that installation. Click the umbrella cell in the leftmost column to filter to the whole umbrella. Click the row total to clear the installation filter.</p>
<p><strong>Open Items</strong>. Running list of what the data is missing today: projects without CCNs, projects without an Activation FY, and the SACO bucket of projects whose installation is still pending. Each entry links to the tab where you can fix it.</p>` },

      { h: "Projects tab: Table and Cards",
        body: `
<p>The Projects tab has a toolbar at the top and a main host below it. The toolbar shows a <strong>View</strong> segmented control (Table or Cards), primary actions, and a live count reading <code>N of M projects</code> based on the current filter. The view choice is remembered per browser.</p>
<p><strong>+ Add Project</strong> creates a blank row with a generated ID, tagged as MLR / other / SACO, and opens immediately for editing.</p>
<p><strong>Paste from spreadsheet</strong> opens a modal with a textarea. Paste TSV or CSV with a header row. The parser previews the columns and row count. Click Apply to upsert. Rows with an <code>id</code> that already exists update in place; rows without an id are created fresh.</p>
<p><strong>Columns</strong> opens the column settings dialog. Toggle visibility, rename a label, delete any column you added. Built in columns cannot be deleted but can be hidden.</p>
<p><strong>Table view</strong> is a Tabulator grid. Every cell is editable inline. Each header row has a text or list filter. The grid paginates at 100 by default (50, 100, 200, 500, 1000 are the options). Row actions live in the last column:</p>
<ul>
  <li>↗ opens the row detail modal with every field plus a CCN sub grid.</li>
  <li>⧉ duplicates the row with a new ID and a timestamped suffix.</li>
  <li>✕ deletes after a confirm. Recoverable with Undo.</li>
</ul>
<p>Rows whose installation is still SACO carry a muted row style so they stand out.</p>
<p><strong>Cards view</strong> renders one card per project. Each card has:</p>
<ul>
  <li>A header row of chips: program, installation, project type (DPRI only), and the project ID.</li>
  <li>The project title. Building number if parsed.</li>
  <li>An editable summary row: Program select, Installation select, Type (DPRI) or Funding Source (MLR), Phase (DPRI), and Activation FY (override).</li>
  <li>A milestone strip (Form 42, Budget and BCP, Design, Construction, Activation for DPRI; IOC and FOC for MLR and 3/12).</li>
  <li>An inline <strong>CCN Assignments</strong> block with totals by UM.</li>
  <li>A notes textarea (debounced save).</li>
  <li>Footer with Duplicate and Delete.</li>
</ul>` },

      { h: "Milestones",
        body: `
<p><strong>DPRI</strong> projects use the five stage model. Each box carries a Start date, a Finish date, and an "achieved" checkbox. Check the box when the milestone is done. Checking Activation is what the dashboard reads as "this project is alive by this date".</p>
<ul>
  <li><strong>Form 42</strong>. Funding programming document. Also called F42 in the source.</li>
  <li><strong>Budget and BCP</strong>. Budget Cycle Planning.</li>
  <li><strong>Design</strong>.</li>
  <li><strong>Construction</strong>.</li>
  <li><strong>Activation</strong>. Facility turnover, usable. This is the date that drives Activation FY for DPRI rows.</li>
</ul>
<p><strong>12th MLR and 3/12</strong> projects use the capability model. Each box carries a single target date and a checkbox.</p>
<ul>
  <li><strong>IOC</strong>. Initial Operating Capability.</li>
  <li><strong>FOC</strong>. Full Operating Capability.</li>
</ul>
<p>In the Heatmap, DPRI CCN square footage lands at <strong>Activation</strong>. MLR and 3/12 CCN square footage lands at <strong>FOC</strong>. If a row has no activation date at all, the Heatmap falls back to the earliest non zero year in its FY plan so the cell still appears, but dimmed to signal that the year came from a budget entry rather than a programmed milestone.</p>` },

      { h: "CCN Catalog tab",
        body: `
<p>1,059 five digit category codes extracted from FC 2-000-05N Appendix A. The catalog is reference data. Projects borrow from it.</p>
<p>Toolbar: <strong>+ Add CCN</strong> (for local or derived codes not in Appendix A) and a <strong>search</strong> box that matches code, title, category, and UM. The count on the right updates as you type.</p>
<p>Columns:</p>
<ul>
  <li><strong>Code</strong>. The five digit CCN.</li>
  <li><strong>Title</strong>. Editable in place.</li>
  <li><strong>UM</strong>. Unit of measure. SF, EA, LF, and others. Editable.</li>
  <li><strong>Category</strong>. Colored chip by NAVFAC series (100, 200, 300, and up to 900). Each series has its own color so you can scan the catalog by family.</li>
  <li><strong>Sub-category</strong>. Hover the truncated text for the full string.</li>
</ul>
<p>Row delete (✕) warns if any project assignment references the code. Confirming removes the catalog entry but leaves the existing assignments as orphan codes flagged "(not in catalog)" in the project view.</p>` },

      { h: "CCN Assignment tab",
        body: `
<p>Two panes. Left is a searchable project list. Right is the active project's assignment panel.</p>
<p><strong>Left pane:</strong> type in the search box to filter by title or ID. Each list item shows an umbrella chip, the title, the installation, and a CCN count if any assignments exist. Click to load the right pane.</p>
<p><strong>Right pane toolbar:</strong> the project title and a muted line with installation and program. Then <strong>+ Add assignment</strong> (adds a blank row with scheduled FY defaulted to the project's Activation FY) and <strong>Paste from spreadsheet</strong> (bulk add using a header row of <code>ccn,qty,scheduledFY,note</code>).</p>
<p><strong>Assignment table columns:</strong> CCN, Title (auto filled from the catalog), UM, Qty, Scheduled FY, Note, and a delete button. Every cell saves on change. The footer totals the quantities grouped by unit of measure, for example "Totals by UM: SF: 12,450 · EA: 8".</p>
<p>If you type a CCN that is not in the catalog the title reads "(not in catalog)". Add the code in the CCN Catalog tab if you need the local title to stick.</p>
<p>The same assignment panel appears inside the Projects Table row detail modal as a sub grid.</p>` },

      { h: "Heatmap tab",
        body: `
<p>Time phased CCN square footage. The controls bar has three segmented toggles and the year slider sits below the grid.</p>
<p><strong>Mode:</strong></p>
<ul>
  <li><strong>Annual</strong>. Only SF that activates in the current FY.</li>
  <li><strong>Cumulative</strong>. Running total of SF from the earliest year through the current FY. This is the default and is the "what will be available by FY X" view clients usually ask for.</li>
</ul>
<p><strong>Basis:</strong></p>
<ul>
  <li><strong>Net</strong>. DEMO projects subtract their SF. REPLACEMENT projects subtract the SF of the project they replace (via the <code>replaces</code> link) and add their own. This is the default.</li>
  <li><strong>Gross</strong>. Every assignment adds. No subtraction.</li>
</ul>
<p><strong>Axis:</strong></p>
<ul>
  <li><strong>Installation by CCN</strong>. Rows are installations, columns are CCN codes. Default.</li>
  <li><strong>CCN by Installation</strong>. Rows are CCN codes, columns are installations. Useful when you have many CCNs and few camps.</li>
</ul>
<p><strong>Grid cells:</strong> positive values shade blue, negative values (net demos or replacements) shade red. Numbers are rendered in thousands (12k = 12,000 SF). Zero cells show a dot. Click any cell for a drill down dialog listing the contributing projects with per project SF subtotals.</p>
<p><strong>Year slider:</strong> spans FY2010 to FY2055 so the narrative extends past the latest data. The play button steps forward one year at 900 ms intervals and loops back to the start at the end. The label reads FY2031 (or whichever). Dragging or playing updates the grid and the side panel.</p>
<p><strong>Delivering by FY side panel:</strong> a horizontal stacked bar chart, one row per installation with any project delivering in the current window (Annual) or by that year (Cumulative). Each bar is segmented by program umbrella with counts inline. The legend and a grand total sit below.</p>
<p>If no CCNs are assigned yet, the grid shows a small empty state telling you to assign CCNs in the Projects view.</p>` },

      { h: "Crosswalk tab",
        body: `
<p>For a single project, see what else is happening on the same installation.</p>
<p>Left pane is a project picker with a search box and umbrella chip per item. Click a project to load the right pane.</p>
<p>Right pane shows the focal project's title, installation, program label, and Activation FY. Below that, all other projects on the same installation are grouped by umbrella (DPRI, 12th MLR, 3/12, Other) with a count per group. Each peer is a link. Click to refocus the pane on that peer.</p>
<p>If any project references the focal one (via <code>replaces</code> or the <code>linked</code> array), a "Projects that reference this one" block appears with those links.</p>
<p><strong>Copy installation brief (Markdown)</strong> copies a short FOUO tagged summary of the focal project and its peers to your clipboard. If the browser blocks clipboard access the text drops into a textarea you can copy from.</p>` },

      { h: "Admin tab",
        body: `
<p>Four sub tabs at the top: Installations, Programs, Columns, Viewer.</p>
<p><strong>Installations.</strong> Edit ID, Name, Service (default USMC), Country (JPN / GUM / USA / AUS), and Color (color picker). The Projects column shows how many projects reference each installation. ✕ attempts a delete. If any projects reference the installation, a reassign dialog opens with a dropdown of other installations; pick one and the projects move before the installation is removed. You cannot silently drop referenced data.</p>
<p>The <strong>Add installation</strong> form at the bottom takes id (kebab case), name, service, country, and color. Saving adds the installation to the header tabs and to every dropdown.</p>
<p><strong>Programs.</strong> Edit umbrella, label, and color per program. ID is read only. Delete is cascade guarded the same way. Adding a new program with a new umbrella adds a new umbrella tab in the header.</p>
<p><strong>Columns.</strong> Every column on the Projects Table is listed. Rename the label, change visibility, set a unit string, or delete (user added columns only). The <strong>Add column</strong> form below takes a snake case key, a label, a type (text, number, currency, date, enum, bool), and an optional unit. New columns appear immediately in the Projects Table and in every export.</p>
<p><strong>Viewer.</strong> The name stamped on every export as part of the FOUO watermark. Change it here or by clicking the Prepared By chip in the header.</p>` },

      { h: "Brief layout",
        body: `
<p>Click <strong>Brief</strong> in the header to switch to the client briefing layout. The sidebar is hidden. Chrome is minimized. The FOUO banners stay at top and bottom.</p>
<p>Five slides:</p>
<ol>
  <li><strong>Title.</strong> Program names, Prepared By, the date, and buttons for Exit and Print / PDF.</li>
  <li><strong>Executive KPIs.</strong> The Overview strip plus phase grid, donut, activation timeline, and matrix.</li>
  <li><strong>CCN Laydown Over Time.</strong> The full Heatmap including controls and year slider. The client can scrub the slider during a live brief.</li>
  <li><strong>Installation Summary.</strong> One block per installation with umbrella counts and the first five project titles.</li>
  <li><strong>Notes.</strong> A textarea for talking points. Saved to the store as brief notes.</li>
</ol>
<p><strong>Navigation:</strong> PageDown and PageUp (or Ctrl+ArrowDown and Ctrl+ArrowUp) scroll between slides. <strong>Esc</strong> returns to the normal layout.</p>
<p>You can link straight into Brief by opening the file with <code>#brief=1</code> appended, useful for a shared screen.</p>` },

      { h: "Exports",
        body: `
<p>Four ways out:</p>
<ul>
  <li><strong>JSON.</strong> Full data snapshot including every project, CCN, installation, program, and schema column you added. Re-importable by clicking the same button upstream or by passing the file to the JSON importer.</li>
  <li><strong>HTML.</strong> Re-bakes a fresh self contained <code>dashboard-prepared-by-NAME-YYYY-MM-DD.html</code> with your current edits embedded. This is the file you share with the client. The receiver does not need to import anything; they just open it.</li>
  <li><strong>Print.</strong> Ctrl or Cmd P. The print layout hides the sidebar and header actions. FOUO banners remain. Useful for slide decks or printed read aheads.</li>
  <li><strong>Brief.</strong> Toggle into the client briefing layout and either present live or print from there.</li>
</ul>
<p>Every export carries the FOUO handling caveat and the Prepared By watermark. If the watermark is blank, set your name first via the Prepared By chip.</p>` },

      { h: "Filters, undo, and redo",
        body: `
<p>Three filter controls live in the header. They combine with AND.</p>
<ul>
  <li><strong>Installation tab.</strong> One installation at a time, or All.</li>
  <li><strong>Program umbrella tab.</strong> One umbrella at a time, or none.</li>
  <li><strong>Search box.</strong> Matches project title, project ID, and parsed building number.</li>
</ul>
<p>The <strong>Clear</strong> button in Row 3 resets all three at once.</p>
<p>Every view reacts live. Overview KPI cards recount, the phase bars redraw, the donut reweights, the matrix recomputes, the Heatmap regenerates cells, the CCN Assignment project list re-filters, and the Crosswalk candidate list narrows.</p>
<p><strong>Undo and Redo.</strong> Every data mutation (field edit, milestone check, CCN add, installation rename, column delete) pushes a snapshot to a 20 state ring buffer stored in your browser. Ctrl+Z reverts. Ctrl+Shift+Z or Ctrl+Y re-applies. The header Undo and Redo buttons do the same. The buffer mirrors to <code>localStorage</code> under <code>dashboard.v1.history</code> so a reload does not lose it.</p>` },

      { h: "Keyboard shortcuts",
        body: `
<ul>
  <li><code>Ctrl+Z</code> undo. <code>Ctrl+Shift+Z</code> or <code>Ctrl+Y</code> redo.</li>
  <li><code>/</code> or <code>Ctrl+K</code> focuses the search box.</li>
  <li><code>g</code> then a letter jumps to a section:
    <code>o</code> Overview, <code>p</code> Projects, <code>c</code> CCN Catalog, <code>a</code> CCN Assignment, <code>h</code> Heatmap, <code>x</code> Crosswalk, <code>b</code> Brief.</li>
  <li><code>Esc</code> exits the Brief layout.</li>
  <li>In the Brief layout, <code>PageDown</code> and <code>PageUp</code> (or <code>Ctrl+ArrowDown</code> / <code>Ctrl+ArrowUp</code>) move between slides.</li>
</ul>
<p>Shortcuts are suppressed while you are typing in an input or textarea, so your edits are safe.</p>` },

      { h: "Where your edits live",
        body: `
<p>All edits save to your browser's <code>localStorage</code> under the key <code>dashboard.v1</code>. The undo history lives under <code>dashboard.v1.history</code>. The Prepared By name lives under <code>dashboard.v1.viewer</code>. The Projects view preference (Table or Cards) is saved as <code>dashboard.v2.projectsView</code>.</p>
<p>The embedded file that ships to a client carries the baseline data. Your edits stay on your machine until you click <strong>HTML</strong>, which re-bakes a new file with the current store embedded, or <strong>JSON</strong>, which exports the store as a data file.</p>
<p>Clearing your browser data for this file's origin (or opening the file from a fresh path) will reset the store to the embedded baseline. Export before you do that if you want to keep your work.</p>` },

      { h: "FOUO handling",
        body: `
<p>The file opens with zero external network calls. All libraries (Tabulator, D3, PapaParse), all icons, and all data are embedded. Verify by opening DevTools and checking that the Network tab is empty after a reload.</p>
<ul>
  <li><strong>Top and bottom banners</strong> carry the UNCLASSIFIED // FOR OFFICIAL USE ONLY caveat at all times, including in the Brief layout and in print.</li>
  <li><strong>Every export</strong> (JSON, CSV, HTML re-bake, print view) carries the handling caveat and the Prepared By watermark.</li>
  <li><strong>Keep the file on authorized storage.</strong> Do not post raw JSON exports to public services.</li>
  <li><strong>No fonts, no analytics, no remote images.</strong> The tool is offline by design.</li>
</ul>` },

    ];

    const intro = $("div", {}, [
      $("h2", { text: "Instructions" }),
      $("p", { class: "u-muted", text: "Plain English walkthrough of every tab, control, chart, and interaction in this dashboard. Read once on first open. Come back as needed." })
    ]);
    wrap.appendChild(intro);

    sections.forEach(s => {
      wrap.appendChild($("h2", { text: s.h }));
      wrap.appendChild($("div", { html: s.body }));
    });

    container.appendChild(wrap);
  };
})();
