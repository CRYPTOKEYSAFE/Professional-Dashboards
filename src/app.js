/* app.js - boot. Robust to timing; surfaces errors instead of failing silently. */
(function () {
  "use strict";

  function showFatal(msg) {
    var app = document.getElementById("app");
    var box = document.createElement("pre");
    box.style.cssText = "margin:40px;padding:16px;border:1px solid #C8102E;background:#FFF0F0;color:#7A0000;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap;border-radius:4px;";
    box.textContent = "Dashboard failed to boot.\n\n" + msg + "\n\nOpen DevTools Console (Cmd+Opt+I on Mac, F12 on Windows) for more detail.";
    if (app) { app.innerHTML = ""; app.appendChild(box); }
    else document.body.appendChild(box);
  }

  // Global error trap - any unhandled error while booting surfaces visibly.
  window.addEventListener("error", function (e) {
    showFatal((e.error && e.error.stack) || e.message || "Unknown error");
  });

  function readEmbeddedJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var txt = (el.textContent || "").trim();
    if (!txt) return null;
    try { return JSON.parse(txt); }
    catch (e) { showFatal("Failed to parse embedded data block #" + id + ": " + e.message); return null; }
  }

  function boot() {
    try {
      if (!window.DataStore) throw new Error("DataStore module did not load.");
      if (!window.Shell) throw new Error("Shell module did not load.");
      var embedded = {
        projects:      readEmbeddedJSON("data-projects")      || [],
        ccnCatalog:    readEmbeddedJSON("data-ccn-catalog")   || [],
        installations: readEmbeddedJSON("data-installations") || [],
        programs:      readEmbeddedJSON("data-programs")      || []
      };
      window.DataStore.init(embedded);
      var app = document.getElementById("app");
      if (!app) throw new Error("Missing <div id=\"app\"> root.");
      window.Shell.mount(app);
      if (window.Persistence && window.Persistence.promptForViewerIfNeeded) {
        try { window.Persistence.promptForViewerIfNeeded(); } catch (_) { /* non-fatal */ }
      }
    } catch (e) {
      showFatal((e && e.stack) || String(e));
    }
  }

  // This script is the last in <body>, so the DOM is parsed by the time we run.
  // Boot immediately if possible, else wait.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
