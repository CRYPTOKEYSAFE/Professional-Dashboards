/**
 * Persistence - JSON/CSV/HTML export, JSON import, viewer prompt.
 * Bridges DataStore state to the filesystem via Blob + anchor downloads.
 * All exports carry the FOUO watermark with viewer + date per §7.
 */
window.Persistence = (function () {
  'use strict';

  // --- constants ------------------------------------------------------------
  const LS_KEY = 'dashboard.v1';
  const LS_VIEWER_KEY = 'dashboard.v1.viewer';
  const EXPORT_VERSION = '1.0';

  // --- helpers --------------------------------------------------------------
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);

  /** Timestamp stem YYYYMMDD-HHmm used in every export filename. */
  const stamp = () => {
    const d = new Date();
    return (
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      '-' +
      pad2(d.getHours()) +
      pad2(d.getMinutes())
    );
  };

  /** ISO-YYYY-MM-DD for the FOUO header line. */
  const isoDate = () => {
    const d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  };

  const viewerName = () => (window.DataStore && window.DataStore.getViewer && window.DataStore.getViewer()) || 'Unknown Viewer';

  const fouoHeaderLine = () => 'FOUO - Prepared by ' + viewerName() + ' on ' + isoDate();

  /** Trigger a browser download of `blob` as `filename`. */
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after a tick so the download has a chance to latch onto the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // --- localStorage round-trip ---------------------------------------------

  /** @description Persist current DataStore state to localStorage. */
  const saveLocal = () => {
    if (!window.DataStore) return false;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(window.DataStore.serialize()));
      return true;
    } catch (err) {
      return false;
    }
  };

  /** @description Load DataStore state from localStorage (if present). Returns bool. */
  const loadLocal = () => {
    if (!window.DataStore) return false;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;
      window.DataStore.hydrate(parsed);
      return true;
    } catch (err) {
      return false;
    }
  };

  // --- JSON export / import -------------------------------------------------

  /** @description Export the full DataStore as a FOUO-watermarked JSON file download. */
  const exportJSON = () => {
    if (!window.DataStore) return;
    const viewer = viewerName();
    const payload = {
      // __header first so it greets anyone opening the file in a text editor.
      __header: fouoHeaderLine(),
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      viewer: viewer,
      data: window.DataStore.serialize()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'dashboard-export-' + stamp() + '.json');
  };

  /**
   * @description Read a JSON export File, hydrate DataStore, return load counts.
   * Returns a Promise<{projectsLoaded, ccnCatalogLoaded, installationsLoaded, programsLoaded, schemaColumnsLoaded}>.
   */
  const importJSON = (file) => {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('importJSON requires a File')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || ''));
          // Accept both raw-store shape and the wrapped export shape {version, data:{...}}.
          const payload = (parsed && parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
          if (!payload || typeof payload !== 'object') throw new Error('Invalid JSON structure');
          window.DataStore.hydrate(payload);
          const summary = {
            projectsLoaded:       Array.isArray(payload.projects)      ? payload.projects.length      : 0,
            ccnCatalogLoaded:     Array.isArray(payload.ccnCatalog)    ? payload.ccnCatalog.length    : 0,
            installationsLoaded:  Array.isArray(payload.installations) ? payload.installations.length : 0,
            programsLoaded:       Array.isArray(payload.programs)      ? payload.programs.length      : 0,
            schemaColumnsLoaded:  (payload.schema && Array.isArray(payload.schema.columns)) ? payload.schema.columns.length : 0
          };
          resolve(summary);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  };

  // --- CSV export -----------------------------------------------------------

  /** Flatten a project row for CSV - scalar columns only, nested objects JSON-stringified. */
  const flattenProjectForCSV = (p) => {
    const row = {};
    Object.keys(p).forEach((k) => {
      const v = p[k];
      if (v === null || v === undefined) { row[k] = ''; return; }
      if (typeof v === 'object') { row[k] = JSON.stringify(v); return; }
      row[k] = v;
    });
    return row;
  };

  /** Flatten CCN assignments across projects for the 'assignments' export. */
  const flattenAssignments = (projects) => {
    const out = [];
    projects.forEach((p) => {
      const ccns = Array.isArray(p.ccns) ? p.ccns : [];
      ccns.forEach((a) => {
        out.push({
          projectId:    p.id,
          projectTitle: p.title || '',
          installation: p.installation || '',
          program:      p.program || '',
          ccn:          a.ccn,
          qty:          a.qty,
          scheduledFY:  a.scheduledFY,
          note:         a.note || ''
        });
      });
    });
    return out;
  };

  /**
   * @description Export a CSV for 'projects' | 'ccns' | 'assignments' via PapaParse.
   * File starts with a FOUO comment line above the header row.
   */
  const exportCSV = (section) => {
    if (!window.Papa || !window.DataStore) return;
    const store = window.DataStore.serialize();
    let rows = [];
    let stem = 'dashboard';
    if (section === 'projects') {
      rows = (store.projects || []).map(flattenProjectForCSV);
      stem = 'projects';
    } else if (section === 'ccns') {
      rows = store.ccnCatalog || [];
      stem = 'ccns';
    } else if (section === 'assignments') {
      rows = flattenAssignments(store.projects || []);
      stem = 'assignments';
    } else {
      throw new Error('exportCSV: unknown section ' + section);
    }
    const body = window.Papa.unparse(rows, { quotes: false, header: true });
    // The leading '#' comment line carries the FOUO watermark. Most CSV
    // consumers tolerate/ignore a leading comment; Papa reads it back with
    // {comments:'#'}.
    const csv = '# ' + fouoHeaderLine() + '\n' + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, stem + '-' + stamp() + '.csv');
  };

  // --- re-bake HTML with current state --------------------------------------

  const EMBEDDED_IDS = {
    'data-projects':      'projects',
    'data-ccn-catalog':   'ccnCatalog',
    'data-installations': 'installations',
    'data-programs':      'programs'
  };

  /**
   * Replace the textContent of a `<script id="..." type="application/json">`
   * in an HTML string, preserving the surrounding tag and attributes.
   * We match greedily from the opening tag to the matching closing tag.
   */
  const replaceEmbeddedScript = (html, id, jsonText) => {
    // Escape JSON for embedding inside </script>-safe block. JSON cannot contain
    // a literal </script>, but JSON can contain the substring - we break it up.
    const safe = jsonText.replace(/<\/script>/gi, '<\\/script>');
    // Case-insensitive, minimal match; tolerate attribute order and whitespace.
    const re = new RegExp(
      '(<script\\b[^>]*\\bid=["\\\']' + id + '["\\\'][^>]*>)([\\s\\S]*?)(<\\/script>)',
      'i'
    );
    if (!re.test(html)) return html;
    return html.replace(re, '$1\n' + safe + '\n$3');
  };

  /**
   * @description Re-bake the current DataStore state into a fresh dashboard HTML file
   * and trigger a download. Injects a <meta name="dashboard-exported-at"> in <head>.
   */
  const downloadUpdatedHTML = () => {
    if (!window.DataStore) return;
    const store = window.DataStore.serialize();
    let html = document.documentElement.outerHTML;

    // Swap each embedded data script's textContent with the live store slice.
    Object.keys(EMBEDDED_IDS).forEach((id) => {
      const key = EMBEDDED_IDS[id];
      const slice = store[key];
      if (slice === undefined) return;
      html = replaceEmbeddedScript(html, id, JSON.stringify(slice, null, 2));
    });

    // Inject / refresh the exported-at meta tag in <head>.
    const metaTag =
      '<meta name="dashboard-exported-at" content="' + new Date().toISOString() +
      '" data-viewer="' + String(viewerName()).replace(/"/g, '&quot;') + '">';
    if (/<meta\s+name=["\']dashboard-exported-at["\'][^>]*>/i.test(html)) {
      html = html.replace(/<meta\s+name=["\']dashboard-exported-at["\'][^>]*>/i, metaTag);
    } else if (/<head\b[^>]*>/i.test(html)) {
      html = html.replace(/(<head\b[^>]*>)/i, '$1\n' + metaTag);
    }

    // The current page wraps outerHTML with <html> but omits the doctype -
    // re-add it so the shipped file opens in standards mode.
    const doctype = '<!DOCTYPE html>\n';
    if (!/^\s*<!DOCTYPE/i.test(html)) html = doctype + html;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, 'dashboard-FOUO-' + stamp() + '.html');
  };

  // --- viewer prompt --------------------------------------------------------

  /** Build the viewer-prompt <dialog> lazily on first call. */
  const buildViewerDialog = (onSubmit) => {
    const dlg = document.createElement('dialog');
    dlg.setAttribute('data-dashboard-role', 'viewer-prompt');
    // Minimal inline styling - the app stylesheet can override.
    dlg.style.padding = '20px 22px';
    dlg.style.border = '1px solid #CDD5DE';
    dlg.style.borderRadius = '6px';
    dlg.style.minWidth = '320px';
    dlg.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    dlg.style.fontSize = '13px';
    dlg.style.color = '#1B2535';
    dlg.style.background = '#FFFFFF';

    const heading = document.createElement('h2');
    heading.textContent = 'Viewer name (FOUO watermark)';
    heading.style.margin = '0 0 8px 0';
    heading.style.fontSize = '15px';
    heading.style.color = '#1E3F5C';
    dlg.appendChild(heading);

    const help = document.createElement('p');
    help.textContent = 'Every export will be watermarked "Prepared by <name>".';
    help.style.margin = '0 0 12px 0';
    help.style.color = '#546270';
    dlg.appendChild(help);

    const form = document.createElement('form');
    form.method = 'dialog';

    const input = document.createElement('input');
    input.type = 'text';
    input.name = 'viewerName';
    input.required = true;
    input.autocomplete = 'name';
    input.placeholder = 'e.g. J. Smith, MCIPAC G-F';
    input.style.width = '100%';
    input.style.padding = '6px 8px';
    input.style.border = '1px solid #CDD5DE';
    input.style.borderRadius = '4px';
    input.style.marginBottom = '12px';
    input.style.boxSizing = 'border-box';
    form.appendChild(input);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'flex-end';
    btnRow.style.gap = '8px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Skip';
    cancel.style.padding = '6px 12px';
    cancel.style.background = '#EDF0F4';
    cancel.style.color = '#1B2535';
    cancel.style.border = '1px solid #CDD5DE';
    cancel.style.borderRadius = '4px';
    cancel.style.cursor = 'pointer';
    cancel.addEventListener('click', () => {
      dlg.close();
      onSubmit('');
    });
    btnRow.appendChild(cancel);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Save';
    submit.style.padding = '6px 12px';
    submit.style.background = '#1E3F5C';
    submit.style.color = '#FFFFFF';
    submit.style.border = '1px solid #1E3F5C';
    submit.style.borderRadius = '4px';
    submit.style.cursor = 'pointer';
    btnRow.appendChild(submit);

    form.appendChild(btnRow);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = (input.value || '').trim();
      dlg.close();
      onSubmit(val);
    });

    dlg.appendChild(form);
    document.body.appendChild(dlg);
    return { dialog: dlg, input: input };
  };

  /**
   * @description If DataStore has no viewer, show a <dialog> prompt and store the result.
   * Returns a Promise<string> resolving with whatever viewer name is now set (may be '').
   */
  const promptForViewerIfNeeded = () => {
    return new Promise((resolve) => {
      if (!window.DataStore) { resolve(''); return; }
      const current = window.DataStore.getViewer();
      if (current && String(current).trim()) { resolve(current); return; }

      // Fallback to a stored viewer in localStorage (set previously) if DataStore
      // was freshly initialized without one.
      try {
        const cached = localStorage.getItem(LS_VIEWER_KEY);
        if (cached) {
          window.DataStore.setViewer(cached);
          resolve(cached);
          return;
        }
      } catch (err) { /* ignore */ }

      const parts = buildViewerDialog((name) => {
        if (name) {
          window.DataStore.setViewer(name);
          try { localStorage.setItem(LS_VIEWER_KEY, name); } catch (err) { /* ignore */ }
        }
        // Tidy up - dialogs are single-use here.
        if (parts.dialog.parentNode) parts.dialog.parentNode.removeChild(parts.dialog);
        resolve(name || '');
      });

      if (typeof parts.dialog.showModal === 'function') {
        parts.dialog.showModal();
      } else {
        // Legacy fallback - render inline if <dialog> isn't supported.
        parts.dialog.setAttribute('open', '');
      }
      parts.input.focus();
    });
  };

  // --- public API -----------------------------------------------------------
  return {
    saveLocal: saveLocal,
    loadLocal: loadLocal,
    exportJSON: exportJSON,
    importJSON: importJSON,
    exportCSV: exportCSV,
    downloadUpdatedHTML: downloadUpdatedHTML,
    promptForViewerIfNeeded: promptForViewerIfNeeded
  };
})();
