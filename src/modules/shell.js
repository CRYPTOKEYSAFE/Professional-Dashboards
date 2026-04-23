/* shell.js — app chrome, routing, header filters, tooltips, keyboard shortcuts. */
window.Shell = (function () {
  "use strict";

  const $ = (tag, attrs, children) => {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (k === "html") el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => { if (c != null) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return el;
  };

  const icon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icon"); svg.setAttribute("width", 16); svg.setAttribute("height", 16); svg.setAttribute("viewBox", "0 0 24 24");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#icon-" + name);
    use.setAttribute("href", "#icon-" + name);
    svg.appendChild(use); return svg;
  };

  window.FilterState = { umbrella: null, installation: null, search: "" };
  const SECTIONS = [
    { id: "overview", label: "Overview", icon: "home" },
    { id: "projects", label: "Projects", icon: "grid" },
    { id: "ccns", label: "CCN Catalog", icon: "layers" },
    { id: "assignment", label: "CCN Assignment", icon: "link" },
    { id: "heatmap", label: "Heatmap", icon: "activity" },
    { id: "crosswalk", label: "Crosswalk", icon: "link" },
    { id: "admin", label: "Admin", icon: "settings" },
  ];

  let rootEl = null, mainEl = null, ttEl = null, lastSection = "overview";

  function dispatchFilter() {
    document.dispatchEvent(new CustomEvent("filter-change", { detail: Object.assign({}, window.FilterState) }));
  }

  function renderHeader() {
    const store = window.DataStore;
    const viewer = store.getViewer ? store.getViewer() : "";
    const umbrellas = ["DPRI", "12th MLR", "3/12", "Other"];
    const progs = store.listPrograms();
    const umbColor = (u) => (progs.find(p => p.umbrella === u) || {}).color || "#546270";

    const chips = $("div", { class: "umb-chips" }, umbrellas.map(u => $("button", {
      class: "umb-chip" + (window.FilterState.umbrella === u ? " active" : ""),
      style: `--c:${umbColor(u)}`,
      "data-tip": `Filter to ${u} only`,
      onclick: () => {
        window.FilterState.umbrella = window.FilterState.umbrella === u ? null : u;
        renderHeader();
        dispatchFilter();
      },
      text: u
    })));

    const installSel = $("select", { class: "inst-sel", onchange: (e) => { window.FilterState.installation = e.target.value || null; dispatchFilter(); } }, [
      $("option", { value: "", text: "All installations" }),
      ...store.listInstallations().map(i => {
        const opt = $("option", { value: i.name, text: i.name });
        if (window.FilterState.installation === i.name) opt.selected = true;
        return opt;
      })
    ]);

    const searchInp = $("input", { class: "search-inp", type: "search", placeholder: "Search…", value: window.FilterState.search, oninput: (e) => { window.FilterState.search = e.target.value; dispatchFilter(); } });

    const vwBtn = $("button", { class: "viewer-chip", "data-tip": "Click to change viewer name (used on exports)", onclick: () => promptViewerChange(), text: viewer ? "👤 " + viewer : "👤 Set viewer" });

    const actions = $("div", { class: "hdr-actions" }, [
      $("button", { class: "btn btn-ghost", "data-tip": "Undo (Ctrl+Z)", onclick: () => window.DataStore.undo() }, [icon("chevron-left"), document.createTextNode(" Undo")]),
      $("button", { class: "btn btn-ghost", "data-tip": "Redo (Ctrl+Shift+Z)", onclick: () => window.DataStore.redo() }, [icon("chevron-right"), document.createTextNode(" Redo")]),
      $("button", { class: "btn", "data-tip": "Export all data as JSON", onclick: () => window.Persistence.exportJSON() }, [icon("download"), document.createTextNode(" JSON")]),
      $("button", { class: "btn", "data-tip": "Download a fresh self-contained HTML with current edits", onclick: () => window.Persistence.downloadUpdatedHTML() }, [icon("download"), document.createTextNode(" HTML")]),
      $("button", { class: "btn", "data-tip": "Switch to client-facing Brief layout", onclick: () => toggleBriefLayout() }, [icon("eye"), document.createTextNode(" Brief")]),
    ]);

    const header = $("header", { class: "app-header" }, [
      $("div", { class: "hdr-left" }, [
        $("div", { class: "hdr-title" }, [$("strong", { text: "DPRI / 12th MLR / 3/12" }), $("span", { class: "hdr-sub u-muted", text: "Long-Range Facility Plan · FOUO" })]),
        vwBtn,
      ]),
      $("div", { class: "hdr-center" }, [chips, installSel, searchInp]),
      actions
    ]);
    const old = rootEl.querySelector(".app-header");
    if (old) old.replaceWith(header); else rootEl.appendChild(header);
  }

  function renderSidebar() {
    const nav = $("aside", { class: "sidebar" }, SECTIONS.map(s => $("button", {
      class: "nav-btn" + (lastSection === s.id ? " active" : ""),
      "data-section": s.id,
      "data-tip": s.label,
      onclick: () => go(s.id)
    }, [icon(s.icon), $("span", { class: "nav-lbl", text: s.label })])));
    const old = rootEl.querySelector(".sidebar");
    if (old) old.replaceWith(nav); else rootEl.appendChild(nav);
  }

  function renderMain() {
    mainEl = $("main", { class: "main", id: "main" });
    const old = rootEl.querySelector("main");
    if (old) old.replaceWith(mainEl); else rootEl.appendChild(mainEl);
  }

  function ensureTooltip() {
    if (ttEl) return;
    ttEl = $("div", { class: "tt" });
    document.body.appendChild(ttEl);
    let lastX = 0, lastY = 0;
    document.addEventListener("mousemove", (e) => { lastX = e.clientX; lastY = e.clientY; if (ttEl.classList.contains("show")) { ttEl.style.left = (lastX + 12) + "px"; ttEl.style.top = (lastY + 14) + "px"; } });
    document.addEventListener("mouseover", (e) => {
      const el = e.target.closest("[data-tip]");
      if (el) { ttEl.textContent = el.getAttribute("data-tip"); ttEl.classList.add("show"); ttEl.style.left = (lastX + 12) + "px"; ttEl.style.top = (lastY + 14) + "px"; }
    });
    document.addEventListener("mouseout", (e) => {
      const el = e.target.closest("[data-tip]");
      if (el) ttEl.classList.remove("show");
    });
  }

  function go(section) {
    if (!SECTIONS.find(s => s.id === section) && section !== "brief") return;
    lastSection = section;
    try { history.pushState({ section }, "", "#" + section); } catch (e) { /* file:// may block */ }
    mainEl.innerHTML = "";
    const render = window.Sections && window.Sections[section];
    if (typeof render === "function") render(mainEl);
    else mainEl.appendChild($("div", { class: "placeholder", text: `Section "${section}" not loaded.` }));
    renderSidebar();
  }

  function toggleBriefLayout(on) {
    const isOn = typeof on === "boolean" ? on : !document.body.classList.contains("layout-brief");
    document.body.classList.toggle("layout-brief", isOn);
    if (isOn && window.Sections && window.Sections.brief) go("brief");
    else if (!isOn) go(lastSection === "brief" ? "overview" : lastSection);
  }

  function promptViewerChange() {
    const current = window.DataStore.getViewer ? window.DataStore.getViewer() : "";
    const name = window.prompt("Your name (stamped on every export):", current || "");
    if (name != null) window.DataStore.setViewer(name.trim());
    renderHeader();
  }

  function keyboardShortcuts() {
    let leader = null, leaderT = null;
    document.addEventListener("keydown", (e) => {
      const t = e.target;
      const inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); window.DataStore.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); window.DataStore.redo(); return; }
      if (!inField && (e.key === "/" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"))) {
        e.preventDefault();
        const s = rootEl.querySelector(".search-inp"); if (s) s.focus();
        return;
      }
      if (e.key === "Escape" && document.body.classList.contains("layout-brief")) { toggleBriefLayout(false); return; }
      if (inField) return;
      if (e.key === "g") { leader = "g"; clearTimeout(leaderT); leaderT = setTimeout(() => leader = null, 1000); return; }
      if (leader === "g") {
        leader = null; clearTimeout(leaderT);
        const map = { o: "overview", p: "projects", c: "ccns", a: "assignment", h: "heatmap", x: "crosswalk", b: "brief" };
        if (map[e.key]) { e.preventDefault(); go(map[e.key]); }
      }
    });
  }

  function mount(el) {
    rootEl = el;
    rootEl.innerHTML = "";
    const layout = $("div", { class: "shell-root" });
    rootEl.appendChild(layout);
    renderHeader(); renderSidebar(); renderMain();
    ensureTooltip();
    keyboardShortcuts();

    // Initial section from hash
    const hash = (location.hash || "").replace("#", "");
    if (hash.includes("brief=1")) toggleBriefLayout(true);
    else go(hash || "overview");

    // Re-render header on data change (for counts, viewer)
    window.DataStore.on("change", () => {
      const u = window.DataStore.getViewer?.();
      const chip = rootEl.querySelector(".viewer-chip");
      if (chip && u) chip.textContent = "👤 " + u;
    });

    window.addEventListener("popstate", (e) => {
      const s = (location.hash || "").replace("#", "") || "overview";
      go(s);
    });
  }

  return { mount, go, toggleBriefLayout, promptViewerChange };
})();
