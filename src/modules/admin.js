/* admin.js — editor for installations, programs, columns, enums, viewer. */
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

  window.Sections.admin = function (container) {
    const store = window.DataStore;
    container.innerHTML = "";
    const tabs = $("div", { class: "admin-tabs" });
    const body = $("div", { class: "admin-body" });
    const TABS = ["Installations", "Programs", "Columns", "Viewer"];
    let active = "Installations";
    const render = () => {
      tabs.innerHTML = "";
      TABS.forEach(t => tabs.appendChild($("button", { class: "admin-tab" + (active === t ? " active" : ""), text: t, onclick: () => { active = t; render(); } })));
      body.innerHTML = "";
      if (active === "Installations") renderInstallations(body, store);
      else if (active === "Programs") renderPrograms(body, store);
      else if (active === "Columns") renderColumns(body, store);
      else if (active === "Viewer") renderViewer(body, store);
    };
    container.appendChild(tabs); container.appendChild(body);
    render();
    const onC = () => render();
    store.on("change", onC);
    const mo = new MutationObserver(() => { if (!document.body.contains(container)) { store.off("change", onC); mo.disconnect(); } });
    mo.observe(container.parentNode || document.body, { childList: true });
  };

  function renderInstallations(host, store) {
    const tbl = $("table", { class: "summary-table admin-table" });
    tbl.appendChild($("thead", {}, [$("tr", {}, ["ID","Name","Service","Country","Color","Projects","Delete"].map(h => $("th", { text: h })))]));
    const tbody = $("tbody");
    const usage = {}; store.getProjects().forEach(p => usage[p.installation] = (usage[p.installation] || 0) + 1);
    store.listInstallations().forEach(i => {
      const tr = $("tr");
      tr.appendChild($("td", {}, [$("input", { value: i.id, onchange: (e) => store.upsertInstallation(Object.assign({}, i, { id: e.target.value })) })]));
      tr.appendChild($("td", {}, [$("input", { value: i.name, onchange: (e) => store.upsertInstallation(Object.assign({}, i, { name: e.target.value })) })]));
      tr.appendChild($("td", {}, [$("input", { value: i.service || "USMC", onchange: (e) => store.upsertInstallation(Object.assign({}, i, { service: e.target.value })) })]));
      tr.appendChild($("td", {}, [$("input", { value: i.country || "", onchange: (e) => store.upsertInstallation(Object.assign({}, i, { country: e.target.value })) })]));
      tr.appendChild($("td", {}, [$("input", { type: "color", value: i.color || "#546270", onchange: (e) => store.upsertInstallation(Object.assign({}, i, { color: e.target.value })) })]));
      tr.appendChild($("td", { text: String(usage[i.name] || 0) }));
      tr.appendChild($("td", {}, [$("button", { class: "btn btn-ghost", text: "✕", onclick: () => deleteInstall(store, i) })]));
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    host.appendChild(tbl);
    const addForm = $("div", { class: "admin-add" }, [
      $("h4", { text: "Add installation" }),
      $("input", { id: "ins-id", placeholder: "id (kebab-case)" }),
      $("input", { id: "ins-name", placeholder: "Name" }),
      $("input", { id: "ins-service", placeholder: "Service (USMC)" }),
      $("input", { id: "ins-country", placeholder: "Country (JPN/GUM/USA/AUS)" }),
      $("input", { id: "ins-color", type: "color", value: "#546270" }),
      $("button", { class: "btn btn-primary", text: "Add", onclick: () => {
        store.upsertInstallation({
          id: document.getElementById("ins-id").value.trim(),
          name: document.getElementById("ins-name").value.trim(),
          service: document.getElementById("ins-service").value.trim() || "USMC",
          country: document.getElementById("ins-country").value.trim() || "JPN",
          color: document.getElementById("ins-color").value
        });
      } })
    ]);
    host.appendChild(addForm);
  }

  function deleteInstall(store, i) {
    const blocked = store.deleteInstallation(i.id);
    if (blocked && blocked.blocked) {
      const installs = store.listInstallations().filter(x => x.id !== i.id);
      const options = installs.map(x => `<option value="${x.name}">${x.name}</option>`).join("");
      const dlg = $("dialog", { class: "detail-dialog" });
      dlg.appendChild($("div", { class: "det-head" }, [$("strong", { text: `Cannot delete ${i.name}` })]));
      dlg.appendChild($("div", { class: "det-body" }, [
        $("p", { text: `${blocked.count} projects reference this installation. Reassign them to:` }),
        $("div", { html: `<select id="reassign-target">${options}</select>` })
      ]));
      dlg.appendChild($("div", { class: "det-foot" }, [
        $("button", { class: "btn btn-primary", text: "Reassign and delete", onclick: () => {
          const target = document.getElementById("reassign-target").value;
          store.deleteInstallation(i.id, { reassignTo: target });
          dlg.close(); dlg.remove();
        } }),
        $("button", { class: "btn", text: "Cancel", onclick: () => { dlg.close(); dlg.remove(); } })
      ]));
      document.body.appendChild(dlg); dlg.showModal();
    }
  }

  function renderPrograms(host, store) {
    const tbl = $("table", { class: "summary-table admin-table" });
    tbl.appendChild($("thead", {}, [$("tr", {}, ["ID","Umbrella","Label","Color","Projects","Delete"].map(h => $("th", { text: h })))]));
    const tbody = $("tbody");
    const usage = {}; store.getProjects().forEach(p => usage[p.program] = (usage[p.program] || 0) + 1);
    store.listPrograms().forEach(pr => {
      const tr = $("tr");
      tr.appendChild($("td", { text: pr.id }));
      tr.appendChild($("td", {}, [$("input", { value: pr.umbrella, onchange: (e) => store.upsertProgram(Object.assign({}, pr, { umbrella: e.target.value })) })]));
      tr.appendChild($("td", {}, [$("input", { value: pr.label, onchange: (e) => store.upsertProgram(Object.assign({}, pr, { label: e.target.value })) })]));
      tr.appendChild($("td", {}, [$("input", { type: "color", value: pr.color, onchange: (e) => store.upsertProgram(Object.assign({}, pr, { color: e.target.value })) })]));
      tr.appendChild($("td", { text: String(usage[pr.id] || 0) }));
      tr.appendChild($("td", {}, [$("button", { class: "btn btn-ghost", text: "✕", onclick: () => { const b = store.deleteProgram(pr.id); if (b && b.blocked) alert(`${b.count} projects reference this program. Reassign first.`); } })]));
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    host.appendChild(tbl);
  }

  function renderColumns(host, store) {
    const tbl = $("table", { class: "summary-table admin-table" });
    tbl.appendChild($("thead", {}, [$("tr", {}, ["Key","Label","Type","Unit","Visible","Built-in","Delete"].map(h => $("th", { text: h })))]));
    const tbody = $("tbody");
    store.listSchemaColumns().forEach(c => {
      const tr = $("tr");
      tr.appendChild($("td", { text: c.key }));
      tr.appendChild($("td", {}, [$("input", { value: c.label, onchange: (e) => store.updateSchemaColumn?.(c.key, { label: e.target.value }) })]));
      tr.appendChild($("td", { text: c.type }));
      tr.appendChild($("td", {}, [$("input", { value: c.unit || "", onchange: (e) => store.updateSchemaColumn?.(c.key, { unit: e.target.value || null }) })]));
      tr.appendChild($("td", {}, [$("input", { type: "checkbox", checked: !c.hidden, onchange: (e) => store.updateSchemaColumn?.(c.key, { hidden: !e.target.checked }) })]));
      tr.appendChild($("td", { text: c.userDefined ? "" : "✓" }));
      tr.appendChild($("td", {}, [c.userDefined ? $("button", { class: "btn btn-ghost", text: "✕", onclick: () => { if (confirm("Delete column " + c.key + "?")) store.removeSchemaColumn(c.key); } }) : $("span", { class: "u-muted", text: "—" })]));
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody); host.appendChild(tbl);

    host.appendChild($("div", { class: "admin-add" }, [
      $("h4", { text: "Add column" }),
      $("input", { id: "col-key", placeholder: "key (lowercase_snake)" }),
      $("input", { id: "col-label", placeholder: "Label" }),
      $("select", { id: "col-type" }, ["text","number","currency","date","enum","bool"].map(t => $("option", { value: t, text: t }))),
      $("input", { id: "col-unit", placeholder: "unit (optional)" }),
      $("button", { class: "btn btn-primary", text: "Add", onclick: () => {
        const k = document.getElementById("col-key").value.trim();
        const lb = document.getElementById("col-label").value.trim() || k;
        const t = document.getElementById("col-type").value;
        const u = document.getElementById("col-unit").value.trim() || null;
        if (!/^[a-z][a-z0-9_]*$/.test(k)) { alert("Key must be lowercase alphanumeric/underscore."); return; }
        store.addSchemaColumn({ key: k, label: lb, type: t, unit: u, userDefined: true, order: 9999 });
      } })
    ]));
  }

  function renderViewer(host, store) {
    host.appendChild($("h4", { text: "Viewer identity" }));
    host.appendChild($("p", { class: "u-muted", text: "Stamped on all exports as part of the FOUO watermark." }));
    host.appendChild($("div", {}, [
      $("input", { id: "viewer-inp", value: store.getViewer?.() || "" }),
      $("button", { class: "btn btn-primary", text: "Save", onclick: () => { store.setViewer(document.getElementById("viewer-inp").value.trim()); alert("Saved."); } })
    ]));
  }
})();
