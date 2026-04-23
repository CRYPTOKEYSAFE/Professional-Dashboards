/* app.js — boot the dashboard. Runs after all modules + vendor libs load. */
(function () {
  "use strict";

  function readEmbeddedJSON(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const txt = (el.textContent || "").trim();
    if (!txt) return null;
    try { return JSON.parse(txt); } catch (e) { console.error("Failed to parse " + id, e); return null; }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const embedded = {
      projects: readEmbeddedJSON("data-projects") || [],
      ccnCatalog: readEmbeddedJSON("data-ccn-catalog") || [],
      installations: readEmbeddedJSON("data-installations") || [],
      programs: readEmbeddedJSON("data-programs") || [],
    };
    window.DataStore.init(embedded);
    window.Shell.mount(document.getElementById("app"));
    // Prompt for viewer name on first use (stamps exports)
    if (window.Persistence && window.Persistence.promptForViewerIfNeeded) {
      window.Persistence.promptForViewerIfNeeded();
    }
  });
})();
