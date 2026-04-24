/* app.js - boot. Robust to timing; surfaces errors instead of failing silently.
 * Boot-phase errors replace #app with a fatal banner.
 * Post-mount errors append a dismissible strip under the top FOUO banner,
 * so the user keeps their working session and can copy the stack.
 */
(function () {
  "use strict";

  var booted = false;

  function ensureStrip() {
    var strip = document.getElementById("error-strip");
    if (strip) return strip;
    strip = document.createElement("div");
    strip.id = "error-strip";
    strip.setAttribute("role", "alert");
    strip.setAttribute("aria-live", "polite");
    // Insert right after the top banner so it sits inside the FOUO band.
    var top = document.querySelector(".banner-top");
    if (top && top.parentNode) top.parentNode.insertBefore(strip, top.nextSibling);
    else document.body.insertBefore(strip, document.body.firstChild);
    return strip;
  }

  function showFatal(msg) {
    var app = document.getElementById("app");
    var box = document.createElement("pre");
    box.className = "fatal-box";
    box.textContent = "Dashboard failed to boot.\n\n" + msg + "\n\nOpen DevTools Console (Cmd+Opt+I on Mac, F12 on Windows) for more detail.";
    if (app) { app.innerHTML = ""; app.appendChild(box); }
    else document.body.appendChild(box);
  }

  function showPostMount(label, detail) {
    var strip = ensureStrip();
    var item = document.createElement("div");
    item.className = "err-item";
    var title = document.createElement("div");
    title.className = "err-item-title";
    title.textContent = label;
    var body = document.createElement("pre");
    body.className = "err-item-body";
    body.textContent = detail;
    var close = document.createElement("button");
    close.className = "err-item-close";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "✕";
    close.onclick = function () { item.remove(); };
    item.appendChild(close);
    item.appendChild(title);
    item.appendChild(body);
    strip.appendChild(item);
  }

  function report(label, detail) {
    if (!booted) showFatal(detail);
    else showPostMount(label, detail);
  }

  window.addEventListener("error", function (e) {
    var detail = (e.error && e.error.stack) || e.message || "Error with no message";
    report("Error: " + (e.message || "unhandled"), detail);
  });

  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    var detail = (r && r.stack) || (r && r.message) || String(r);
    report("Unhandled promise rejection", detail);
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
      booted = true;
    } catch (e) {
      showFatal((e && e.stack) || String(e));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
