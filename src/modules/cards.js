/* cards.js - Card view for Projects. One card per project.
 * DPRI cards show Form 42 / Budget-BCP / Design / Construction / Activation milestone boxes.
 * MLR and 3/12 cards show IOC / FOC milestone boxes.
 * Each milestone box: dates (editable) plus an "achieved" checkbox.
 * Every card has an inline CCN block with add, edit, delete, and a live SF total by UM.
 */
window.CardsView = (function () {
  "use strict";

  const $ = (tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (k === "html") el.innerHTML = attrs[k];
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  };

  const fmtDate = (iso) => iso ? String(iso).slice(0, 10) : "";
  const fmtSF = (n) => (n == null || isNaN(n)) ? "0" : Math.round(n).toLocaleString("en-US");

  function milestoneBox(label, startKey, finishKey, checkKey, project, store) {
    const checked = !!(project.milestoneChecks && project.milestoneChecks[checkKey]);
    const startVal = project.dates ? project.dates[startKey] : null;
    const finishVal = project.dates ? project.dates[finishKey] : null;
    const box = $("div", { class: "ms-box" + (checked ? " ms-done" : "") }, [
      $("div", { class: "ms-head" }, [
        $("label", { class: "ms-check-lbl" }, [
          $("input", {
            type: "checkbox",
            class: "ms-check",
            "data-focus-key": `${project.id}::ms-check::${checkKey}`,
            checked: checked ? "checked" : null,
            onchange: (e) => {
              const checks = Object.assign({}, project.milestoneChecks || {});
              checks[checkKey] = e.target.checked;
              store.upsertProject(Object.assign({}, project, { milestoneChecks: checks }));
            }
          }),
          $("span", { class: "ms-label", text: label })
        ])
      ]),
      $("div", { class: "ms-dates" }, [
        $("div", { class: "ms-row" }, [
          $("span", { class: "ms-dl", text: "Start" }),
          $("input", {
            type: "date", class: "ms-date", value: fmtDate(startVal) || "",
            "data-focus-key": `${project.id}::ms-date::${startKey}`,
            onchange: (e) => {
              const dates = Object.assign({}, project.dates || {});
              dates[startKey] = e.target.value || null;
              store.upsertProject(Object.assign({}, project, { dates }));
            }
          })
        ]),
        $("div", { class: "ms-row" }, [
          $("span", { class: "ms-dl", text: "Finish" }),
          $("input", {
            type: "date", class: "ms-date", value: fmtDate(finishVal) || "",
            "data-focus-key": `${project.id}::ms-date::${finishKey}`,
            onchange: (e) => {
              const dates = Object.assign({}, project.dates || {});
              dates[finishKey] = e.target.value || null;
              store.upsertProject(Object.assign({}, project, { dates }));
            }
          })
        ])
      ])
    ]);
    return box;
  }

  function capabilityBox(label, dateKey, checkKey, project, store) {
    const checked = !!(project.milestoneChecks && project.milestoneChecks[checkKey]);
    const dateVal = project[dateKey];
    const box = $("div", { class: "ms-box ms-box-cap" + (checked ? " ms-done" : "") }, [
      $("div", { class: "ms-head" }, [
        $("label", { class: "ms-check-lbl" }, [
          $("input", {
            type: "checkbox",
            class: "ms-check",
            "data-focus-key": `${project.id}::cap-check::${checkKey}`,
            checked: checked ? "checked" : null,
            onchange: (e) => {
              const checks = Object.assign({}, project.milestoneChecks || {});
              checks[checkKey] = e.target.checked;
              store.upsertProject(Object.assign({}, project, { milestoneChecks: checks }));
            }
          }),
          $("span", { class: "ms-label", text: label })
        ])
      ]),
      $("div", { class: "ms-row" }, [
        $("span", { class: "ms-dl", text: "Target" }),
        $("input", {
          type: "date", class: "ms-date", value: fmtDate(dateVal) || "",
          "data-focus-key": `${project.id}::cap-date::${dateKey}`,
          onchange: (e) => {
            const update = {};
            update[dateKey] = e.target.value || null;
            store.upsertProject(Object.assign({}, project, update));
          }
        })
      ])
    ]);
    return box;
  }

  function ccnBlock(project, store) {
    const catalog = {};
    (store.listCCNs?.() || []).forEach(c => { catalog[c.codeNormalized || c.code] = c; });
    const list = project.ccns || [];

    // Totals by unit of measure
    const totals = {};
    list.forEach(a => {
      const entry = catalog[a.ccn] || catalog[(a.ccn || "").replace(/\s/g, "")];
      const um = entry ? entry.um : "?";
      totals[um] = (totals[um] || 0) + (a.qty || 0);
    });

    const wrap = $("div", { class: "ccn-block" });
    wrap.appendChild($("div", { class: "ccn-block-head" }, [
      $("h4", { text: "CCN Assignments" }),
      $("span", { class: "ccn-block-sub u-muted",
        text: Object.keys(totals).length
          ? "Total " + Object.entries(totals).map(([u,v]) => `${fmtSF(v)} ${u}`).join(" | ")
          : "None assigned yet"
      })
    ]));

    const table = $("table", { class: "ccn-inline-table" });
    table.appendChild($("thead", {}, [
      $("tr", {}, ["CCN", "Title", "UM", "Qty", "Scheduled FY", "Note", ""].map(h => $("th", { text: h })))
    ]));
    const tbody = $("tbody");
    if (list.length === 0) {
      tbody.appendChild($("tr", {}, [
        $("td", { colspan: "7", class: "u-muted ccn-empty", text: "No CCNs assigned. Click Add CCN below." })
      ]));
    }
    list.forEach((a, idx) => {
      const entry = catalog[a.ccn] || catalog[(a.ccn || "").replace(/\s/g, "")];
      const title = entry ? entry.title : (a.ccn ? "(code not in catalog)" : "");
      const um = entry ? entry.um : "";

      const ccnInput = $("input", {
        value: a.ccn || "", class: "ccn-inp", placeholder: "e.g. 21410",
        "data-focus-key": `${project.id}::ccn::${idx}::code`,
        oninput: (e) => patchAssignment(idx, { ccn: e.target.value.trim() })
      });
      const qtyInput = $("input", {
        type: "number", value: a.qty || 0, class: "ccn-inp ccn-inp-num",
        "data-focus-key": `${project.id}::ccn::${idx}::qty`,
        oninput: (e) => patchAssignment(idx, { qty: Number(e.target.value) || 0 })
      });
      const fyInput = $("input", {
        type: "number", value: a.scheduledFY || "", class: "ccn-inp ccn-inp-num",
        min: 2010, max: 2060, placeholder: "FY",
        "data-focus-key": `${project.id}::ccn::${idx}::fy`,
        oninput: (e) => patchAssignment(idx, { scheduledFY: e.target.value ? Number(e.target.value) : null })
      });
      const noteInput = $("input", {
        value: a.note || "", class: "ccn-inp",
        "data-focus-key": `${project.id}::ccn::${idx}::note`,
        oninput: (e) => patchAssignment(idx, { note: e.target.value })
      });
      const delBtn = $("button", {
        class: "btn btn-ghost ccn-del", text: "X",
        title: "Remove this CCN assignment",
        onclick: () => {
          if (!confirm("Remove CCN " + (a.ccn || "(blank)") + " from this project?")) return;
          const next = (store.getProject(project.id).ccns || []).slice();
          next.splice(idx, 1);
          store.upsertProject(Object.assign({}, store.getProject(project.id), { ccns: next }));
        }
      });

      tbody.appendChild($("tr", {}, [
        $("td", {}, [ccnInput]),
        $("td", { text: title, class: "ccn-title-cell" }),
        $("td", { text: um, class: "ccn-um-cell" }),
        $("td", {}, [qtyInput]),
        $("td", {}, [fyInput]),
        $("td", {}, [noteInput]),
        $("td", {}, [delBtn])
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);

    const add = $("button", {
      class: "btn ccn-add-btn", text: "+ Add CCN",
      onclick: () => {
        const next = (store.getProject(project.id).ccns || []).slice();
        next.push({ ccn: "", qty: 0, scheduledFY: project.activationFYOverride ?? project.activationFY ?? null, note: "" });
        store.upsertProject(Object.assign({}, store.getProject(project.id), { ccns: next }));
      }
    });
    wrap.appendChild(add);

    function patchAssignment(idx, patch) {
      const current = store.getProject(project.id);
      const next = (current.ccns || []).slice();
      next[idx] = Object.assign({}, next[idx], patch);
      store.upsertProject(Object.assign({}, current, { ccns: next }));
    }

    return wrap;
  }

  function renderCard(project, store, ctx) {
    const prog = store.getProgram(project.program);
    const progColor = prog ? prog.color : "#546270";
    const inst = (store.listInstallations() || []).find(i => i.name === project.installation);
    const instColor = inst ? inst.color : "#546270";
    const umbrella = prog ? prog.umbrella : "Other";

    const card = $("article", { class: "proj-card", "data-project-id": project.id });

    // Header
    const head = $("header", { class: "pc-head" }, [
      $("div", { class: "pc-head-top" }, [
        $("span", { class: "chip chip-small", style: `background:${progColor}1a;color:${progColor};border-color:${progColor}4d`, text: (prog && prog.label) || project.program }),
        $("span", { class: "chip chip-small", style: `background:${instColor}1a;color:${instColor};border-color:${instColor}4d`, text: project.installation || "SACO" }),
        project.projectType ? $("span", { class: "chip chip-small", text: project.projectType }) : null,
        $("span", { class: "pc-id u-muted", text: project.id })
      ]),
      $("h3", { class: "pc-title", text: project.title || project.id }),
      project.bldg ? $("div", { class: "pc-bldg u-muted", text: "Bldg " + project.bldg }) : null
    ]);
    card.appendChild(head);

    // Editable summary row: program, installation, project type, phase, cost
    const summary = $("div", { class: "pc-summary" }, [
      summaryField("Program", selectInput(
        (prog && prog.id) || project.program,
        store.listPrograms().map(p => ({ value: p.id, label: p.label })),
        (v) => store.upsertProject(Object.assign({}, project, { program: v }))
      ), `${project.id}::summary::program`),
      summaryField("Installation", selectInput(
        project.installation,
        store.listInstallations().map(i => ({ value: i.name, label: i.name })),
        (v) => store.upsertProject(Object.assign({}, project, { installation: v }))
      ), `${project.id}::summary::installation`),
      project.source === "dpri" ? summaryField("Type", selectInput(
        project.projectType || "",
        ["NEW","REPLACEMENT","DEMO","CONSOLIDATION","CONVERSION","RELOCATION"].map(t => ({ value: t, label: t })),
        (v) => store.upsertProject(Object.assign({}, project, { projectType: v || null })),
        true
      ), `${project.id}::summary::projectType`) : null,
      project.source === "dpri" ? summaryField("Phase", numericInput(
        project.phase,
        (v) => store.upsertProject(Object.assign({}, project, { phase: v }))
      ), `${project.id}::summary::phase`) : null,
      project.source === "mlr" ? summaryField("Funding", selectInput(
        project.fundingSource || "",
        ["FSRM","MILCON","Mod-Camp"].map(t => ({ value: t, label: t })),
        (v) => store.upsertProject(Object.assign({}, project, { fundingSource: v || null })),
        true
      ), `${project.id}::summary::fundingSource`) : null,
      summaryField("Activation FY", numericInput(
        project.activationFYOverride ?? project.activationFY,
        (v) => store.upsertProject(Object.assign({}, project, { activationFYOverride: v }))
      ), `${project.id}::summary::activationFY`)
    ].filter(Boolean));
    card.appendChild(summary);

    // Milestones
    const ms = $("div", { class: "pc-milestones" });
    if (project.source === "dpri") {
      ms.appendChild(milestoneBox("Form 42", "fStart", "fFinish", "f", project, store));
      ms.appendChild(milestoneBox("Budget / BCP", "bStart", "bFinish", "b", project, store));
      ms.appendChild(milestoneBox("Design", "dStart", "dFinish", "d", project, store));
      ms.appendChild(milestoneBox("Construction", "cStart", "cFinish", "c", project, store));
      ms.appendChild(milestoneBox("Activation", "aStart", "aFinish", "a", project, store));
    } else {
      ms.appendChild(capabilityBox("IOC (Initial Operating Capability)", "iocDate", "ioc", project, store));
      ms.appendChild(capabilityBox("FOC (Full Operating Capability)", "focDate", "foc", project, store));
    }
    card.appendChild(ms);

    // CCN block
    card.appendChild(ccnBlock(project, store));

    // Notes. Textareas do not honor a `value` attribute; the .value
    // property must be set after creation so existing notes render.
    const notesTa = $("textarea", {
      rows: 2, class: "pc-notes-ta",
      "data-focus-key": `${project.id}::notes`,
      placeholder: "Planner notes, linked references, dependencies.",
      oninput: (e) => {
        clearTimeout(card._noteTimer);
        card._noteTimer = setTimeout(() => {
          store.upsertProject(Object.assign({}, store.getProject(project.id), { notes: e.target.value }));
        }, 500);
      }
    });
    notesTa.value = project.notes || "";
    const notes = $("div", { class: "pc-notes" }, [
      $("label", {}, [
        $("span", { class: "pc-notes-lbl", text: "Notes" }),
        notesTa
      ])
    ]);
    card.appendChild(notes);

    // Footer actions
    const footer = $("footer", { class: "pc-foot" }, [
      $("button", { class: "btn", text: "Duplicate", onclick: () => {
        const copy = Object.assign({}, project, { id: project.id + "-copy-" + Date.now().toString(36), title: (project.title || "") + " (copy)" });
        store.upsertProject(copy);
      }}),
      $("button", { class: "btn tb-btn-danger", text: "Delete", onclick: () => {
        if (confirm("Delete project " + project.id + "?")) store.deleteProject(project.id);
      }})
    ]);
    card.appendChild(footer);

    return card;
  }

  function summaryField(label, controlEl, focusKey) {
    if (focusKey && controlEl && !controlEl.getAttribute("data-focus-key")) {
      controlEl.setAttribute("data-focus-key", focusKey);
    }
    return $("div", { class: "pc-field" }, [
      $("div", { class: "pc-field-lbl", text: label }),
      controlEl
    ]);
  }

  function selectInput(value, options, onChange, allowBlank) {
    const sel = $("select", { class: "pc-inp" });
    if (allowBlank) sel.appendChild($("option", { value: "", text: "" }));
    options.forEach(o => {
      const opt = $("option", { value: o.value, text: o.label });
      if (o.value === value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", (e) => onChange(e.target.value));
    return sel;
  }

  function numericInput(value, onChange) {
    const inp = $("input", { type: "number", class: "pc-inp", value: value == null ? "" : value });
    inp.addEventListener("change", (e) => onChange(e.target.value === "" ? null : Number(e.target.value)));
    return inp;
  }

  function saveFocus(container) {
    const a = document.activeElement;
    if (!a || !container.contains(a)) return null;
    const key = a.getAttribute && a.getAttribute("data-focus-key");
    if (!key) return null;
    const snap = { key, scrollTop: container.scrollTop || (container.parentNode && container.parentNode.scrollTop) || 0 };
    try { snap.start = a.selectionStart; snap.end = a.selectionEnd; } catch (_) { /* selects/checkboxes throw */ }
    return snap;
  }

  function restoreFocus(container, snap) {
    if (!snap) return;
    const el = container.querySelector(`[data-focus-key="${snap.key.replace(/"/g, '\\"')}"]`);
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
    if (snap.start != null && snap.end != null && el.setSelectionRange) {
      try { el.setSelectionRange(snap.start, snap.end); } catch (_) {}
    }
    // Keep the scroll steady so the edit point does not jump.
    const scrollEl = container.scrollTop !== undefined ? container : container.parentNode;
    if (scrollEl && typeof snap.scrollTop === "number") scrollEl.scrollTop = snap.scrollTop;
  }

  function renderGrid(container, projects, store, ctx) {
    const snap = saveFocus(container);
    container.innerHTML = "";
    if (!projects.length) {
      container.appendChild($("div", { class: "placeholder", text: "No projects match the current filter." }));
      return;
    }
    const grid = $("div", { class: "pc-grid" });
    projects.forEach(p => grid.appendChild(renderCard(p, store, ctx)));
    container.appendChild(grid);
    restoreFocus(container, snap);
  }

  return { renderGrid, renderCard };
})();
