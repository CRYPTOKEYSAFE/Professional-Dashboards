/* crosswalk.js - pick a project, see all other projects on the same installation grouped by umbrella. */
window.Sections = window.Sections || {};

(function () {
  "use strict";

  function buildBrief(p, peers, progs, references, viewer) {
    const inst = p.installation || "SACO";
    const date = new Date().toISOString().slice(0, 10);
    const name = (viewer || "").trim() || "(Prepared By not set)";
    const activation = p.activationFYOverride ?? p.activationFY ?? null;
    const activationLine = activation != null ? "FY" + activation : "not set";

    const groups = {};
    peers.forEach(x => {
      const u = progs[x.program]?.umbrella || "Other";
      groups[u] = groups[u] || [];
      groups[u].push(x);
    });

    let md = "";
    md += "UNCLASSIFIED // FOR OFFICIAL USE ONLY\n\n";
    md += `# ${inst}: Installation Brief\n\n`;
    md += `Prepared by ${name} on ${date}\n\n`;
    md += `**Focal project:** ${p.title || p.id} (${p.id})\n`;
    md += `Program: ${progs[p.program]?.label || p.program} | Activation FY ${activationLine}\n\n`;

    md += `## Adjacent projects on ${inst}\n\n`;
    if (!peers.length) {
      md += "_None._\n\n";
    } else {
      ["DPRI", "12th MLR", "3/12", "Other"].forEach(u => {
        const list = groups[u];
        if (!list || !list.length) return;
        md += `### ${u} (${list.length})\n\n`;
        list.slice(0, 50).forEach(x => {
          const label = progs[x.program]?.label || x.program;
          md += `- ${label} | ${x.title || x.id} (${x.id})\n`;
        });
        if (list.length > 50) md += `- ... and ${list.length - 50} more.\n`;
        md += "\n";
      });
    }

    if (references && references.length) {
      md += `## Projects that reference this one\n\n`;
      references.forEach(x => {
        const label = progs[x.program]?.umbrella || "Other";
        const rel = x.replaces === p.id ? "replaces" : "linked";
        md += `- ${label} | ${x.title || x.id} (${x.id}) [${rel}]\n`;
      });
      md += "\n";
    }

    md += "---\n\n";
    md += "UNCLASSIFIED // FOR OFFICIAL USE ONLY\n";
    return md;
  }

  // Expose at module-load time so tests and other modules can use it
  // without first navigating to the Crosswalk tab.
  window.CrosswalkBrief = { build: buildBrief };

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

  window.Sections.crosswalk = function (container) {
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

    const progs = {}; store.listPrograms().forEach(p => progs[p.id] = p);

    function renderList(q) {
      q = q || ""; list.innerHTML = "";
      store.getProjects().filter(p => (p.title || "").toLowerCase().includes(q) || (p.id || "").toLowerCase().includes(q)).slice(0, 400).forEach(p => {
        const color = progs[p.program]?.color || "#546270";
        list.appendChild($("button", { class: "asgn-item", onclick: () => select(p.id) }, [
          $("span", { class: "chip chip-small", style: `background:${color}1a;color:${color}`, text: progs[p.program]?.umbrella || "Other" }),
          $("span", { class: "asgn-item-title", text: p.title || p.id }),
          $("span", { class: "u-muted", text: ` · ${p.installation || "SACO"}` })
        ]));
      });
    }

    function select(pid) {
      const p = store.getProject(pid);
      right.innerHTML = "";
      if (!p) return;
      right.appendChild($("h3", { class: "section-h3", text: p.title || p.id }));
      right.appendChild($("div", { class: "u-muted", text: `${p.installation || "SACO"} · ${progs[p.program]?.label || p.program} · Activation FY ${p.activationFYOverride ?? p.activationFY ?? "(not set)"}` }));

      // Related on same installation grouped by umbrella
      const peers = store.getProjects().filter(x => x.id !== pid && x.installation === p.installation);
      const groups = {}; peers.forEach(x => { const u = progs[x.program]?.umbrella || "Other"; groups[u] = groups[u] || []; groups[u].push(x); });
      right.appendChild($("h4", { class: "section-h4", text: `Other projects on ${p.installation || "SACO"}` }));
      if (!peers.length) right.appendChild($("div", { class: "u-muted", text: "None." }));
      ["DPRI","12th MLR","3/12","Other"].forEach(u => {
        if (!groups[u] || !groups[u].length) return;
        right.appendChild($("h5", { class: "section-h5", text: `${u} (${groups[u].length})` }));
        const ul = $("ul", { class: "side-list" });
        groups[u].slice(0, 50).forEach(x => {
          const color = progs[x.program]?.color || "#546270";
          ul.appendChild($("li", {}, [
            $("span", { class: "chip chip-small", style: `background:${color}1a;color:${color}`, text: progs[x.program]?.label || x.program }),
            document.createTextNode(" "),
            $("a", { href: "#", onclick: (e) => { e.preventDefault(); select(x.id); }, text: x.title || x.id })
          ]));
        });
        right.appendChild(ul);
      });

      // References to this project
      const references = store.getProjects().filter(x => x.replaces === pid || (x.linked || []).includes(pid));
      if (references.length) {
        right.appendChild($("h4", { class: "section-h4", text: `Projects that reference this one` }));
        const ul = $("ul", { class: "side-list" });
        references.forEach(x => ul.appendChild($("li", {}, [$("a", { href: "#", onclick: (e) => { e.preventDefault(); select(x.id); }, text: x.title || x.id })])));
        right.appendChild(ul);
      }

      // Copy brief. The exported Markdown carries the FOUO handling caveat
      // top and bottom plus the Prepared By watermark to match every other
      // export surface in the dashboard.
      right.appendChild($("button", { class: "btn", text: "Copy installation brief (Markdown)", onclick: () => {
        const refs = store.getProjects().filter(x => x.replaces === pid || (x.linked || []).includes(pid));
        const md = buildBrief(p, peers, progs, refs, store.getViewer && store.getViewer());
        navigator.clipboard?.writeText(md).then(() => alert("Copied.")).catch(() => {
          const ta = $("textarea", { rows: 15, style: "width:100%" }); ta.value = md; right.appendChild(ta);
        });
      } }));
    }

    renderList("");
    right.appendChild($("div", { class: "u-muted", text: "Select a project on the left." }));

    const onC = () => renderList("");
    store.on("change", onC);
    document.addEventListener("section-unmount", function tear() {
      store.off("change", onC);
      document.removeEventListener("section-unmount", tear);
    });
  };
})();
