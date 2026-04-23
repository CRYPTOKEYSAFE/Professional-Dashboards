/* instructions.js - in-dashboard help and data flow reference.
 * Plain English. No AI phrasing. Written for a PPE planner opening the tool for the first time.
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
      { h: "What this is",
        body: `<p>Single file HTML dashboard for MCIPAC G-F / PPE facility planning. Covers three program buckets that share the same Okinawa installation footprint: DPRI, 12th MLR, and 3/12. Opens by double-click. No server. No install. Edits save to your browser automatically and travel with the file when you export or re-save.</p>` },

      { h: "Who edits, who views",
        body: `<p>Only PPE edits. The client never edits. When a working session is done, click <code>HTML</code> in the header to download a fresh self-contained file that carries the current data. Share that copy.</p>` },

      { h: "How the data flows",
        body: `
<p>Three layers of data:</p>
<ul>
  <li><strong>Projects</strong>: 412 DPRI + 60 MLR/3/12 rows, normalized from the source files. Each project has a program, an installation, lifecycle dates, and a list of CCN assignments.</li>
  <li><strong>CCN Catalog</strong>: 1,059 five-digit NAVFAC category codes from FC 2-000-05N Appendix A. Reference only; you add new codes here if you need locals.</li>
  <li><strong>CCN Assignments</strong>: the per-project list that ties a building to one or more CCNs with a square footage and a scheduled fiscal year. This is what lights up the Heatmap.</li>
</ul>` },

      { h: "Daily workflow",
        body: `
<ol>
  <li>Open the HTML, type your name in the <strong>Prepared By</strong> chip (stamps every export).</li>
  <li>Filter by program or installation using the tabs in the header. The whole dashboard responds.</li>
  <li>Go to <strong>Projects</strong>. Use <strong>Cards</strong> view when programming CCNs; use <strong>Table</strong> view when scanning or bulk editing.</li>
  <li>On a project card, set dates on each milestone box (F42, Budget, Design, Construction, Activation for DPRI; IOC and FOC for MLR and 3/12). Check the box when the milestone is achieved.</li>
  <li>In the CCN Assignments block on the card, click <strong>+ Add CCN</strong>. Type a five digit code, the catalog title auto-fills. Enter square footage and the scheduled FY.</li>
  <li>Open the <strong>Heatmap</strong>. The year slider runs from FY2010 to FY2055. Drag it and the grid recomputes. Each CCN code has its own row. Cell values are sum of SF across all projects that activate in or before that FY.</li>
  <li>When you are done, click <strong>HTML</strong> in the header to download a fresh copy with your edits.</li>
</ol>` },

      { h: "Milestone terms",
        body: `
<p><strong>DPRI</strong> uses the five stage model:</p>
<ul>
  <li><strong>Form 42</strong> (funding programming document)</li>
  <li><strong>Budget / BCP</strong> (budget cycle planning)</li>
  <li><strong>Design</strong></li>
  <li><strong>Construction</strong></li>
  <li><strong>Activation</strong> (facility turnover, usable)</li>
</ul>
<p><strong>12th MLR</strong> and <strong>3/12</strong> use the capability model:</p>
<ul>
  <li><strong>IOC</strong>, Initial Operating Capability</li>
  <li><strong>FOC</strong>, Full Operating Capability</li>
</ul>
<p>In the Heatmap aggregation, DPRI CCN SF lights up at <strong>Activation</strong>. MLR and 3/12 CCN SF lights up at <strong>FOC</strong>.</p>` },

      { h: "Programs and umbrellas",
        body: `
<p>Four program umbrellas:</p>
<ul>
  <li><strong>DPRI</strong>: FRF, OKICON, SACO (412 projects)</li>
  <li><strong>12th MLR</strong>: projects tagged 12th Marine Littoral Regiment (33 projects)</li>
  <li><strong>3/12</strong>: 3rd Battalion 12th Marines, the split off firing battery (15 projects)</li>
  <li><strong>Other</strong>: 3rd MarDiv, MCIPAC, III MEF, MAW (12 projects)</li>
</ul>
<p>Clicking any umbrella chip in the header filters every view on the page, including Overview KPIs and the Heatmap.</p>` },

      { h: "SACO installation bucket",
        body: `<p>Twenty-eight DPRI projects in the source had "SACO Program" listed as the installation. SACO is a program agreement, not a physical camp. They live in the <strong>SACO</strong> installation until a specific camp is assigned. Edit the installation on the project card to move them out.</p>` },

      { h: "Editing anything",
        body: `
<p>Everything is editable from PPE. In the <strong>Admin</strong> tab you can:</p>
<ul>
  <li>Add, rename, or delete installations (cascade guard warns if projects reference a camp being removed)</li>
  <li>Add, edit, or delete programs</li>
  <li>Add user defined columns to the Projects grid</li>
  <li>Change the "Prepared By" name</li>
</ul>
<p>On Projects cards, every field is editable inline. In the CCN Catalog tab you can edit or add CCN codes not shipped with FC 2-000-05N.</p>` },

      { h: "Exports",
        body: `
<ul>
  <li><strong>JSON</strong>: full data snapshot, re-importable.</li>
  <li><strong>HTML</strong>: fresh self-contained dashboard with current edits embedded. This is what you share.</li>
  <li><strong>Print</strong>: ctrl or cmd P for a print view that suppresses chrome.</li>
  <li><strong>Brief</strong>: toggle the slide style layout for client presentations.</li>
</ul>
<p>Every export carries the FOUO handling banner and the Prepared By watermark.</p>` },

      { h: "Keyboard",
        body: `
<ul>
  <li><code>Ctrl+Z</code> undo last edit (20 step ring buffer)</li>
  <li><code>Ctrl+Shift+Z</code> redo</li>
  <li><code>/</code> or <code>Ctrl+K</code> focus search</li>
  <li><code>g</code> then <code>o p c a h x b</code> jump to Overview, Projects, CCNs, Assignment, Heatmap, Crosswalk, Brief</li>
  <li><code>Esc</code> exit Brief layout</li>
</ul>` },

      { h: "FOUO handling",
        body: `<p>File opens with no external network calls. All libraries, icons, and data are embedded. Keep the file on authorized storage. Do not post raw exports to public services.</p>` }
    ];

    const intro = $("div", {}, [
      $("h2", { text: "Instructions" }),
      $("p", { class: "u-muted", text: "Read once. Refer back as needed." })
    ]);
    wrap.appendChild(intro);

    sections.forEach(s => {
      wrap.appendChild($("h2", { text: s.h }));
      wrap.appendChild($("div", { html: s.body }));
    });

    container.appendChild(wrap);
  };
})();
