/* overview.js — KPI cards + per-umbrella summary + todo list. */
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
    (children || []).forEach(c => el.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return el;
  };
  const fmtCur = (n) => (n == null || isNaN(n)) ? "—" : "$" + Math.round(n).toLocaleString("en-US");
  const fmtSF = (n) => (n == null || isNaN(n)) ? "0" : Math.round(n).toLocaleString("en-US") + " SF";
  const fmtInt = (n) => Number(n || 0).toLocaleString("en-US");

  function aggregate(store) {
    const projects = store.getProjects();
    const catalog = {}; (store.listCCNs?.() || []).forEach(c => { catalog[c.codeNormalized || c.code] = c; });
    const umbrellas = { DPRI: 0, "12th MLR": 0, "3/12": 0, Other: 0 };
    let totalCost = 0, totalSF = 0, withBOD = 0, missingCCN = 0;
    const progMeta = {}; store.listPrograms().forEach(p => progMeta[p.id] = p);
    projects.forEach(p => {
      const u = progMeta[p.program]?.umbrella || "Other";
      umbrellas[u] = (umbrellas[u] || 0) + 1;
      if (p.totalCost) totalCost += p.totalCost;
      else if (p.fyPlan) totalCost += Object.values(p.fyPlan).reduce((a, b) => a + (b || 0), 0);
      const sf = (p.ccns || []).reduce((acc, a) => {
        const c = catalog[a.ccn] || catalog[(a.ccn || "").replace(/\s/g, "")];
        return acc + (c && c.um === "SF" ? (a.qty || 0) : 0);
      }, 0);
      totalSF += sf;
      const bod = p.bodFYOverride ?? p.bodFY ?? null;
      if (bod != null) withBOD++;
      if (!p.ccns || p.ccns.length === 0) missingCCN++;
    });
    return { projects, umbrellas, totalCost, totalSF, withBOD, missingCCN, progMeta };
  }

  function card(label, value, sub, onClick) {
    const c = $("div", { class: "kpi-card" + (onClick ? " kpi-clickable" : ""), onclick: onClick || null }, [
      $("div", { class: "kpi-label", text: label }),
      $("div", { class: "kpi-value", text: value }),
      sub ? $("div", { class: "kpi-sub u-muted", text: sub }) : null
    ]);
    return c;
  }

  function bodSparkline(projects) {
    const byYear = {};
    projects.forEach(p => {
      const y = p.bodFYOverride ?? p.bodFY ?? null;
      if (y != null) byYear[y] = (byYear[y] || 0) + 1;
    });
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    if (!years.length) return $("div", { class: "u-muted", text: "No BOD data." });
    const max = Math.max(...Object.values(byYear));
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${years.length * 28} 80`);
    svg.setAttribute("class", "sparkline");
    years.forEach((y, i) => {
      const v = byYear[y]; const h = Math.round((v / max) * 60);
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("x", i * 28 + 4); r.setAttribute("y", 70 - h); r.setAttribute("width", 20); r.setAttribute("height", h);
      r.setAttribute("fill", "#2E91AE"); r.setAttribute("data-tip", `FY${y}: ${v} projects BOD`);
      svg.appendChild(r);
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", i * 28 + 14); t.setAttribute("y", 78); t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "9"); t.setAttribute("fill", "#546270");
      t.textContent = String(y).slice(2);
      svg.appendChild(t);
    });
    return svg;
  }

  window.Sections.overview = function (container) {
    const store = window.DataStore;
    container.innerHTML = "";
    const render = () => {
      const agg = aggregate(store);
      container.innerHTML = "";

      const go = (sec, filter) => { Object.assign(window.FilterState || {}, filter || {}); if (window.Shell) window.Shell.go(sec); };

      const cards = $("div", { class: "kpi-grid" }, [
        card("Total projects", fmtInt(agg.projects.length),
          `DPRI ${agg.umbrellas.DPRI} · 12th MLR ${agg.umbrellas["12th MLR"]} · 3/12 ${agg.umbrellas["3/12"]} · Other ${agg.umbrellas.Other}`,
          () => go("projects")),
        card("Total cost (where set)", fmtCur(agg.totalCost), "Sum of totalCost + fyPlan", () => go("projects")),
        card("CCN square footage", fmtSF(agg.totalSF), "Across all assigned CCNs (UM=SF)", () => go("heatmap")),
        card("Projects with BOD set", `${agg.withBOD} / ${agg.projects.length}`, `${Math.round(100 * agg.withBOD / Math.max(1, agg.projects.length))}% coverage`, () => go("projects")),
        card("Projects missing CCN data", fmtInt(agg.missingCCN), "Add assignments to light them up on the heatmap", () => go("assignment")),
      ]);
      container.appendChild(cards);

      container.appendChild($("h3", { class: "section-h3", text: "Beneficial Occupancy by FY" }));
      container.appendChild(bodSparkline(agg.projects));

      // Program × Installation table
      const installs = store.listInstallations();
      const progs = store.listPrograms();
      const matrix = {};
      agg.projects.forEach(p => {
        const u = agg.progMeta[p.program]?.umbrella || "Other";
        const i = p.installation || "Unknown";
        matrix[u] = matrix[u] || {};
        matrix[u][i] = (matrix[u][i] || 0) + 1;
      });
      const tbl = $("table", { class: "summary-table" });
      const thead = $("thead"), trh = $("tr"); trh.appendChild($("th", { text: "Umbrella / Installation" }));
      installs.forEach(i => trh.appendChild($("th", { text: i.name })));
      trh.appendChild($("th", { text: "Total" }));
      thead.appendChild(trh); tbl.appendChild(thead);
      const tbody = $("tbody");
      ["DPRI", "12th MLR", "3/12", "Other"].forEach(u => {
        const tr = $("tr"); tr.appendChild($("td", { class: "u-strong", text: u }));
        let total = 0;
        installs.forEach(i => {
          const c = (matrix[u] && matrix[u][i.name]) || 0;
          total += c;
          tr.appendChild($("td", { text: c ? String(c) : "" }));
        });
        tr.appendChild($("td", { class: "u-strong", text: String(total) }));
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      container.appendChild($("h3", { class: "section-h3", text: "Projects by Umbrella × Installation" }));
      container.appendChild(tbl);

      // Next actions
      container.appendChild($("h3", { class: "section-h3", text: "Suggested next actions" }));
      const nextList = $("ul", { class: "next-list" });
      if (agg.missingCCN) nextList.appendChild($("li", {}, [document.createTextNode(`${agg.missingCCN} projects have no CCN assignments — `), $("a", { href: "#assignment", text: "start assigning", onclick: (e) => { e.preventDefault(); go("assignment"); } })]));
      const noBod = agg.projects.filter(p => (p.bodFYOverride ?? p.bodFY) == null).length;
      if (noBod) nextList.appendChild($("li", { text: `${noBod} projects have no BOD FY set — set bodFYOverride so they appear in the heatmap.` }));
      const unk = agg.projects.filter(p => p.unknownInstallation).length;
      if (unk) nextList.appendChild($("li", { text: `${unk} projects are on an Unknown installation (mostly SACO orphans) — reassign to a real camp.` }));
      if (!nextList.children.length) nextList.appendChild($("li", { text: "Nothing flagged. Good shape." }));
      container.appendChild(nextList);
    };
    render();
    const onChange = () => render();
    store.on("change", onChange);
    const mo = new MutationObserver(() => { if (!document.body.contains(container)) { store.off("change", onChange); mo.disconnect(); } });
    mo.observe(container.parentNode || document.body, { childList: true });
  };
})();
