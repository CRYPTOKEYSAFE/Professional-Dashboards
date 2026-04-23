/* crosswalk.js - pick a project, see all other projects on the same installation grouped by umbrella. */
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
      right.appendChild($("div", { class: "u-muted", text: `${p.installation || "SACO"} · ${progs[p.program]?.label || p.program} · A Finish FY${p.activationFYOverride ?? p.activationFY ?? "-"}` }));

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

      // Copy brief
      right.appendChild($("button", { class: "btn", text: "Copy installation brief (Markdown)", onclick: () => {
        const md = buildBrief(p, peers, progs);
        navigator.clipboard?.writeText(md).then(() => alert("Copied.")).catch(() => {
          // fallback: show in textarea
          const ta = $("textarea", { rows: 15, style: "width:100%" }); ta.value = md; right.appendChild(ta);
        });
      } }));
    }

    function buildBrief(p, peers, progs) {
      let md = `# ${p.installation || "SACO"} - Installation Brief (FOUO)\n\n`;
      md += `**Focal project:** ${p.title} (${p.id})  \n`;
      md += `Program: ${progs[p.program]?.label} · A Finish FY${p.activationFYOverride ?? p.activationFY ?? "-"}\n\n`;
      md += `## Adjacent projects\n\n`;
      peers.slice(0, 50).forEach(x => { md += `- [${progs[x.program]?.umbrella || "Other"}] ${x.title || x.id}\n`; });
      return md;
    }

    renderList("");
    right.appendChild($("div", { class: "u-muted", text: "Select a project on the left." }));

    const onC = () => renderList("");
    store.on("change", onC);
    const mo = new MutationObserver(() => { if (!document.body.contains(container)) { store.off("change", onC); mo.disconnect(); } });
    mo.observe(container.parentNode || document.body, { childList: true });
  };
})();
