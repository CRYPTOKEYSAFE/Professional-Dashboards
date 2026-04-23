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

  const CATEGORIES = ["100","200","300","400","500","600","700","800","900"];
  const CATEGORY_LABEL = {
    "100":"Operational / Training","200":"Maintenance / Production","300":"RDT&E",
    "400":"Supply","500":"Hospital / Medical","600":"Administrative",
    "700":"Housing / Personnel","800":"Utilities / Ground","900":"Real Estate"
  };

  function catOf(ccnEntry) {
    if (!ccnEntry) return null;
    const code = String(ccnEntry.codeNormalized || ccnEntry.code || "");
    return CATEGORIES.find(c => code.startsWith(c[0])) || null;
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
    const cats = CATEGORIES.slice();
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

    // Build assignments stream: { year, installation, category, sf, projectId }
    const stream = [];
    projs.forEach(p => {
      const defaultYear = projectActivationFY(p, true);
      (p.ccns || []).forEach(a => {
        const c = idx.catalog[a.ccn] || idx.catalog[(a.ccn || "").replace(/\s/g, "")];
        if (!c || c.um !== "SF") return;
        const y = a.scheduledFY ?? defaultYear;
        if (y == null) return;
        const cat = catOf(c);
        if (!cat) return;
        let sf = Number(a.qty) || 0;
        if (basis === "net" && p.projectType === "DEMO") sf = -Math.abs(sf);
        stream.push({ year: Number(y), installation: p.installation || "Unknown", category: cat, sf, projectId: p.id });
      });
      // REPLACEMENT swap: at the replacement activation year, subtract the replaced project's SF assignments (net only)
      if (basis === "net" && p.projectType === "REPLACEMENT" && p.replaces && idx.byId[p.replaces]) {
        const replaced = idx.byId[p.replaces];
        const y = projectActivationFY(p, true);
        if (y != null) {
          (replaced.ccns || []).forEach(a => {
            const c = idx.catalog[a.ccn]; if (!c || c.um !== "SF") return;
            const cat = catOf(c); if (!cat) return;
            stream.push({ year: Number(y), installation: replaced.installation || "Unknown", category: cat, sf: -Math.abs(Number(a.qty) || 0), projectId: p.id + "::replaces::" + replaced.id });
          });
        }
      }
    });

    // Reduce to matrix: rows × cols → sf
    const rows = axis === "install-x-category" ? installs : cats;
    const cols = axis === "install-x-category" ? cats : installs;
    const rowKey = axis === "install-x-category" ? (s) => s.installation : (s) => s.category;
    const colKey = axis === "install-x-category" ? (s) => s.category : (s) => s.installation;
    const mat = {};
    rows.forEach(r => mat[r] = {});
    stream.forEach(s => {
      const applicable = mode === "cumulative" ? s.year <= currentYear : s.year === currentYear;
      if (!applicable) return;
      const rk = rowKey(s), ck = colKey(s);
      if (!mat[rk]) mat[rk] = {};
      mat[rk][ck] = (mat[rk][ck] || 0) + s.sf;
    });

    // Year range
    const years = Array.from(new Set(stream.map(s => s.year))).sort((a,b)=>a-b);
    return { matrix: mat, rows, cols, years, stream };
  }

  function drillDown(stream, row, col, mode, currentYear, axis) {
    const dlg = $("dialog", { class: "detail-dialog" });
    const filtered = stream.filter(s => {
      const applicable = mode === "cumulative" ? s.year <= currentYear : s.year === currentYear;
      if (!applicable) return false;
      if (axis === "install-x-category") return s.installation === row && s.category === col;
      return s.category === row && s.installation === col;
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
    const state = { mode: "cumulative", basis: "net", axis: "install-x-category", currentYear: null, playing: false };

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
        $("button", { class: "seg-btn active", "data-val": "install-x-category", text: "Inst × Cat", onclick: () => { state.axis = "install-x-category"; render(); } }),
        $("button", { class: "seg-btn", "data-val": "category-x-install", text: "Cat × Inst", onclick: () => { state.axis = "category-x-install"; render(); } }),
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
      // Update segmented states
      controls.querySelectorAll(".seg").forEach((g, i) => {
        const val = [state.mode, state.basis, state.axis][i];
        setActiveSeg(g, val);
      });
      const agg = aggregate(store, { mode: state.mode, basis: state.basis, axis: state.axis, currentYear: state.currentYear ?? 0, filter: window.FilterState });
      const years = agg.years.length ? agg.years : [ new Date().getFullYear() ];
      if (state.currentYear == null || state.currentYear < years[0] || state.currentYear > years[years.length - 1]) {
        state.currentYear = years[years.length - 1];
      }
      renderSlider(years);
      // Re-aggregate now that year is set
      const agg2 = aggregate(store, { mode: state.mode, basis: state.basis, axis: state.axis, currentYear: state.currentYear, filter: window.FilterState });
      drawHeatmap(agg2);
      renderSide(agg2);
    }

    function drawHeatmap(agg) {
      gridHost.innerHTML = "";
      const hostW = Math.max(gridHost.clientWidth || 1200, 900);
      const labelW = 170;
      const cellW = Math.max(80, Math.floor((hostW - labelW - 40) / Math.max(1, agg.cols.length)));
      const cellH = 56;
      const width = labelW + agg.cols.length * cellW + 40;
      const height = 44 + agg.rows.length * cellH + 20;
      const svg = window.d3.select(gridHost).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "none").attr("width", "100%").attr("height", String(height)).attr("class", "hm-svg");
      let maxAbs = 0;
      agg.rows.forEach(r => agg.cols.forEach(c => { maxAbs = Math.max(maxAbs, Math.abs(agg.matrix[r]?.[c] || 0)); }));
      const pos = window.d3.scaleSequential(window.d3.interpolateBlues).domain([0, maxAbs || 1]);
      const neg = window.d3.scaleSequential(window.d3.interpolateReds).domain([0, maxAbs || 1]);
      // Column headers
      agg.cols.forEach((c, i) => {
        const label = state.axis === "install-x-category" ? (CATEGORY_LABEL[c] || c) : c;
        svg.append("text").attr("x", labelW + i * cellW + cellW / 2).attr("y", 28).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 600).attr("fill", "#1B2535").text(label);
      });
      agg.rows.forEach((r, rIdx) => {
        const label = state.axis === "install-x-category" ? r : (CATEGORY_LABEL[r] || r);
        svg.append("text").attr("x", labelW - 10).attr("y", 44 + rIdx * cellH + cellH / 2 + 4).attr("text-anchor", "end").attr("font-size", 12).attr("font-weight", 600).attr("fill", "#1B2535").text(label);
        agg.cols.forEach((c, cIdx) => {
          const v = agg.matrix[r]?.[c] || 0;
          const color = v === 0 ? "#EDF0F4" : (v > 0 ? pos(Math.abs(v)) : neg(Math.abs(v)));
          svg.append("rect")
            .attr("x", labelW + cIdx * cellW + 3).attr("y", 44 + rIdx * cellH + 3)
            .attr("width", cellW - 6).attr("height", cellH - 6)
            .attr("rx", 4).attr("fill", color)
            .attr("stroke", "#CDD5DE").attr("stroke-width", 0.5)
            .attr("data-tip", `${r} / ${c}: ${Math.round(v).toLocaleString()} SF`)
            .style("cursor", "pointer")
            .on("click", () => drillDown(agg.stream, r, c, state.mode, state.currentYear, state.axis));
          if (Math.abs(v) >= 1) {
            svg.append("text").attr("x", labelW + cIdx * cellW + cellW / 2).attr("y", 44 + rIdx * cellH + cellH / 2 + 5)
              .attr("text-anchor", "middle").attr("font-size", 13).attr("font-weight", 700)
              .attr("fill", Math.abs(v) > maxAbs * 0.5 ? "#fff" : "#1B2535")
              .text(Math.round(v / 1000) + "k");
          } else if (v === 0) {
            svg.append("text").attr("x", labelW + cIdx * cellW + cellW / 2).attr("y", 44 + rIdx * cellH + cellH / 2 + 4)
              .attr("text-anchor", "middle").attr("font-size", 10).attr("fill", "#8A98A8").text("-");
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
      side.appendChild($("h3", { class: "section-h3", text: `Projects delivering by FY${state.currentYear}` }));
      const progs = {}; store.listPrograms().forEach(p => progs[p.id] = p);
      const delivering = store.getProjects().filter(p => {
        const y = projectActivationFY(p, true);
        if (y == null) return false;
        return state.mode === "cumulative" ? y <= state.currentYear : y === state.currentYear;
      });
      if (!delivering.length) { side.appendChild($("div", { class: "u-muted", text: "No projects in scope for this year." })); return; }
      const grouped = {};
      delivering.forEach(p => { const inst = p.installation || "Unknown"; grouped[inst] = grouped[inst] || []; grouped[inst].push(p); });
      Object.entries(grouped).sort().forEach(([inst, list]) => {
        side.appendChild($("h4", { class: "section-h4", text: `${inst} (${list.length})` }));
        const ul = $("ul", { class: "side-list" });
        list.slice(0, 30).forEach(p => {
          const u = progs[p.program]?.umbrella || "Other";
          ul.appendChild($("li", {}, [
            $("span", { class: "chip chip-small", style: `background:${progs[p.program]?.color || "#546270"}1a;color:${progs[p.program]?.color || "#546270"}`, text: u }),
            document.createTextNode(" "),
            $("span", { text: p.title || p.id })
          ]));
        });
        if (list.length > 30) ul.appendChild($("li", { class: "u-muted", text: `…and ${list.length - 30} more` }));
        side.appendChild(ul);
      });
    }

    render();
    const onF = () => render(); const onC = () => render();
    document.addEventListener("filter-change", onF); store.on("change", onC);
    const mo = new MutationObserver(() => { if (!document.body.contains(container)) { document.removeEventListener("filter-change", onF); store.off("change", onC); if (playInt) clearInterval(playInt); mo.disconnect(); } });
    mo.observe(container.parentNode || document.body, { childList: true });
  };
})();
