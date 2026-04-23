/* shell.js - app chrome, routing, header filters, tooltips, keyboard shortcuts. */
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

  let rootEl = null, mainEl = null, ttEl = null, lastSection = "overview", layoutEl = null;

  function dispatchFilter() {
    document.dispatchEvent(new CustomEvent("filter-change", { detail: Object.assign({}, window.FilterState) }));
  }

  function renderHeader() {
    const store = window.DataStore;
    const viewer = store.getViewer ? store.getViewer() : "";
    const umbrellas = ["DPRI", "12th MLR", "3/12", "Other"];
    const progs = store.listPrograms();
    const umbColor = (u) => (progs.find(p => p.umbrella === u) || {}).color || "#546270";
    const umbCount = (u) => progs.filter(p => p.umbrella === u).length;
    const projCt = store.getProjects().length;

    // Installation tabs (DPRI-style)
    const installs = store.listInstallations();
    const instTabs = $("div", { class: "inst-tabs", role: "tablist" });
    const allTab = $("button", {
      class: "inst-tab" + (!window.FilterState.installation ? " active" : ""),
      role: "tab",
      "data-tip": "All installations",
      onclick: () => { window.FilterState.installation = null; renderHeader(); dispatchFilter(); },
      text: `All (${projCt})`
    });
    instTabs.appendChild(allTab);
    installs.forEach(i => {
      const count = store.getProjects({ installation: i.name }).length;
      if (count === 0) return;
      const short = i.name.replace("Camp ", "");
      instTabs.appendChild($("button", {
        class: "inst-tab" + (window.FilterState.installation === i.name ? " active" : ""),
        role: "tab",
        style: `--c:${i.color}`,
        "data-tip": `${i.name}: ${count} projects`,
        onclick: () => { window.FilterState.installation = window.FilterState.installation === i.name ? null : i.name; renderHeader(); dispatchFilter(); },
        text: `${short} (${count})`
      }));
    });

    // Program tabs (secondary)
    const progTabs = $("div", { class: "prog-tabs" }, umbrellas.map(u => $("button", {
      class: "prog-tab" + (window.FilterState.umbrella === u ? " active" : ""),
      style: `--c:${umbColor(u)}`,
      "data-tip": `Filter to ${u} projects`,
      onclick: () => {
        window.FilterState.umbrella = window.FilterState.umbrella === u ? null : u;
        renderHeader(); dispatchFilter();
      },
      text: u
    })));

    const searchInp = $("input", { class: "search-inp", type: "search", placeholder: "Search project, ID, building...", value: window.FilterState.search, oninput: (e) => { window.FilterState.search = e.target.value; dispatchFilter(); } });

    const vwBtn = $("button", { class: "viewer-chip", "data-tip": "Change viewer name (stamped on exports)", onclick: () => promptViewerChange(), text: viewer ? "Viewer: " + viewer : "Set Viewer" });

    // Clocks (JST / HST / EST / PST / ZULU)
    const clocks = $("div", { class: "hdr-clocks" });
    const tzList = [
      { tz: "JST", iana: "Asia/Tokyo" },
      { tz: "HST", iana: "Pacific/Honolulu" },
      { tz: "EST", iana: "America/New_York" },
      { tz: "PST", iana: "America/Los_Angeles" },
      { tz: "ZULU", iana: "UTC" }
    ];
    tzList.forEach(({ tz, iana }, idx) => {
      const item = $("div", { class: "clock-item", "data-tip": iana }, [
        $("div", { class: "clock-tz", text: tz }),
        $("div", { class: "clock-time", id: "clk-" + tz.toLowerCase(), text: "--:--" })
      ]);
      clocks.appendChild(item);
      if (idx < tzList.length - 1) clocks.appendChild($("div", { class: "clk-sep" }));
    });

    const actions = $("div", { class: "hdr-actions" }, [
      $("button", { class: "tb-btn", "data-tip": "Undo last edit (Ctrl+Z)", onclick: () => window.DataStore.undo(), text: "Undo" }),
      $("button", { class: "tb-btn", "data-tip": "Redo (Ctrl+Shift+Z)", onclick: () => window.DataStore.redo(), text: "Redo" }),
      $("button", { class: "tb-btn", "data-tip": "Export data as JSON", onclick: () => window.Persistence.exportJSON(), text: "JSON" }),
      $("button", { class: "tb-btn", "data-tip": "Download self-contained HTML with current edits", onclick: () => window.Persistence.downloadUpdatedHTML(), text: "HTML" }),
      $("button", { class: "tb-btn", "data-tip": "Print or save as PDF", onclick: () => window.print(), text: "Print" }),
      $("button", { class: "tb-btn", "data-tip": "Client briefing layout", onclick: () => toggleBriefLayout(), text: "Brief" }),
      $("button", { class: "tb-btn tb-btn-danger", "data-tip": "Clear all filters", onclick: () => { window.FilterState = { umbrella: null, installation: null, search: "" }; renderHeader(); dispatchFilter(); }, text: "Clear" })
    ]);

    const header = $("header", { class: "app-header" }, [
      $("div", { class: "hdr-row-1" }, [
        $("div", { class: "hdr-left" }, [
          $("div", { class: "hdr-org", text: "MCIPAC G-F / PPE" }),
          $("div", { class: "hdr-title", text: "DPRI / 12th MLR / 3/12 Long-Range Facility Plan" }),
          $("div", { class: "hdr-sub", text: "Defense Policy Review Initiative / 12th Marine Littoral Regiment / 3d Bn 12th Marines" }),
          $("div", { class: "hdr-attr", text: `${projCt} projects / ${store.listCCNs().length} CCN catalog entries / Source: FC 2-000-05N Appendix A` })
        ]),
        clocks
      ]),
      $("div", { class: "hdr-row-2" }, [
        instTabs,
        $("div", { class: "hdr-divider" }),
        progTabs,
        $("div", { class: "u-grow" }),
        searchInp,
        vwBtn
      ]),
      $("div", { class: "hdr-row-3" }, [
        actions
      ])
    ]);
    const old = layoutEl.querySelector(".app-header");
    if (old) old.replaceWith(header); else layoutEl.appendChild(header);
    startClocks();
  }

  let clockInterval = null;
  function startClocks() {
    if (clockInterval) return;
    const update = () => {
      const now = new Date();
      const map = {
        jst: "Asia/Tokyo", hst: "Pacific/Honolulu",
        est: "America/New_York", pst: "America/Los_Angeles", zulu: "UTC"
      };
      for (const id in map) {
        const el = document.getElementById("clk-" + id);
        if (!el) continue;
        try {
          el.textContent = now.toLocaleTimeString("en-US", { timeZone: map[id], hour: "2-digit", minute: "2-digit", hour12: false });
        } catch (e) { /* ignore */ }
      }
    };
    update();
    clockInterval = setInterval(update, 30000);
  }

  function renderSidebar() {
    const nav = $("aside", { class: "sidebar" }, SECTIONS.map(s => $("button", {
      class: "nav-btn" + (lastSection === s.id ? " active" : ""),
      "data-section": s.id,
      "data-tip": s.label,
      onclick: () => go(s.id)
    }, [icon(s.icon), $("span", { class: "nav-lbl", text: s.label })])));
    const old = layoutEl.querySelector(".sidebar");
    if (old) old.replaceWith(nav); else layoutEl.appendChild(nav);
  }

  function renderMain() {
    mainEl = $("main", { class: "main", id: "main" });
    const old = layoutEl.querySelector("main");
    if (old) old.replaceWith(mainEl); else layoutEl.appendChild(mainEl);
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
    layoutEl = $("div", { class: "shell-root" });
    rootEl.appendChild(layoutEl);
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
