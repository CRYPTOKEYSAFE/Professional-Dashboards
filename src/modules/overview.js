/* overview.js - DPRI-style horizontal KPI strip with phase grid + installation burst + activation timeline. */
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
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs) => {
    const el = document.createElementNS(svgNS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  const fmtCur = (n) => (n == null || isNaN(n)) ? "0" : "$" + Math.round(n).toLocaleString("en-US");
  const fmtCurShort = (n) => {
    if (n == null || isNaN(n) || n === 0) return "$0";
    const a = Math.abs(n);
    if (a >= 1e9) return "$" + (n / 1e9).toFixed(1) + "B";
    if (a >= 1e6) return "$" + (n / 1e6).toFixed(0) + "M";
    if (a >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
    return "$" + n;
  };
  const fmtSF = (n) => (n == null || isNaN(n)) ? "0" : Math.round(n).toLocaleString("en-US");
  const fmtInt = (n) => Number(n || 0).toLocaleString("en-US");

  function aggregate(store) {
    const filter = window.FilterState || {};
    const projects = store.getProjects({
      umbrella: filter.umbrella || undefined,
      installation: filter.installation || undefined,
      search: filter.search || undefined
    });
    const catalog = {}; (store.listCCNs?.() || []).forEach(c => { catalog[c.codeNormalized || c.code] = c; });
    const umbrellas = { DPRI: 0, "12th MLR": 0, "3/12": 0, Other: 0 };
    const phaseCounts = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0 };
    const installCounts = {};
    let totalCost = 0, totalSF = 0, withActivation = 0, missingCCN = 0;
    let activMinYear = Infinity, activMaxYear = -Infinity;
    const progMeta = {}; store.listPrograms().forEach(p => progMeta[p.id] = p);
    projects.forEach(p => {
      const u = progMeta[p.program]?.umbrella || "Other";
      umbrellas[u] = (umbrellas[u] || 0) + 1;
      if (p.phase != null && phaseCounts[p.phase] != null) phaseCounts[p.phase]++;
      const inst = p.installation || "SACO";
      installCounts[inst] = (installCounts[inst] || 0) + 1;
      if (p.totalCost) totalCost += p.totalCost;
      else if (p.fyPlan) totalCost += Object.values(p.fyPlan).reduce((a, b) => a + (b || 0), 0);
      (p.ccns || []).forEach(a => {
        const c = catalog[a.ccn] || catalog[(a.ccn || "").replace(/\s/g, "")];
        if (c && c.um === "SF") totalSF += a.qty || 0;
      });
      const bod = p.activationFYOverride ?? p.activationFY ?? null;
      if (bod != null) {
        withActivation++;
        if (bod < activMinYear) activMinYear = bod;
        if (bod > activMaxYear) activMaxYear = bod;
      }
      if (!p.ccns || p.ccns.length === 0) missingCCN++;
    });
    if (!isFinite(activMinYear)) activMinYear = null;
    if (!isFinite(activMaxYear)) activMaxYear = null;
    return { projects, umbrellas, phaseCounts, installCounts, totalCost, totalSF, withActivation, missingCCN, progMeta, activMinYear, activMaxYear };
  }

  function phaseGrid(phaseCounts) {
    const wrap = $("div", { class: "ov-phase" });
    wrap.appendChild($("div", { class: "ov-chart-lbl", text: "Phase Distribution" }));
    const host = $("div", { class: "ov-phase-grid" });
    const max = Math.max(1, ...Object.values(phaseCounts));
    for (let i = 0; i <= 5; i++) {
      const v = phaseCounts[i] || 0;
      const pct = (v / max) * 100;
      const col = $("div", { class: "ov-phase-col", "data-tip": `Phase ${i}: ${v} projects` }, [
        $("div", { class: "ov-phase-val", text: String(v) }),
        $("div", { class: "ov-phase-track" }, [
          $("div", { class: "ov-phase-bar", style: `height:${Math.max(2, pct)}%` })
        ]),
        $("div", { class: "ov-phase-lbl", text: "P" + i })
      ]);
      host.appendChild(col);
    }
    wrap.appendChild(host);
    return wrap;
  }

  function installBurst(installCounts, installs) {
    const wrap = $("div", { class: "ov-burst" });
    wrap.appendChild($("div", { class: "ov-chart-lbl", text: "By Installation" }));
    const ordered = installs.map(i => [i.name, installCounts[i.name] || 0, i.color]);
    const total = ordered.reduce((a, [,v]) => a + v, 0) || 1;
    const s = svg("svg", { viewBox: "0 0 90 90", class: "ov-burst-svg" });
    const cx = 45, cy = 45, r = 36, rInner = 14;
    let acc = 0;
    ordered.forEach(([name, v, color]) => {
      if (!v) return;
      const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((acc + v) / total) * Math.PI * 2 - Math.PI / 2;
      const large = (a1 - a0) > Math.PI ? 1 : 0;
      const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r];
      const p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
      const pi1 = [cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner];
      const pi0 = [cx + Math.cos(a0) * rInner, cy + Math.sin(a0) * rInner];
      const d = `M${p0[0]} ${p0[1]} A${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]} L${pi1[0]} ${pi1[1]} A${rInner} ${rInner} 0 ${large} 0 ${pi0[0]} ${pi0[1]} Z`;
      const path = svg("path", { d, fill: color || "#546270" });
      path.setAttribute("data-tip", `${name}: ${v} (click to filter)`);
      path.style.cursor = "pointer";
      path.addEventListener("click", () => {
        const f = window.FilterState || (window.FilterState = {});
        f.installation = f.installation === name ? null : name;
        document.dispatchEvent(new CustomEvent("filter-change", { detail: Object.assign({}, f) }));
      });
      s.appendChild(path);
      acc += v;
    });
    const legend = $("div", { class: "ov-burst-legend" },
      ordered.filter(([,v]) => v).map(([name, v, color]) => {
        const row = $("div", { class: "ov-burst-leg", "data-tip": `Click to filter to ${name}` }, [
          $("span", { class: "ov-burst-dot", style: `background:${color}` }),
          $("span", { class: "ov-burst-name", text: name.replace("Camp ", "") }),
          $("span", { class: "ov-burst-ct", text: String(v) })
        ]);
        row.style.cursor = "pointer";
        row.addEventListener("click", () => {
          const f = window.FilterState || (window.FilterState = {});
          f.installation = f.installation === name ? null : name;
          document.dispatchEvent(new CustomEvent("filter-change", { detail: Object.assign({}, f) }));
        });
        return row;
      }));
    const row = $("div", { class: "ov-burst-row" }, [s, legend]);
    wrap.appendChild(row);
    return wrap;
  }

  function bodTimeline(projects) {
    const byYear = {};
    projects.forEach(p => {
      const y = p.activationFYOverride ?? p.activationFY ?? null;
      if (y != null) byYear[y] = (byYear[y] || 0) + 1;
    });
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    if (!years.length) return $("div", { class: "u-muted", text: "No activation dates on projects yet." });
    const minY = years[0], maxY = years[years.length - 1];
    const full = [];
    for (let y = minY; y <= maxY; y++) full.push([y, byYear[y] || 0]);
    const max = Math.max(1, ...full.map(([,v]) => v));
    const wrap = $("div", { class: "ov-timeline-wrap" });
    const h = 110, leftPad = 32, rightPad = 14, topPad = 10, botPad = 26;
    const s = svg("svg", { viewBox: `0 0 1000 ${h}`, preserveAspectRatio: "xMidYMid meet", class: "ov-timeline-svg" });
    s.setAttribute("height", String(h));
    const plotW = 1000 - leftPad - rightPad;
    const plotH = h - topPad - botPad;
    const bw = plotW / full.length;
    // grid lines
    for (let i = 0; i <= 4; i++) {
      const yy = topPad + (plotH * i / 4);
      s.appendChild(svg("line", { x1: leftPad, x2: 1000 - rightPad, y1: yy, y2: yy, stroke: "#E4E9EF", "stroke-width": 1 }));
    }
    // y-axis labels
    [0, max].forEach((v, i) => {
      const yy = topPad + plotH * (1 - i);
      const t = svg("text", { x: leftPad - 6, y: yy + 3, "text-anchor": "end", "font-size": 10, fill: "#546270" });
      t.textContent = String(v);
      s.appendChild(t);
    });
    full.forEach(([y, v], i) => {
      const bh = (v / max) * plotH;
      const x = leftPad + i * bw + bw * 0.15;
      const w = bw * 0.7;
      const yy = topPad + (plotH - bh);
      const rect = svg("rect", { x, y: yy, width: w, height: bh, fill: v > 0 ? "#2E91AE" : "#EDF0F4", rx: 2 });
      rect.setAttribute("data-tip", `FY${y}: ${v} project${v === 1 ? "" : "s"} activating`);
      s.appendChild(rect);
      if (i % Math.max(1, Math.floor(full.length / 24)) === 0 || y === minY || y === maxY) {
        const t = svg("text", { x: x + w/2, y: h - botPad + 14, "text-anchor": "middle", "font-size": 10, fill: "#546270" });
        t.textContent = String(y).slice(-2);
        s.appendChild(t);
      }
      if (v > 0) {
        const tv = svg("text", { x: x + w/2, y: yy - 3, "text-anchor": "middle", "font-size": 9, fill: "#1B2535", "font-weight": 600 });
        tv.textContent = String(v);
        s.appendChild(tv);
      }
    });
    // x-axis title
    const ax = svg("text", { x: 1000/2, y: h - 4, "text-anchor": "middle", "font-size": 10, fill: "#546270" });
    ax.textContent = `Fiscal Year (${minY} to ${maxY})`;
    s.appendChild(ax);
    wrap.appendChild(s);
    return wrap;
  }

  window.Sections.overview = function (container) {
    const store = window.DataStore;
    container.innerHTML = "";
    const render = () => {
      const agg = aggregate(store);
      container.innerHTML = "";

      const go = (sec, filter) => { Object.assign(window.FilterState || {}, filter || {}); if (window.Shell) window.Shell.go(sec); };

      // KPI bar - DPRI-style horizontal strip
      const bar = $("div", { class: "ov-kpi-bar" });
      const kpi = (cls, val, lbl, sub, tip, onClick) => {
        const el = $("div", { class: "ov-kpi " + (cls||"") + (onClick ? " clickable" : ""), "data-tip": tip || "", onclick: onClick || null }, [
          $("div", { class: "ov-kpi-val", text: val }),
          $("div", { class: "ov-kpi-lbl", text: lbl }),
          sub ? $("div", { class: "ov-kpi-sub", text: sub }) : null
        ]);
        return el;
      };
      bar.appendChild(kpi("", fmtInt(agg.projects.length), "Total Projects",
        `DPRI ${agg.umbrellas.DPRI} · 12th MLR ${agg.umbrellas["12th MLR"]} · 3/12 ${agg.umbrellas["3/12"]} · Other ${agg.umbrellas.Other}`,
        "All projects across all programs", () => go("projects")));
      bar.appendChild($("div", { class: "ov-kpi-sep" }));
      const span = (agg.activMinYear && agg.activMaxYear) ? (agg.activMaxYear - agg.activMinYear) + " yr" : "-";
      const spanSub = (agg.activMinYear && agg.activMaxYear) ? `FY${agg.activMinYear} to FY${agg.activMaxYear}` : "set activation dates";
      bar.appendChild(kpi("", span, "Schedule Span", spanSub, "Activation finish: earliest to latest"));
      bar.appendChild($("div", { class: "ov-kpi-sep" }));
      bar.appendChild(kpi("", fmtCurShort(agg.totalCost), "Programmed Cost", "total + FY plan", "Cost programmed across all projects", () => go("projects")));
      bar.appendChild($("div", { class: "ov-kpi-sep" }));
      bar.appendChild(kpi("", fmtSF(agg.totalSF), "CCN Sq Ft", agg.totalSF === 0 ? "no CCN data yet" : "from CCN assignments", "Sum of SF from all CCN assignments", () => go("heatmap")));
      bar.appendChild($("div", { class: "ov-kpi-sep" }));
      bar.appendChild(kpi("", `${agg.withActivation} of ${agg.projects.length}`, "Activation FY Entered", `${Math.round(100 * agg.withActivation / Math.max(1, agg.projects.length))}% have an activation fiscal year set`, "Projects that have either a DPRI Activation Finish date or an Activation FY override entered", () => go("projects")));
      bar.appendChild($("div", { class: "ov-kpi-sep" }));
      bar.appendChild(kpi("warn", fmtInt(agg.missingCCN), "No CCNs", "pending assignment", "Projects that need CCN data entered", () => go("assignment")));
      bar.appendChild($("div", { class: "ov-kpi-sep" }));
      bar.appendChild(phaseGrid(agg.phaseCounts));
      bar.appendChild($("div", { class: "ov-kpi-sep" }));
      bar.appendChild(installBurst(agg.installCounts, store.listInstallations()));
      container.appendChild(bar);

      // Activation timeline - full width
      const tlSection = $("section", { class: "ov-section" }, [
        $("h3", { class: "ov-section-h", text: "Activation Finish by Fiscal Year" }),
        bodTimeline(agg.projects)
      ]);
      container.appendChild(tlSection);

      // Program × Installation matrix
      const installs = store.listInstallations();
      const progs = store.listPrograms();
      const matrix = {};
      agg.projects.forEach(p => {
        const u = agg.progMeta[p.program]?.umbrella || "Other";
        const i = p.installation || "SACO";
        matrix[u] = matrix[u] || {};
        matrix[u][i] = (matrix[u][i] || 0) + 1;
      });
      const tbl = $("table", { class: "ov-matrix" });
      const thead = $("thead"), trh = $("tr");
      trh.appendChild($("th", { text: "Program" }));
      installs.forEach(i => trh.appendChild($("th", { text: i.name.replace("Camp ", "") })));
      trh.appendChild($("th", { text: "Total" }));
      thead.appendChild(trh); tbl.appendChild(thead);
      const tbody = $("tbody");
      const setFilter = (umbrella, installation) => {
        const f = window.FilterState || (window.FilterState = {});
        f.umbrella = umbrella;
        f.installation = installation;
        document.dispatchEvent(new CustomEvent("filter-change", { detail: Object.assign({}, f) }));
        go("projects");
      };
      ["DPRI", "12th MLR", "3/12", "Other"].forEach(u => {
        const tr = $("tr");
        const umbCell = $("td", { class: "u-strong ov-matrix-clickable", "data-tip": `Filter to ${u} projects`, text: u });
        umbCell.addEventListener("click", () => setFilter(u, null));
        tr.appendChild(umbCell);
        let total = 0;
        installs.forEach(i => {
          const c = (matrix[u] && matrix[u][i.name]) || 0;
          total += c;
          const td = $("td", { class: c ? "ov-matrix-clickable" : "", "data-tip": c ? `Filter to ${u} on ${i.name}` : "", text: c ? String(c) : "" });
          if (c) td.addEventListener("click", () => setFilter(u, i.name));
          tr.appendChild(td);
        });
        const totalCell = $("td", { class: "u-strong" + (total ? " ov-matrix-clickable" : ""), "data-tip": total ? `Filter to ${u} across all installations` : "", text: String(total) });
        if (total) totalCell.addEventListener("click", () => setFilter(u, null));
        tr.appendChild(totalCell);
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      const matrixSection = $("section", { class: "ov-section" }, [
        $("h3", { class: "ov-section-h", text: "Projects by Program and Installation" }),
        $("div", { class: "ov-section-hint u-muted", text: "Click any count to filter Projects to that Program and Installation." }),
        tbl
      ]);
      container.appendChild(matrixSection);

      // Open Items
      const openList = $("ul", { class: "ov-open-list" });
      if (agg.missingCCN) openList.appendChild($("li", {}, [
        $("span", { class: "ov-open-ct", text: String(agg.missingCCN) }),
        document.createTextNode(" projects lack CCN assignments. "),
        $("a", { href: "#assignment", onclick: (e) => { e.preventDefault(); go("assignment"); }, text: "Open Assignment view." })
      ]));
      const noBod = agg.projects.filter(p => (p.activationFYOverride ?? p.activationFY) == null).length;
      if (noBod) openList.appendChild($("li", {}, [
        $("span", { class: "ov-open-ct", text: String(noBod) }),
        document.createTextNode(" projects have no Activation FY set. "),
        $("a", { href: "#projects", onclick: (e) => { e.preventDefault(); go("projects"); }, text: "Open Projects to set A Finish FY per row." })
      ]));
      const unk = agg.projects.filter(p => p.unknownInstallation).length;
      if (unk) openList.appendChild($("li", {}, [
        $("span", { class: "ov-open-ct", text: String(unk) }),
        document.createTextNode(" projects tagged SACO (program level, site pending). Reassign in Projects view.")
      ]));
      if (!openList.children.length) openList.appendChild($("li", { class: "u-muted", text: "No open items." }));
      container.appendChild($("section", { class: "ov-section" }, [
        $("h3", { class: "ov-section-h", text: "Open Items" }),
        openList
      ]));
    };
    render();
    const onChange = () => render();
    store.on("change", onChange);
    document.addEventListener("filter-change", onChange);
    const mo = new MutationObserver(() => { if (!document.body.contains(container)) { store.off("change", onChange); document.removeEventListener("filter-change", onChange); mo.disconnect(); } });
    mo.observe(container.parentNode || document.body, { childList: true });
  };
})();
