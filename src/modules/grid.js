/* grid.js - Projects grid (Tabulator-backed)
 * Registers window.Sections.projects. Fully editable: row add/edit/delete,
 * column add/remove/hide, bulk CSV paste, row detail panel with CCN sub-grid,
 * live footer totals, tooltips, cross-walk highlighting, filter-aware.
 */
window.Sections = window.Sections || {};

(function () {
  "use strict";

  const $ = (tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") el.className = attrs[k];
        else if (k === "text") el.textContent = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
        else if (k === "dataset") Object.assign(el.dataset, attrs[k]);
        else el.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach(c => { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  };

  const fmtCurrency = (v) => (v == null || v === "") ? "" : "$" + Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const fmtInt = (v) => (v == null || v === "") ? "" : Number(v).toLocaleString("en-US");
  const yearOfISO = (s) => s ? Number(String(s).slice(0, 4)) : null;

  // --- Column definitions are driven by DataStore.listSchemaColumns() ---

  function tabulatorColumnsFromSchema(columns, ctx) {
    const cols = [];
    cols.push({ formatter: "rowSelection", titleFormatter: "rowSelection", hozAlign: "center", headerSort: false, width: 36 });
    columns.forEach((c) => {
      if (c.hidden) return;
      const col = {
        title: c.label || c.key,
        field: c.key,
        headerTooltip: c.description || c.label || c.key,
        resizable: true,
        headerFilter: ["text", "number"].includes(c.type) ? "input" : (c.type === "enum" ? "list" : false),
      };
      if (c.type === "currency") { col.formatter = (cell) => fmtCurrency(cell.getValue()); col.bottomCalc = "sum"; col.bottomCalcFormatter = (cell) => fmtCurrency(cell.getValue()); col.hozAlign = "right"; }
      else if (c.type === "number") { col.formatter = (cell) => fmtInt(cell.getValue()); col.bottomCalc = "sum"; col.bottomCalcFormatter = (cell) => fmtInt(cell.getValue()); col.hozAlign = "right"; }
      else if (c.type === "bool") { col.formatter = (cell) => cell.getValue() ? "✓" : ""; col.hozAlign = "center"; }
      // Editable when cell is clicked
      col.editor = editorForType(c, ctx);
      if (c.type === "enum" && c.enumValues) col.headerFilterParams = { values: c.enumValues };
      // Dynamic values for header filter on program/installation (not stored in enumValues)
      if (c.type === "enum" && c.key === "program") {
        const vals = {};
        ctx.store.listPrograms().forEach(p => { vals[p.id] = p.label; });
        col.headerFilter = "list";
        col.headerFilterParams = { values: vals, clearable: true };
      }
      if (c.type === "text" && c.key === "installation") {
        const vals = {};
        ctx.store.listInstallations().forEach(i => { vals[i.name] = i.name; });
        col.headerFilter = "list";
        col.headerFilterParams = { values: vals, clearable: true };
      }
      // Special program/installation cell rendering with colored chips
      if (c.key === "program") col.formatter = (cell) => programChip(cell.getValue(), ctx);
      if (c.key === "installation") col.formatter = (cell) => installationChip(cell.getValue(), ctx);
      if (c.key === "projectType") col.formatter = (cell) => typeChip(cell.getValue());
      cols.push(col);
    });
    // Actions column
    cols.push({
      title: "", field: "_actions", width: 80, headerSort: false,
      formatter: () => "<span class='row-act' title='Open detail'>↗</span> <span class='row-act' title='Duplicate'>⧉</span> <span class='row-act row-act-del' title='Delete'>✕</span>",
      cellClick: (e, cell) => {
        const row = cell.getRow().getData();
        const t = e.target.getAttribute("title");
        if (t === "Open detail") openDetail(row.id, ctx);
        else if (t === "Duplicate") duplicateRow(row, ctx);
        else if (t === "Delete") deleteRow(row, ctx);
      }
    });
    return cols;
  }

  function editorForType(c, ctx) {
    switch (c.type) {
      case "number": case "currency": return "number";
      case "bool": return "tickCross";
      case "date": return "input";
      case "enum":
        if (c.key === "program") {
          return function (cell, onRendered, success, cancel) {
            const sel = document.createElement("select");
            ctx.store.listPrograms().forEach(p => { const o = document.createElement("option"); o.value = p.id; o.textContent = p.label; sel.appendChild(o); });
            sel.value = cell.getValue() || "";
            sel.addEventListener("change", () => success(sel.value));
            sel.addEventListener("blur", () => success(sel.value));
            onRendered(() => sel.focus());
            return sel;
          };
        }
        if (c.key === "installation") {
          return function (cell, onRendered, success) {
            const sel = document.createElement("select");
            ctx.store.listInstallations().forEach(i => { const o = document.createElement("option"); o.value = i.name; o.textContent = i.name; sel.appendChild(o); });
            sel.value = cell.getValue() || "";
            sel.addEventListener("change", () => success(sel.value));
            sel.addEventListener("blur", () => success(sel.value));
            onRendered(() => sel.focus());
            return sel;
          };
        }
        return c.enumValues && c.enumValues.length ? { type: "list", values: c.enumValues } : "input";
      default: return "input";
    }
  }

  function programChip(programId, ctx) {
    const p = ctx.store.getProgram(programId);
    if (!p) return `<span class="chip">${programId || ""}</span>`;
    return `<span class="chip chip-program" style="background:${p.color}1a;color:${p.color};border-color:${p.color}4d" data-tip="${p.umbrella}">${p.label}</span>`;
  }
  function installationChip(name, ctx) {
    const i = (ctx.store.listInstallations() || []).find(x => x.name === name);
    const color = i ? i.color : "#8A98A8";
    return `<span class="chip chip-inst" style="background:${color}1a;color:${color};border-color:${color}4d">${name || "Unknown"}</span>`;
  }
  function typeChip(t) {
    if (!t) return "";
    const colors = { NEW: "#1E3F5C", REPLACEMENT: "#7A5900", DEMO: "#8C2B0B", CONSOLIDATION: "#3A3A9E", CONVERSION: "#0B6E4F", RELOCATION: "#5A0B8C" };
    const c = colors[t] || "#546270";
    return `<span class="chip" style="background:${c}1a;color:${c};border-color:${c}4d">${t}</span>`;
  }

  // --- Projects data with filter applied ---
  function currentProjects(ctx) {
    const f = window.FilterState || {};
    return ctx.store.getProjects({
      umbrella: f.umbrella || undefined,
      installation: f.installation || undefined,
      search: f.search || undefined,
    });
  }

  // --- Row actions ---
  function openDetail(id, ctx) {
    const row = ctx.store.getProject(id);
    if (!row) return;
    const dlg = $("dialog", { class: "detail-dialog" });
    const close = () => { dlg.close(); dlg.remove(); };
    const schema = ctx.store.listSchemaColumns();
    const fields = schema.filter(c => !c.hidden && c.key !== "_actions").map(c => {
      const v = row[c.key];
      const input = $("input", { type: c.type === "date" ? "date" : c.type === "number" || c.type === "currency" ? "number" : "text", value: v == null ? "" : v });
      input.dataset.key = c.key; input.dataset.type = c.type;
      return $("label", { class: "det-field" }, [$("span", { class: "det-label", text: c.label || c.key }), input]);
    });
    const ccnHost = $("div", { class: "det-ccn-host" });
    const saveBtn = $("button", { class: "btn btn-primary", text: "Save", onclick: () => {
      const updated = Object.assign({}, row);
      dlg.querySelectorAll("input[data-key]").forEach(inp => {
        const k = inp.dataset.key, t = inp.dataset.type;
        let v = inp.value;
        if (v === "") v = null;
        else if (t === "number" || t === "currency") v = Number(v);
        else if (t === "bool") v = inp.checked;
        updated[k] = v;
      });
      ctx.store.upsertProject(updated);
      close();
    } });
    const cancelBtn = $("button", { class: "btn", text: "Cancel", onclick: close });
    dlg.appendChild($("div", { class: "det-head" }, [
      $("span", { class: "foumark", text: "FOUO" }),
      $("strong", { text: row.title || row.id }),
      $("span", { class: "det-id u-muted", text: row.id }),
      $("button", { class: "btn btn-ghost", text: "✕", onclick: close })
    ]));
    dlg.appendChild($("div", { class: "det-body" }, [
      $("div", { class: "det-fields" }, fields),
      $("div", { class: "det-ccns" }, [$("h4", { text: "CCN Assignments" }), ccnHost])
    ]));
    dlg.appendChild($("div", { class: "det-foot" }, [saveBtn, cancelBtn]));
    document.body.appendChild(dlg);
    dlg.showModal();
    if (window.CcnAssignmentSubGrid) window.CcnAssignmentSubGrid.render(ccnHost, row.id);
    else ccnHost.textContent = "CCN assignment UI not loaded.";
  }

  function duplicateRow(row, ctx) {
    const copy = Object.assign({}, row, { id: row.id + "-copy-" + Date.now().toString(36) });
    ctx.store.upsertProject(copy);
  }
  function deleteRow(row, ctx) {
    if (!confirm(`Delete project ${row.id} - ${row.title || ""}?\nThis cannot be undone except via Undo (Ctrl+Z).`)) return;
    ctx.store.deleteProject(row.id);
  }

  // --- Bulk CSV paste modal ---
  function openBulkPaste(ctx) {
    const dlg = $("dialog", { class: "paste-dialog" });
    const textarea = $("textarea", { rows: 12, placeholder: "Paste tab- or comma-separated rows. First row = headers (matching field keys like title, installation, program, totalCost, activationFYOverride...)" });
    const preview = $("div", { class: "paste-preview u-muted", text: "Paste rows above to preview." });
    let parsed = null;
    textarea.addEventListener("input", () => {
      const text = textarea.value.trim();
      if (!text) { preview.textContent = "Paste rows above to preview."; parsed = null; return; }
      const res = window.Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
      parsed = res.data;
      preview.innerHTML = "";
      preview.appendChild($("div", { text: `${parsed.length} rows parsed. Columns: ${res.meta.fields.join(", ")}` }));
    });
    const apply = $("button", { class: "btn btn-primary", text: "Apply", onclick: () => {
      if (!parsed || !parsed.length) return;
      let upserts = 0;
      parsed.forEach(r => {
        if (!r.id) r.id = "new-" + Date.now().toString(36) + "-" + upserts;
        // Merge with existing row if present
        const existing = ctx.store.getProject(r.id);
        ctx.store.upsertProject(Object.assign({ source: "mlr", program: "other" }, existing || {}, r));
        upserts++;
      });
      alert(`Upserted ${upserts} projects.`);
      dlg.close(); dlg.remove();
    } });
    const cancel = $("button", { class: "btn", text: "Cancel", onclick: () => { dlg.close(); dlg.remove(); } });
    dlg.appendChild($("div", { class: "det-head" }, [$("strong", { text: "Paste projects from spreadsheet" }), $("span", { class: "foumark", text: "FOUO" })]));
    dlg.appendChild($("div", { class: "det-body" }, [textarea, preview]));
    dlg.appendChild($("div", { class: "det-foot" }, [apply, cancel]));
    document.body.appendChild(dlg); dlg.showModal();
  }

  // --- Column settings panel ---
  function openColumnSettings(ctx, table) {
    const dlg = $("dialog", { class: "colset-dialog" });
    const list = $("div", { class: "colset-list" });
    const render = () => {
      list.innerHTML = "";
      ctx.store.listSchemaColumns().forEach(c => {
        const row = $("div", { class: "colset-row" }, [
          $("input", { type: "checkbox", checked: c.hidden ? null : "checked", onchange: (e) => ctx.store.updateSchemaColumn?.(c.key, { hidden: !e.target.checked }) }),
          $("input", { type: "text", value: c.label, title: "Rename label", onchange: (e) => ctx.store.updateSchemaColumn?.(c.key, { label: e.target.value }) }),
          $("span", { class: "u-muted", text: c.type }),
          c.userDefined ? $("button", { class: "btn btn-ghost", text: "✕", title: "Delete", onclick: () => { if (confirm("Delete column " + c.key + "?")) { ctx.store.removeSchemaColumn(c.key); render(); } } }) : $("span", { class: "u-muted", text: "built-in" })
        ]);
        list.appendChild(row);
      });
    };
    render();
    const addForm = $("div", { class: "colset-add" }, [
      $("h4", { text: "Add column" }),
      $("input", { id: "colnew-key", placeholder: "key (e.g. poc)" }),
      $("input", { id: "colnew-label", placeholder: "Label (e.g. POC)" }),
      $("select", { id: "colnew-type" }, ["text","number","currency","date","enum","bool"].map(t => $("option", { value: t, text: t }))),
      $("input", { id: "colnew-unit", placeholder: "unit (optional)" }),
      $("button", { class: "btn", text: "Add", onclick: () => {
        const k = document.getElementById("colnew-key").value.trim();
        const l = document.getElementById("colnew-label").value.trim() || k;
        const t = document.getElementById("colnew-type").value;
        const u = document.getElementById("colnew-unit").value.trim() || null;
        if (!/^[a-z][a-z0-9_]*$/.test(k)) { alert("Key must be lowercase alphanumeric+underscore"); return; }
        ctx.store.addSchemaColumn({ key: k, label: l, type: t, unit: u, userDefined: true, order: 9999 });
        render();
        // Force table to re-render columns
        rebuildColumns(ctx, table);
      } })
    ]);
    dlg.appendChild($("div", { class: "det-head" }, [$("strong", { text: "Columns" })]));
    dlg.appendChild($("div", { class: "det-body" }, [list, addForm]));
    dlg.appendChild($("div", { class: "det-foot" }, [$("button", { class: "btn btn-primary", text: "Done", onclick: () => { dlg.close(); dlg.remove(); rebuildColumns(ctx, table); } })]));
    document.body.appendChild(dlg); dlg.showModal();
  }

  function rebuildColumns(ctx, table) {
    if (!table) return;
    const cols = tabulatorColumnsFromSchema(ctx.store.listSchemaColumns(), ctx);
    table.setColumns ? table.setColumns(cols) : null;
  }

  // --- Main section renderer ---
  window.Sections.projects = function (container) {
    const store = window.DataStore;
    const ctx = { store };
    container.innerHTML = "";

    const toolbar = $("div", { class: "grid-toolbar" }, [
      $("button", { class: "btn btn-primary", text: "+ Add row", onclick: () => {
        const id = "new-" + Date.now().toString(36);
        store.upsertProject({ id, source: "mlr", program: "other", title: "New project", installation: "Unknown", unknownInstallation: true, ccns: [] });
      } }),
      $("button", { class: "btn", text: "Paste from spreadsheet…", onclick: () => openBulkPaste(ctx) }),
      $("button", { class: "btn", text: "Columns…", onclick: () => openColumnSettings(ctx, tableRef.current) }),
      $("div", { class: "u-grow" }),
      $("span", { id: "grid-count", class: "u-muted" })
    ]);
    const host = $("div", { id: "projects-grid", class: "grid-host" });
    container.appendChild(toolbar);
    container.appendChild(host);

    const tableRef = { current: null };
    const cols = tabulatorColumnsFromSchema(store.listSchemaColumns(), ctx);
    const data = currentProjects(ctx);

    tableRef.current = new window.Tabulator(host, {
      data,
      columns: cols,
      layout: "fitDataStretch",
      height: "calc(100vh - 260px)",
      reactiveData: true,
      selectable: true,
      resizableColumnFit: true,
      pagination: true,
      paginationSize: 100,
      paginationSizeSelector: [50, 100, 200, 500, 1000],
      rowFormatter: (row) => {
        const d = row.getData();
        if (d.unknownInstallation) row.getElement().classList.add("row-unknown");
      },
      cellEdited: (cell) => {
        const d = cell.getRow().getData();
        store.upsertProject(d);
      }
    });

    const setCount = () => {
      const el = document.getElementById("grid-count");
      if (el) el.textContent = `${tableRef.current.getData().length} projects (of ${store.listProjects ? store.listProjects().length : currentProjects(ctx).length} total)`;
    };
    setCount();

    // Filter + change subscriptions
    const onFilter = () => { tableRef.current.replaceData(currentProjects(ctx)); setCount(); };
    const onChange = () => { tableRef.current.replaceData(currentProjects(ctx)); setCount(); };
    document.addEventListener("filter-change", onFilter);
    store.on("change", onChange);

    // Clean up on re-navigation
    const mo = new MutationObserver(() => {
      if (!document.body.contains(host)) {
        document.removeEventListener("filter-change", onFilter);
        store.off("change", onChange);
        mo.disconnect();
      }
    });
    mo.observe(container.parentNode || document.body, { childList: true });
  };
})();
