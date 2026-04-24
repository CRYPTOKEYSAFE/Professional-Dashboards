/* heatmap.js - time-phased CCN sqft visualization. D3 v7.
 * Modes: annual | cumulative. Basis: net (DEMO subtracts, REPLACEMENT swaps) | gross.
 * Year slider with play/pause. Click cell → drill-down. Axis toggle install×category.
 */
window.Sections = window.Sections || {};

(function () {
  "use strict";

  const $ = (tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  };

  const FY_MIN_DEFAULT = 2010;
  const FY_MAX_DEFAULT = 2055;

  // Derive unique 5-digit CCN codes in use across all projects (SF-measured only),
  // returned sorted numerically with their catalog title attached.
  function ccnsInUse(store) {
    const catalog = {};
    (store.listCCNs?.() || []).forEach(c => { catalog[c.codeNormalized || c.code] = c; });
    const inUse = new Set();
    store.getProjects().forEach(p => {
      (p.ccns || []).forEach(a => {
        const entry = catalog[a.ccn] || catalog[(a.ccn || "").replace(/\s/g, "")];
        if (entry && entry.um === "SF") inUse.add(entry.codeNormalized || entry.code);
      });
    });
    const rows = Array.from(inUse).map(code => ({
      code,
      title: (catalog[code]?.title || ""),
      label: code + "  " + (catalog[code]?.title || "")
    }));
    rows.sort((a, b) => Number(a.code) - Number(b.code));
    return rows;
  }

  function buildIndex(store) {
    const catalog = {}; (store.listCCNs?.() || []).forEach(c => { catalog[c.codeNormalized || c.code] = c; });
    const projects = store.getProjects();
    const byId = {}; projects.forEach(p => byId[p.id] = p);
    const replacedBy = {}; // id -> replacement project
    projects.forEach(p => { if (p.replaces) replacedBy[p.replaces] = p; });
    return { catalog, projects, byId, replacedBy };
  }

  function projectActivationFY(p, fyPlanFallback) {
    const b = p.activationFYOverride ?? p.activationFY ?? null;
    if (b != null) return b;
    if (fyPlanFallback && p.fyPlan) {
      const entries = Object.entries(p.fyPlan).filter(([, v]) => v > 0).map(([k]) => Number(k.replace(/FY/i, "")));
      if (entries.length) return Math.min(...entries);
    }
    return null;
  }

  function aggregate(store, { mode, basis, axis, currentYear, filter }) {
    const idx = buildIndex(store);
    const installs = store.listInstallations().map(i => i.name);
    const ccnRows = ccnsInUse(store);
    const ccnByCode = {}; ccnRows.forEach(r => { ccnByCode[r.code] = r; });
    const progs = {}; store.listPrograms().forEach(p => progs[p.id] = p);

    const fs = filter || {};
    const projs = idx.projects.filter(p => {
      if (fs.umbrella && (progs[p.program]?.umbrella) !== fs.umbrella) return false;
      if (fs.installation && p.installation !== fs.installation) return false;
      if (fs.search) {
        const q = fs.search.toLowerCase();
        if (!((p.title || "").toLowerCase().includes(q) || (p.id || "").toLowerCase().includes(q))) return false;
      }
      return true;
    });

    // Stream each CCN assignment: { year, installation, ccnCode, sf, projectId }
    const stream = [];
    projs.forEach(p => {
      const defaultYear = projectActivationFY(p, true);
      (p.ccns || []).forEach(a => {
        const c = idx.catalog[a.ccn] || idx.catalog[(a.ccn || "").replace(/\s/g, "")];
        if (!c || c.um !== "SF") return;
        const y = a.scheduledFY ?? defaultYear;
        if (y == null) return;
        const code = c.codeNormalized || c.code;
        let sf = Number(a.qty) || 0;
        if (basis === "net" && p.projectType === "DEMO") sf = -Math.abs(sf);
        stream.push({ year: Number(y), installation: p.installation || "SACO", ccnCode: code, sf, projectId: p.id });
      });
      if (basis === "net" && p.projectType === "REPLACEMENT" && p.replaces && idx.byId[p.replaces]) {
        const replaced = idx.byId[p.replaces];
        const y = projectActivationFY(p, true);
        if (y != null) {
          (replaced.ccns || []).forEach(a => {
            const c = idx.catalog[a.ccn]; if (!c || c.um !== "SF") return;
            const code = c.codeNormalized || c.code;
            stream.push({ year: Number(y), installation: replaced.installation || "SACO", ccnCode: code, sf: -Math.abs(Number(a.qty) || 0), projectId: p.id + "::replaces::" + replaced.id });
          });
        }
      }
    });

    // Rows = CCN codes in use, Columns = installations (default axis).
    // Flip axis swaps rows and cols.
    const codes = ccnRows.map(r => r.code);
    const rows = axis === "ccn-x-install" ? codes : installs;
    const cols = axis === "ccn-x-install" ? installs : codes;
    const rowKey = axis === "ccn-x-install" ? (s) => s.ccnCode : (s) => s.installation;
    const colKey = axis === "ccn-x-install" ? (s) => s.installation : (s) => s.ccnCode;
    const mat = {};
    rows.forEach(r => mat[r] = {});
    stream.forEach(s => {
      const applicable = mode === "cumulative" ? s.year <= currentYear : s.year === currentYear;
      if (!applicable) return;
      const rk = rowKey(s), ck = colKey(s);
      if (!mat[rk]) mat[rk] = {};
      mat[rk][ck] = (mat[rk][ck] || 0) + s.sf;
    });

    const years = Array.from(new Set(stream.map(s => s.year))).sort((a,b)=>a-b);
    return { matrix: mat, rows, cols, years, stream, ccnByCode };
  }

  function drillDown(stream, row, col, mode, currentYear, axis) {
    const dlg = $("dialog", { class: "detail-dialog" });
    const filtered = stream.filter(s => {
      const applicable = mode === "cumulative" ? s.year <= currentYear : s.year === currentYear;
      if (!applicable) return false;
      if (axis === "ccn-x-install") return s.ccnCode === row && s.installation === col;
      return s.installation === row && s.ccnCode === col;
    });
    const byProj = {};
    filtered.forEach(s => { byProj[s.projectId] = (byProj[s.projectId] || 0) + s.sf; });
    const rows = Object.entries(byProj).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const totalSF = filtered.reduce((a,s)=>a+s.sf,0);
    dlg.appendChild($("div", { class: "det-head" }, [
      $("strong", { text: `${row} × ${col} - ${mode === "cumulative" ? "through " : ""}FY${currentYear}` }),
      $("span", { class: "foumark", text: "FOUO" }),
      $("button", { class: "btn btn-ghost", text: "✕", onclick: () => { dlg.close(); dlg.remove(); } })
    ]));
    const body = $("div", { class: "det-body" });
    body.appendChild($("div", { class: "det-total", text: `Total: ${Math.round(totalSF).toLocaleString()} SF (${rows.length} contributing project${rows.length===1?"":"s"})` }));
    const list = $("table", { class: "summary-table" });
    list.appendChild($("thead", {}, [$("tr", {}, [$("th", { text: "Project" }), $("th", { text: "SF" })])]));
    const tb = $("tbody");
    rows.forEach(([pid, sf]) => {
      const p = window.DataStore.getProject(pid.split("::replaces::")[0]);
      tb.appendChild($("tr", {}, [$("td", { text: (p?.title || pid) }), $("td", { text: Math.round(sf).toLocaleString() })]));
    });
    list.appendChild(tb);
    body.appendChild(list);
    dlg.appendChild(body);
    document.body.appendChild(dlg); dlg.showModal();
  }

  window.Sections.heatmap = function (container) {
    const store = window.DataStore;
    container.innerHTML = "";
    const state = { mode: "cumulative", basis: "net", axis: "install-x-ccn", currentYear: null, playing: false };

    const controls = $("div", { class: "hm-controls" }, [
      $("span", { class: "u-muted", text: "Mode:" }),
      $("div", { class: "seg" }, [
        $("button", { class: "seg-btn", "data-val": "annual", text: "Annual", onclick: () => { state.mode = "annual"; render(); } }),
        $("button", { class: "seg-btn active", "data-val": "cumulative", text: "Cumulative", onclick: () => { state.mode = "cumulative"; render(); } }),
      ]),
      $("span", { class: "u-muted", text: "Basis:" }),
      $("div", { class: "seg" }, [
        $("button", { class: "seg-btn active", "data-val": "net", text: "Net (demos subtract)", onclick: () => { state.basis = "net"; render(); } }),
        $("button", { class: "seg-btn", "data-val": "gross", text: "Gross", onclick: () => { state.basis = "gross"; render(); } }),
      ]),
      $("span", { class: "u-muted", text: "Axis:" }),
      $("div", { class: "seg" }, [
        $("button", { class: "seg-btn active", "data-val": "install-x-ccn", text: "Installation by CCN", onclick: () => { state.axis = "install-x-ccn"; render(); } }),
        $("button", { class: "seg-btn", "data-val": "ccn-x-install", text: "CCN by Installation", onclick: () => { state.axis = "ccn-x-install"; render(); } }),
      ])
    ]);
    container.appendChild(controls);

    const gridHost = $("div", { class: "hm-host" });
    container.appendChild(gridHost);

    const slider = $("div", { class: "hm-slider" });
    container.appendChild(slider);

    const side = $("div", { class: "hm-side" });
    container.appendChild(side);

    function setActiveSeg(group, val) { group.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b.getAttribute("data-val") === val)); }

    function render() {
      controls.querySelectorAll(".seg").forEach((g, i) => {
        const val = [state.mode, state.basis, state.axis][i];
        setActiveSeg(g, val);
      });
      const agg = aggregate(store, { mode: state.mode, basis: state.basis, axis: state.axis, currentYear: state.currentYear ?? FY_MAX_DEFAULT, filter: window.FilterState });
      // Year slider always spans FY_MIN_DEFAULT..FY_MAX_DEFAULT so the narrative extends far beyond the latest data point.
      const years = [];
      for (let y = FY_MIN_DEFAULT; y <= FY_MAX_DEFAULT; y++) years.push(y);
      if (state.currentYear == null) {
        state.currentYear = agg.years.length ? Math.min(Math.max(agg.years[agg.years.length - 1], FY_MIN_DEFAULT), FY_MAX_DEFAULT) : new Date().getFullYear();
      }
      renderSlider(years);
      const agg2 = aggregate(store, { mode: state.mode, basis: state.basis, axis: state.axis, currentYear: state.currentYear, filter: window.FilterState });
      drawHeatmap(agg2);
      renderSide(agg2);
    }

    function labelForAxisValue(axis, dim, value, agg) {
      // axis: "install-x-ccn" means rows=installations, cols=CCN codes.
      //       "ccn-x-install" means rows=CCN codes, cols=installations.
      if (axis === "install-x-ccn") {
        if (dim === "col") {
          const meta = agg.ccnByCode[value];
          return meta ? `${value}  ${meta.title || ""}`.trim() : value;
        }
        return value; // row: installation name
      }
      if (dim === "row") {
        const meta = agg.ccnByCode[value];
        return meta ? `${value}  ${meta.title || ""}`.trim() : value;
      }
      return value; // col: installation name
    }

    function drawHeatmap(agg) {
      gridHost.innerHTML = "";
      if (agg.rows.length === 0 || agg.cols.length === 0) {
        gridHost.appendChild($("div", { class: "hm-empty" }, [
          $("strong", { text: "No CCN assignments yet." }),
          $("div", { class: "u-muted", text: "Assign CCNs to projects in the Projects view. Each assignment lights up a cell here, tied to the project's activation fiscal year." })
        ]));
        return;
      }
      const hostW = Math.max(gridHost.clientWidth || 1200, 900);
      const labelW = state.axis === "install-x-ccn" ? 160 : 260;
      const cellW = Math.max(70, Math.floor((hostW - labelW - 40) / Math.max(1, agg.cols.length)));
      const cellH = 50;
      const width = labelW + agg.cols.length * cellW + 40;
      const height = 44 + agg.rows.length * cellH + 20;
      const svg = window.d3.select(gridHost).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "none").attr("width", "100%").attr("height", String(height)).attr("class", "hm-svg");
      let maxAbs = 0;
      agg.rows.forEach(r => agg.cols.forEach(c => { maxAbs = Math.max(maxAbs, Math.abs(agg.matrix[r]?.[c] || 0)); }));
      const pos = window.d3.scaleSequential(window.d3.interpolateBlues).domain([0, maxAbs || 1]);
      const neg = window.d3.scaleSequential(window.d3.interpolateReds).domain([0, maxAbs || 1]);
      agg.cols.forEach((c, i) => {
        const label = labelForAxisValue(state.axis, "col", c, agg);
        // CCN labels can be long; truncate for column headers.
        const short = label.length > 20 ? label.slice(0, 18) + "..." : label;
        const t = svg.append("text").attr("x", labelW + i * cellW + cellW / 2).attr("y", 26).attr("text-anchor", "middle").attr("font-size", 11).attr("font-weight", 600).attr("fill", "#1B2535").text(short);
        t.attr("data-tip", label);
      });
      agg.rows.forEach((r, rIdx) => {
        const label = labelForAxisValue(state.axis, "row", r, agg);
        const short = label.length > 34 ? label.slice(0, 32) + "..." : label;
        const t = svg.append("text").attr("x", labelW - 10).attr("y", 44 + rIdx * cellH + cellH / 2 + 4).attr("text-anchor", "end").attr("font-size", 11).attr("font-weight", 600).attr("fill", "#1B2535").text(short);
        t.attr("data-tip", label);
        agg.cols.forEach((c, cIdx) => {
          const v = agg.matrix[r]?.[c] || 0;
          const color = v === 0 ? "#EDF0F4" : (v > 0 ? pos(Math.abs(v)) : neg(Math.abs(v)));
          const rowLabel = labelForAxisValue(state.axis, "row", r, agg);
          const colLabel = labelForAxisValue(state.axis, "col", c, agg);
          svg.append("rect")
            .attr("x", labelW + cIdx * cellW + 3).attr("y", 44 + rIdx * cellH + 3)
            .attr("width", cellW - 6).attr("height", cellH - 6)
            .attr("rx", 4).attr("fill", color)
            .attr("stroke", "#CDD5DE").attr("stroke-width", 0.5)
            .attr("data-tip", `${rowLabel} | ${colLabel}: ${Math.round(v).toLocaleString()} SF`)
            .style("cursor", "pointer")
            .on("click", () => drillDown(agg.stream, r, c, state.mode, state.currentYear, state.axis));
          if (Math.abs(v) >= 1) {
            svg.append("text").attr("x", labelW + cIdx * cellW + cellW / 2).attr("y", 44 + rIdx * cellH + cellH / 2 + 5)
              .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700)
              .attr("fill", Math.abs(v) > maxAbs * 0.5 ? "#fff" : "#1B2535")
              .text(Math.round(v / 1000) + "k");
          } else if (v === 0) {
            svg.append("text").attr("x", labelW + cIdx * cellW + cellW / 2).attr("y", 44 + rIdx * cellH + cellH / 2 + 4)
              .attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#8A98A8").text(".");
          }
        });
      });
    }

    function renderSlider(years) {
      slider.innerHTML = "";
      const wrap = $("div", { class: "hm-slider-wrap" });
      const play = $("button", { class: "btn btn-ghost", text: state.playing ? "⏸" : "▶", onclick: () => togglePlay() });
      const yearLbl = $("span", { class: "hm-year-lbl", text: "FY" + state.currentYear });
      const inp = $("input", { type: "range", min: years[0], max: years[years.length - 1], step: 1, value: state.currentYear });
      inp.addEventListener("input", (e) => { state.currentYear = Number(e.target.value); yearLbl.textContent = "FY" + state.currentYear; const agg2 = aggregate(store, { mode: state.mode, basis: state.basis, axis: state.axis, currentYear: state.currentYear, filter: window.FilterState }); drawHeatmap(agg2); renderSide(agg2); });
      wrap.appendChild(play); wrap.appendChild(inp); wrap.appendChild(yearLbl);
      slider.appendChild(wrap);
    }

    let playInt = null;
    function togglePlay() {
      state.playing = !state.playing;
      const btn = slider.querySelector(".btn-ghost"); if (btn) btn.textContent = state.playing ? "⏸" : "▶";
      if (state.playing) {
        playInt = setInterval(() => {
          const inp = slider.querySelector("input[type=range]"); if (!inp) return;
          const max = Number(inp.max); let next = state.currentYear + 1;
          if (next > max) next = Number(inp.min);
          state.currentYear = next; inp.value = next;
          const yr = slider.querySelector(".hm-year-lbl"); if (yr) yr.textContent = "FY" + next;
          const agg2 = aggregate(store, { mode: state.mode, basis: state.basis, axis: state.axis, currentYear: state.currentYear, filter: window.FilterState });
          drawHeatmap(agg2); renderSide(agg2);
        }, 900);
      } else if (playInt) { clearInterval(playInt); playInt = null; }
    }

    function renderSide(agg) {
      side.innerHTML = "";
      side.appendChild($("h3", { class: "section-h3", text: `Delivering by FY${state.currentYear}` }));
      const progs = {}; store.listPrograms().forEach(p => progs[p.id] = p);
      const delivering = store.getProjects().filter(p => {
        const y = projectActivationFY(p, true);
        if (y == null) return false;
        return state.mode === "cumulative" ? y <= state.currentYear : y === state.currentYear;
      });
      if (!delivering.length) { side.appendChild($("div", { class: "u-muted", text: "No projects in scope for this year." })); return; }

      // Group by installation, sub-group by program umbrella.
      const installs = store.listInstallations();
      const byInst = {};
      delivering.forEach(p => {
        const inst = p.installation || "SACO";
        const u = progs[p.program]?.umbrella || "Other";
        byInst[inst] = byInst[inst] || { total: 0, byUmb: {} };
        byInst[inst].total += 1;
        byInst[inst].byUmb[u] = (byInst[inst].byUmb[u] || 0) + 1;
      });
      const maxInstTotal = Math.max(1, ...Object.values(byInst).map(v => v.total));

      const chart = $("div", { class: "hm-delivering-chart" });
      const UMBS = [
        { key: "DPRI", color: "#1E3F5C" },
        { key: "12th MLR", color: "#2E91AE" },
        { key: "3/12", color: "#7A5900" },
        { key: "Other", color: "#546270" }
      ];
      installs.forEach(i => {
        const entry = byInst[i.name];
        if (!entry) return;
        const row = $("div", { class: "hm-dl-row" });
        row.appendChild($("div", { class: "hm-dl-label", text: i.name }));
        const bar = $("div", { class: "hm-dl-bar" });
        const widthPct = (entry.total / maxInstTotal) * 100;
        UMBS.forEach(u => {
          const v = entry.byUmb[u.key] || 0;
          if (!v) return;
          const segPct = (v / entry.total) * widthPct;
          bar.appendChild($("div", {
            class: "hm-dl-seg",
            style: `width:${segPct}%;background:${u.color}`,
            "data-tip": `${i.name} | ${u.key}: ${v} project${v === 1 ? "" : "s"}`,
            text: v >= Math.ceil(maxInstTotal * 0.08) ? String(v) : ""
          }));
        });
        row.appendChild(bar);
        row.appendChild($("div", { class: "hm-dl-total", text: String(entry.total) }));
        chart.appendChild(row);
      });
      side.appendChild(chart);

      // Compact legend + total
      const legend = $("div", { class: "hm-dl-legend" }, UMBS.map(u =>
        $("span", { class: "hm-dl-leg" }, [
          $("span", { class: "hm-dl-dot", style: `background:${u.color}` }),
          $("span", { text: u.key })
        ])
      ));
      legend.appendChild($("span", { class: "hm-dl-grand u-muted", text: `Total: ${delivering.length} project${delivering.length === 1 ? "" : "s"}` }));
      side.appendChild(legend);
    }

    render();
    const onF = () => render(); const onC = () => render();
    document.addEventListener("filter-change", onF); store.on("change", onC);
    document.addEventListener("section-unmount", function tear() {
      document.removeEventListener("filter-change", onF);
      store.off("change", onC);
      if (playInt) { clearInterval(playInt); playInt = null; }
      document.removeEventListener("section-unmount", tear);
    });
  };
})();
