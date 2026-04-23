/* brief.js - client-facing single-scroll layout. */
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

  window.Sections.brief = function (container) {
    const store = window.DataStore;
    document.body.classList.add("layout-brief");
    container.innerHTML = "";

    // Slide 1: Title
    const s1 = $("section", { class: "brief-slide brief-title" }, [
      $("div", { class: "foumark", text: "FOR OFFICIAL USE ONLY" }),
      $("h1", { text: "DPRI / MCIPAC Integrated Facilities" }),
      $("h2", { text: "Integrated Facilities Plan" }),
      $("div", { class: "brief-meta u-muted", text: `Prepared by ${store.getViewer?.() || "-"} · ${new Date().toLocaleDateString()}` }),
      $("button", { class: "btn", text: "Exit Brief (Esc)", onclick: () => { document.body.classList.remove("layout-brief"); window.Shell && window.Shell.go("overview"); } }),
      $("button", { class: "btn", text: "Print / PDF", onclick: () => window.print() })
    ]);
    container.appendChild(s1);

    // Slide 2: KPIs
    const s2 = $("section", { class: "brief-slide" }, [$("h2", { text: "Executive KPIs" }), $("div", { class: "brief-kpi-host" })]);
    container.appendChild(s2);
    if (window.Sections.overview) window.Sections.overview(s2.querySelector(".brief-kpi-host"));

    // Slide 3: Heatmap (reuse)
    const s3 = $("section", { class: "brief-slide" }, [$("h2", { text: "CCN Laydown Over Time" }), $("div", { class: "brief-hm-host" })]);
    container.appendChild(s3);
    if (window.Sections.heatmap) window.Sections.heatmap(s3.querySelector(".brief-hm-host"));

    // Slide 4: Installation summary
    const s4 = $("section", { class: "brief-slide" }, [$("h2", { text: "Installation Summary" })]);
    const progs = {}; store.listPrograms().forEach(p => progs[p.id] = p);
    store.listInstallations().forEach(i => {
      const proj = store.getProjects().filter(p => p.installation === i.name);
      if (!proj.length) return;
      const byU = {}; proj.forEach(p => { const u = progs[p.program]?.umbrella || "Other"; byU[u] = (byU[u] || 0) + 1; });
      s4.appendChild($("div", { class: "brief-inst-block" }, [
        $("h3", { text: i.name, style: `color:${i.color || "#1E3F5C"}` }),
        $("div", { class: "u-muted", text: Object.entries(byU).map(([k,v]) => `${k}: ${v}`).join(" · ") }),
        $("ul", { class: "side-list" }, proj.slice(0, 5).map(p => $("li", { text: p.title || p.id })))
      ]));
    });
    container.appendChild(s4);

    // Slide 5: Notes
    const s5 = $("section", { class: "brief-slide" }, [
      $("h2", { text: "Notes" }),
      $("textarea", { class: "brief-notes", rows: 10, placeholder: "Add talking points…", oninput: (e) => window.DataStore.setBriefNotes?.(e.target.value) })
    ]);
    container.appendChild(s5);

    // PageDown/PageUp between slides
    const slides = container.querySelectorAll(".brief-slide");
    let idx = 0;
    const onKey = (e) => {
      if (e.key === "PageDown" || (e.key === "ArrowDown" && e.ctrlKey)) { e.preventDefault(); idx = Math.min(idx + 1, slides.length - 1); slides[idx].scrollIntoView({ behavior: "smooth" }); }
      if (e.key === "PageUp" || (e.key === "ArrowUp" && e.ctrlKey)) { e.preventDefault(); idx = Math.max(idx - 1, 0); slides[idx].scrollIntoView({ behavior: "smooth" }); }
    };
    document.addEventListener("keydown", onKey);
    const mo = new MutationObserver(() => { if (!document.body.contains(container)) { document.body.classList.remove("layout-brief"); document.removeEventListener("keydown", onKey); mo.disconnect(); } });
    mo.observe(container.parentNode || document.body, { childList: true });
  };
})();
