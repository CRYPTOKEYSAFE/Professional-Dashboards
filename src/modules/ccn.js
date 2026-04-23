/* ccn.js — CCN Catalog view, CCN Assignment manager, and a sub-grid for per-project assignments. */
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

  function catalogIndex(store) {
    const m = {};
    (store.listCCNs?.() || []).forEach(c => { m[c.codeNormalized || c.code] = c; });
    return m;
  }

  // --- CCN Catalog section ---
  window.Sections.ccns = function (container) {
    const store = window.DataStore;
    container.innerHTML = "";
    const toolbar = $("div", { class: "grid-toolbar" }, [
      $("button", { class: "btn btn-primary", text: "+ Add CCN", onclick: () => openAddCcn(store) }),
      $("input", { type: "search", class: "search-inp", placeholder: "Search CCN code, title, category…", oninput: (e) => { state.q = e.target.value.toLowerCase(); render(); } }),
      $("div", { class: "u-grow" }),
      $("span", { id: "ccn-count", class: "u-muted" })
    ]);
    const host = $("div", { id: "ccn-grid", class: "grid-host" });
    container.appendChild(toolbar); container.appendChild(host);

    const state = { q: "" };
    let tbl = null;

    function data() {
      const all = store.listCCNs ? store.listCCNs() : [];
      if (!state.q) return all;
      return all.filter(c => (c.code || "").toLowerCase().includes(state.q) || (c.title || "").toLowerCase().includes(state.q) || (c.category || "").toLowerCase().includes(state.q) || (c.um || "").toLowerCase().includes(state.q));
    }

    function render() {
      const d = data();
      document.getElementById("ccn-count").textContent = `${d.length} CCNs`;
      if (!tbl) {
        tbl = new window.Tabulator(host, {
          data: d,
          layout: "fitDataStretch",
          height: "calc(100vh - 260px)",
          pagination: true, paginationSize: 100,
          columns: [
            { title: "Code", field: "code", width: 100, headerFilter: "input" },
            { title: "Title", field: "title", widthGrow: 3, headerFilter: "input", editor: "input" },
            { title: "UM", field: "um", width: 70, headerFilter: "input", editor: "input" },
            { title: "Category", field: "category", widthGrow: 2, headerFilter: "input",
              formatter: (cell) => {
                const v = cell.getValue() || "";
                const series = (v.match(/^(\d{3})/) || [])[1] || "";
                const color = seriesColor(series);
                return `<span class="chip" style="background:${color}1a;color:${color};border-color:${color}4d">${v}</span>`;
              } },
            { title: "Sub-category", field: "subCategory", widthGrow: 3, formatter: (cell) => {
              const v = cell.getValue() || ""; const short = v.length > 80 ? v.slice(0, 80) + "…" : v;
              return `<span data-tip="${v.replace(/"/g, "'")}">${short}</span>`;
            } },
            { title: "", field: "_actions", width: 80, headerSort: false,
              formatter: () => "<span class='row-act' title='Delete'>✕</span>",
              cellClick: (e, cell) => {
                const row = cell.getRow().getData();
                if (e.target.getAttribute("title") === "Delete") deleteCcn(row.code, store);
              } }
          ],
          cellEdited: (cell) => {
            const row = cell.getRow().getData();
            store.upsertCCN(row);
          }
        });
      } else {
        tbl.replaceData(d);
      }
    }

    function deleteCcn(code, store) {
      const refs = (store.getProjects() || []).flatMap(p => (p.ccns || []).filter(a => a.ccn === code).map(a => p.id));
      if (refs.length && !confirm(`CCN ${code} is referenced by ${refs.length} project assignment(s). Delete anyway?`)) return;
      store.deleteCCN && store.deleteCCN(code);
    }

    render();
    const onC = () => render();
    store.on("change", onC);
    const mo = new MutationObserver(() => { if (!document.body.contains(container)) { store.off("change", onC); mo.disconnect(); } });
    mo.observe(container.parentNode || document.body, { childList: true });
  };

  function seriesColor(series) {
    const s = series?.[0];
    return { "1": "#1E3F5C", "2": "#7A5900", "3": "#3A3A9E", "4": "#0B6E4F", "5": "#8C2B0B", "6": "#546270", "7": "#2E91AE", "8": "#5A0B8C", "9": "#0F5E3A" }[s] || "#546270";
  }

  function openAddCcn(store) {
    const dlg = $("dialog", { class: "detail-dialog" });
    const form = $("div", { class: "det-fields" }, [
      $("label", {}, [$("span", { text: "Code" }), $("input", { id: "ccn-new-code", placeholder: "e.g. 21410" })]),
      $("label", {}, [$("span", { text: "Title" }), $("input", { id: "ccn-new-title" })]),
      $("label", {}, [$("span", { text: "UM" }), $("input", { id: "ccn-new-um", placeholder: "SF / EA / LF" })]),
      $("label", {}, [$("span", { text: "Category" }), $("input", { id: "ccn-new-cat", placeholder: "200 — Maintenance and Production Facilities" })]),
    ]);
    const save = $("button", { class: "btn btn-primary", text: "Add", onclick: () => {
      const code = document.getElementById("ccn-new-code").value.trim();
      if (!code) { alert("Code required"); return; }
      const existing = store.getCCN(code);
      if (existing) { alert("CCN already exists"); return; }
      store.upsertCCN({
        code, codeNormalized: code.replace(/\s/g, ""),
        title: document.getElementById("ccn-new-title").value.trim(),
        um: document.getElementById("ccn-new-um").value.trim() || "SF",
        category: document.getElementById("ccn-new-cat").value.trim(),
        subCategory: "", description: "", planningFactor: null, sourcePage: null,
      });
      dlg.close(); dlg.remove();
    } });
    dlg.appendChild($("div", { class: "det-head" }, [$("strong", { text: "Add CCN" })]));
    dlg.appendChild($("div", { class: "det-body" }, [form]));
    dlg.appendChild($("div", { class: "det-foot" }, [save, $("button", { class: "btn", text: "Cancel", onclick: () => { dlg.close(); dlg.remove(); } })]));
    document.body.appendChild(dlg); dlg.showModal();
  }

  // --- CCN Assignment section (also used as sub-grid inside project detail) ---
  function renderAssignmentPanel(container, projectId) {
    const store = window.DataStore;
    const cat = catalogIndex(store);
    container.innerHTML = "";
    const p = store.getProject(projectId);
    if (!p) { container.appendChild($("div", { class: "u-muted", text: "Select a project." })); return; }

    const toolbar = $("div", { class: "grid-toolbar" }, [
      $("strong", { text: p.title || p.id }),
      $("span", { class: "u-muted", text: `${p.installation || ""} · ${p.program || ""}` }),
      $("div", { class: "u-grow" }),
      $("button", { class: "btn btn-primary", text: "+ Add assignment", onclick: addRow }),
      $("button", { class: "btn", text: "Paste from spreadsheet…", onclick: openBulkPaste })
    ]);
    container.appendChild(toolbar);

    const host = $("div", { class: "ccn-asgn-grid" });
    container.appendChild(host);

    function addRow() {
      const ass = (p.ccns || []).slice();
      ass.push({ ccn: "", qty: 0, scheduledFY: p.bodFYOverride ?? p.bodFY ?? null, note: "" });
      store.upsertProject(Object.assign({}, p, { ccns: ass }));
    }

    function openBulkPaste() {
      const dlg = $("dialog", { class: "paste-dialog" });
      const textarea = $("textarea", { rows: 10, placeholder: "Paste TSV/CSV with headers: ccn,qty,scheduledFY,note" });
      const preview = $("div", { class: "paste-preview u-muted", text: "Paste above to preview." });
      let parsed = null;
      textarea.addEventListener("input", () => {
        const txt = textarea.value.trim();
        if (!txt) { preview.textContent = "Paste above to preview."; return; }
        const r = window.Papa.parse(txt, { header: true, skipEmptyLines: true, dynamicTyping: true });
        parsed = r.data;
        preview.textContent = `${parsed.length} rows parsed; columns: ${r.meta.fields.join(", ")}`;
      });
      const apply = $("button", { class: "btn btn-primary", text: "Apply", onclick: () => {
        if (!parsed || !parsed.length) return;
        const current = store.getProject(projectId);
        const merged = (current.ccns || []).slice();
        parsed.forEach(row => merged.push({ ccn: String(row.ccn || "").trim(), qty: Number(row.qty) || 0, scheduledFY: row.scheduledFY ? Number(row.scheduledFY) : null, note: row.note || "" }));
        store.upsertProject(Object.assign({}, current, { ccns: merged }));
        dlg.close(); dlg.remove();
      } });
      dlg.appendChild($("div", { class: "det-head" }, [$("strong", { text: "Bulk add CCN assignments" })]));
      dlg.appendChild($("div", { class: "det-body" }, [textarea, preview]));
      dlg.appendChild($("div", { class: "det-foot" }, [apply, $("button", { class: "btn", text: "Cancel", onclick: () => { dlg.close(); dlg.remove(); } })]));
      document.body.appendChild(dlg); dlg.showModal();
    }

    function render() {
      const current = store.getProject(projectId);
      host.innerHTML = "";
      const tbl = $("table", { class: "asgn-table" });
      tbl.appendChild($("thead", {}, [$("tr", {}, ["CCN", "Title", "UM", "Qty", "Scheduled FY", "Note", ""].map(h => $("th", { text: h })))]));
      const tbody = $("tbody");
      const list = current.ccns || [];
      if (!list.length) tbody.appendChild($("tr", {}, [$("td", { class: "u-muted", colspan: "7", text: "No CCN assignments yet. Click + Add assignment." })]));
      list.forEach((a, idx) => {
        const entry = cat[a.ccn] || cat[(a.ccn || "").replace(/\s/g, "")] || null;
        const ccnInp = $("input", { value: a.ccn || "", oninput: (e) => saveField(idx, "ccn", e.target.value.trim()) });
        const qtyInp = $("input", { type: "number", value: a.qty || 0, oninput: (e) => saveField(idx, "qty", Number(e.target.value)) });
        const fyInp = $("input", { type: "number", value: a.scheduledFY ?? "", oninput: (e) => saveField(idx, "scheduledFY", e.target.value ? Number(e.target.value) : null) });
        const noteInp = $("input", { value: a.note || "", oninput: (e) => saveField(idx, "note", e.target.value) });
        const del = $("button", { class: "btn btn-ghost", text: "✕", onclick: () => { if (confirm("Remove assignment?")) { const ns = (current.ccns || []).slice(); ns.splice(idx, 1); store.upsertProject(Object.assign({}, current, { ccns: ns })); } } });
        tbody.appendChild($("tr", {}, [$("td", {}, [ccnInp]), $("td", { text: entry?.title || (a.ccn ? "(not in catalog)" : "") }), $("td", { text: entry?.um || "" }), $("td", {}, [qtyInp]), $("td", {}, [fyInp]), $("td", {}, [noteInp]), $("td", {}, [del])]));
      });
      tbl.appendChild(tbody);
      // Footer totals grouped by UM
      const totals = {};
      list.forEach(a => { const c = cat[a.ccn]; const um = c?.um || "?"; totals[um] = (totals[um] || 0) + (a.qty || 0); });
      const tot = $("tfoot", {}, [$("tr", {}, [$("td", { class: "u-strong", colspan: "7", text: "Totals by UM: " + Object.entries(totals).map(([u,v]) => `${u}: ${v.toLocaleString()}`).join(" · ") })])]);
      tbl.appendChild(tot);
      host.appendChild(tbl);
    }

    function saveField(idx, field, value) {
      const current = store.getProject(projectId);
      const ns = (current.ccns || []).slice();
      ns[idx] = Object.assign({}, ns[idx], { [field]: value });
      store.upsertProject(Object.assign({}, current, { ccns: ns }));
    }

    render();
    const onC = () => render();
    store.on("change", onC);
    const mo = new MutationObserver(() => { if (!document.body.contains(container)) { store.off("change", onC); mo.disconnect(); } });
    mo.observe(container.parentNode || document.body, { childList: true });
  }

  window.Sections.assignment = function (container) {
    const store = window.DataStore;
    container.innerHTML = "";
    const wrap = $("div", { class: "asgn-wrap" });
    const left = $("div", { class: "asgn-left" });
    const right = $("div", { class: "asgn-right" });
    wrap.appendChild(left); wrap.appendChild(right);
    container.appendChild(wrap);

    const search = $("input", { type: "search", class: "search-inp", placeholder: "Find project…", oninput: (e) => renderList(e.target.value.toLowerCase()) });
    left.appendChild(search);
    const list = $("div", { class: "asgn-list" });
    left.appendChild(list);

    function renderList(q) {
      q = q || "";
      list.innerHTML = "";
      const progs = {}; store.listPrograms().forEach(p => progs[p.id] = p);
      store.getProjects().filter(p => (p.title || "").toLowerCase().includes(q) || (p.id || "").toLowerCase().includes(q))
        .slice(0, 400)
        .forEach(p => {
          const prog = progs[p.program]; const color = prog?.color || "#546270";
          const item = $("button", { class: "asgn-item", onclick: () => renderAssignmentPanel(right, p.id) }, [
            $("span", { class: "chip chip-small", style: `background:${color}1a;color:${color}`, text: prog?.umbrella || "Other" }),
            $("span", { class: "asgn-item-title", text: p.title || p.id }),
            $("span", { class: "u-muted", text: ` · ${p.installation || "Unknown"}` }),
            (p.ccns && p.ccns.length) ? $("span", { class: "u-muted", text: ` · ${p.ccns.length} CCNs` }) : null
          ]);
          list.appendChild(item);
        });
    }
    renderList("");
    right.appendChild($("div", { class: "u-muted", text: "Select a project on the left." }));
  };

  window.CcnAssignmentSubGrid = { render: renderAssignmentPanel };
})();
