/**
 * DataStore - single source of truth for the dashboard at runtime.
 * Holds projects, ccn catalog, installations, programs, schema, viewer.
 * Every mutation snapshots to a 20-state history ring buffer, writes
 * through to localStorage, and emits a 'change' event.
 */
window.DataStore = (function () {
  'use strict';

  // --- constants ------------------------------------------------------------
  var LS_KEY = 'dashboard.v1';
  var LS_HISTORY_KEY = 'dashboard.v1.history';
  var LS_VIEWER_KEY = 'dashboard.v1.viewer';
  var HISTORY_MAX = 20;

  // --- internal state -------------------------------------------------------
  var state = {
    projects: [],
    ccnCatalog: [],
    installations: [],
    programs: [],
    schema: { columns: [] },
    viewer: ''
  };

  // Undo/redo: `history` holds past snapshots; `future` holds states popped
  // by undo() so they can be reapplied by redo(). Any fresh mutation clears
  // `future` - the usual editor semantics.
  var history = [];
  var future = [];

  var listeners = {}; // event -> [cb,...]

  // --- built-in project columns mirroring §3.1 ------------------------------
  // userDefined:false guards against deletion by the Schema editor (see below).
  var BUILTIN_COLUMNS = [
    { key: 'id',                  label: 'ID',                type: 'text',     userDefined: false, order: 0 },
    { key: 'source',              label: 'Source',            type: 'enum',     enumValues: ['dpri', 'mlr'], userDefined: false, order: 1 },
    { key: 'program',             label: 'Program',           type: 'enum',     userDefined: false, order: 2 },
    { key: 'title',               label: 'Title',             type: 'text',     userDefined: false, order: 3 },
    { key: 'installation',        label: 'Installation',      type: 'text',     userDefined: false, order: 4 },
    { key: 'unknownInstallation', label: 'Unknown Install',   type: 'bool',     userDefined: false, order: 5, hidden: true },
    { key: 'bldg',                label: 'Bldg',              type: 'text',     userDefined: false, order: 6 },
    { key: 'projectType',         label: 'Project Type',      type: 'enum',     enumValues: ['NEW', 'REPLACEMENT', 'DEMO', 'CONSOLIDATION', 'CONVERSION', 'RELOCATION'], userDefined: false, order: 7 },
    { key: 'phase',               label: 'Phase',             type: 'number',   userDefined: false, order: 8 },
    { key: 'fundingSource',       label: 'Funding Source',    type: 'enum',     enumValues: ['FSRM', 'MILCON', 'Mod-Camp'], userDefined: false, order: 9 },
    { key: 'status',              label: 'Status',            type: 'enum',     enumValues: ['In Planning', 'Complete', 'Not Started'], userDefined: false, order: 10 },
    { key: 'priority',            label: 'Priority',          type: 'text',     userDefined: false, order: 11 },
    { key: 'totalCost',           label: 'Total Cost',        type: 'currency', unit: 'USD', userDefined: false, order: 12 },
    { key: 'fyPlan',              label: 'FY Plan',           type: 'object',   userDefined: false, order: 13, hidden: true },
    { key: 'dates',               label: 'Dates',             type: 'object',   userDefined: false, order: 14, hidden: true },
    { key: 'bodFY',               label: 'BOD FY',            type: 'number',   userDefined: false, order: 15 },
    { key: 'bodFYOverride',       label: 'BOD FY Override',   type: 'number',   userDefined: false, order: 16 },
    { key: 'foc',                 label: 'FOC',               type: 'text',     userDefined: false, order: 17 },
    { key: 'focTierRaw',          label: 'FOC Tier Raw',      type: 'text',     userDefined: false, order: 18, hidden: true },
    { key: 'replaces',            label: 'Replaces',          type: 'text',     userDefined: false, order: 19 },
    { key: 'linked',              label: 'Linked',            type: 'array',    userDefined: false, order: 20 },
    { key: 'locked',              label: 'Locked',            type: 'bool',     userDefined: false, order: 21 },
    { key: 'notes',               label: 'Notes',             type: 'text',     userDefined: false, order: 22 },
    { key: 'ccns',                label: 'CCN Assignments',   type: 'array',    userDefined: false, order: 23, hidden: true }
  ];

  // --- helpers --------------------------------------------------------------
  var deepCopy = function (v) {
    if (v === null || typeof v !== 'object') return v;
    // structuredClone is widely available; fall back to JSON for older engines.
    if (typeof structuredClone === 'function') return structuredClone(v);
    return JSON.parse(JSON.stringify(v));
  };

  var emit = function (event, payload) {
    var subs = listeners[event];
    if (!subs) return;
    subs.slice().forEach(function (cb) {
      try { cb(payload); } catch (err) { /* swallow listener errors */ }
    });
  };

  var persist = function () {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(serializeState()));
      localStorage.setItem(LS_HISTORY_KEY, JSON.stringify({ history: history, future: future }));
      if (state.viewer) localStorage.setItem(LS_VIEWER_KEY, state.viewer);
    } catch (err) {
      // localStorage may be full or disabled; mutations still live in memory.
    }
  };

  var serializeState = function () {
    return {
      projects:      deepCopy(state.projects),
      ccnCatalog:    deepCopy(state.ccnCatalog),
      installations: deepCopy(state.installations),
      programs:      deepCopy(state.programs),
      schema:        deepCopy(state.schema),
      viewer:        state.viewer
    };
  };

  // Snapshots everything EXCEPT the history stacks themselves to avoid
  // quadratic memory growth on long edit sessions.
  var snapshot = function () {
    history.push(serializeState());
    if (history.length > HISTORY_MAX) history.shift();
    future.length = 0;
  };

  var restoreFrom = function (snap) {
    state.projects      = deepCopy(snap.projects) || [];
    state.ccnCatalog    = deepCopy(snap.ccnCatalog) || [];
    state.installations = deepCopy(snap.installations) || [];
    state.programs      = deepCopy(snap.programs) || [];
    state.schema        = deepCopy(snap.schema) || { columns: [] };
    state.viewer        = snap.viewer || '';
  };

  var mutate = function (type, payload, fn) {
    snapshot();
    var result = fn();
    persist();
    emit('change', { type: type, payload: payload });
    return result;
  };

  var findIndexById = function (arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return i;
    return -1;
  };

  var readEmbeddedJSON = function (elementId) {
    var el = typeof document !== 'undefined' ? document.getElementById(elementId) : null;
    if (!el || !el.textContent) return null;
    try { return JSON.parse(el.textContent); } catch (err) { return null; }
  };

  // --- init / hydrate -------------------------------------------------------

  /** @description Hydrate store from embedded JSON; localStorage wins when present. */
  var init = function (embedded) {
    embedded = embedded || {};
    // Prefer explicit embedded args; fall back to <script id="data-*"> blocks.
    var emProjects      = embedded.projects      || readEmbeddedJSON('data-projects')      || [];
    var emCcnCatalog    = embedded.ccnCatalog    || readEmbeddedJSON('data-ccn-catalog')   || [];
    var emInstallations = embedded.installations || readEmbeddedJSON('data-installations') || [];
    var emPrograms      = embedded.programs      || readEmbeddedJSON('data-programs')      || [];

    state.projects      = deepCopy(emProjects);
    state.ccnCatalog    = deepCopy(emCcnCatalog);
    state.installations = deepCopy(emInstallations);
    state.programs      = deepCopy(emPrograms);
    state.schema        = { columns: deepCopy(BUILTIN_COLUMNS) };
    state.viewer        = '';

    // localStorage wins - it represents the edited version the user expects
    // to see when they reopen the file.
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          if (Array.isArray(saved.projects))      state.projects      = saved.projects;
          if (Array.isArray(saved.ccnCatalog))    state.ccnCatalog    = saved.ccnCatalog;
          if (Array.isArray(saved.installations)) state.installations = saved.installations;
          if (Array.isArray(saved.programs))      state.programs      = saved.programs;
          if (saved.schema && Array.isArray(saved.schema.columns)) state.schema = saved.schema;
          if (typeof saved.viewer === 'string')   state.viewer        = saved.viewer;
        }
      }
      var rawHist = localStorage.getItem(LS_HISTORY_KEY);
      if (rawHist) {
        var h = JSON.parse(rawHist);
        if (h && Array.isArray(h.history)) history = h.history;
        if (h && Array.isArray(h.future))  future  = h.future;
      }
      var rawViewer = localStorage.getItem(LS_VIEWER_KEY);
      if (rawViewer && !state.viewer) state.viewer = rawViewer;
    } catch (err) {
      // ignore corrupt localStorage; start clean from embedded.
    }

    emit('change', { type: 'init', payload: null });
  };

  /** @description Return a deep snapshot of the full store. */
  var getAll = function () {
    return serializeState();
  };

  // --- projects -------------------------------------------------------------

  /** @description List projects, filtered by umbrella/program/installation/search (all AND-joined). */
  var getProjects = function (filter) {
    if (!filter) return deepCopy(state.projects);
    var umbrella       = filter.umbrella;
    var program        = filter.program;
    var installation   = filter.installation;
    var search         = filter.search ? String(filter.search).toLowerCase() : null;

    var programsById = {};
    state.programs.forEach(function (p) { programsById[p.id] = p; });

    var out = [];
    for (var i = 0; i < state.projects.length; i++) {
      var p = state.projects[i];
      if (program && p.program !== program) continue;
      if (installation && p.installation !== installation) continue;
      if (umbrella) {
        var prog = programsById[p.program];
        if (!prog || prog.umbrella !== umbrella) continue;
      }
      if (search) {
        var progLabel = (programsById[p.program] && programsById[p.program].label) || '';
        var hay = (
          (p.title || '') + ' ' +
          (p.id || '') + ' ' +
          (p.installation || '') + ' ' +
          progLabel
        ).toLowerCase();
        if (hay.indexOf(search) === -1) continue;
      }
      out.push(deepCopy(p));
    }
    return out;
  };

  /** @description Return a single project by id, or null. */
  var getProject = function (id) {
    var idx = findIndexById(state.projects, id);
    return idx === -1 ? null : deepCopy(state.projects[idx]);
  };

  /** @description Insert or update a project by id; emits 'change'. */
  var upsertProject = function (p) {
    if (!p || !p.id) throw new Error('upsertProject requires an id');
    return mutate('upsertProject', p, function () {
      var idx = findIndexById(state.projects, p.id);
      var copy = deepCopy(p);
      if (idx === -1) state.projects.push(copy);
      else state.projects[idx] = copy;
      return copy;
    });
  };

  /** @description Delete a project by id; emits 'change'. */
  var deleteProject = function (id) {
    return mutate('deleteProject', { id: id }, function () {
      var idx = findIndexById(state.projects, id);
      if (idx === -1) return false;
      state.projects.splice(idx, 1);
      return true;
    });
  };

  // --- ccn catalog ----------------------------------------------------------

  /** @description Return a CCN catalog entry by code (matches code or codeNormalized). */
  var getCCN = function (code) {
    if (!code) return null;
    for (var i = 0; i < state.ccnCatalog.length; i++) {
      var c = state.ccnCatalog[i];
      if (c.code === code || c.codeNormalized === code) return deepCopy(c);
    }
    return null;
  };

  /** @description Insert or update a CCN catalog entry (keyed by codeNormalized); emits 'change'. */
  var upsertCCN = function (c) {
    if (!c || !c.code) throw new Error('upsertCCN requires a code');
    return mutate('upsertCCN', c, function () {
      var copy = deepCopy(c);
      if (!copy.codeNormalized) copy.codeNormalized = String(copy.code).trim();
      // Uniqueness guard per §7: codeNormalized is the primary key.
      var idx = -1;
      for (var i = 0; i < state.ccnCatalog.length; i++) {
        if (state.ccnCatalog[i].codeNormalized === copy.codeNormalized) { idx = i; break; }
      }
      if (idx === -1) state.ccnCatalog.push(copy);
      else state.ccnCatalog[idx] = copy;
      return copy;
    });
  };

  /** @description Delete a CCN catalog entry by code/codeNormalized; emits 'change'. */
  var deleteCCN = function (code) {
    return mutate('deleteCCN', { code: code }, function () {
      for (var i = 0; i < state.ccnCatalog.length; i++) {
        var c = state.ccnCatalog[i];
        if (c.code === code || c.codeNormalized === code) {
          state.ccnCatalog.splice(i, 1);
          return true;
        }
      }
      return false;
    });
  };

  /** @description Return the full CCN catalog (snapshot copy). */
  var listCCNs = function () {
    return deepCopy(state.ccnCatalog);
  };

  // --- programs -------------------------------------------------------------

  /** @description Return program metadata by id, or null. */
  var getProgram = function (id) {
    var idx = findIndexById(state.programs, id);
    return idx === -1 ? null : deepCopy(state.programs[idx]);
  };

  /** @description Return the list of all programs (snapshot copy). */
  var listPrograms = function () {
    return deepCopy(state.programs);
  };

  /** @description Insert or update a program by id; emits 'change'. */
  var upsertProgram = function (prog) {
    if (!prog || !prog.id) throw new Error('upsertProgram requires an id');
    return mutate('upsertProgram', prog, function () {
      var idx = findIndexById(state.programs, prog.id);
      var copy = deepCopy(prog);
      if (idx === -1) state.programs.push(copy);
      else state.programs[idx] = copy;
      return copy;
    });
  };

  /**
   * @description Delete a program by id. Cascade-guarded: if projects reference it,
   * returns {blocked:true,count} unless options.reassignTo is supplied, in which case
   * referencing projects are bulk-reassigned to that program id and then the delete proceeds.
   */
  var deleteProgram = function (id, options) {
    options = options || {};
    // Cascade guard (§7): never silently drop referenced data.
    var refs = state.projects.filter(function (p) { return p.program === id; });
    if (refs.length > 0 && !options.reassignTo) {
      return { blocked: true, count: refs.length };
    }
    return mutate('deleteProgram', { id: id, reassignTo: options.reassignTo || null }, function () {
      if (options.reassignTo) {
        state.projects.forEach(function (p) {
          if (p.program === id) p.program = options.reassignTo;
        });
      }
      var idx = findIndexById(state.programs, id);
      if (idx === -1) return false;
      state.programs.splice(idx, 1);
      return true;
    });
  };

  // --- installations --------------------------------------------------------

  /** @description Return installation metadata by id, or null. */
  var getInstallation = function (id) {
    var idx = findIndexById(state.installations, id);
    return idx === -1 ? null : deepCopy(state.installations[idx]);
  };

  /** @description Return the list of all installations (snapshot copy). */
  var listInstallations = function () {
    return deepCopy(state.installations);
  };

  // Projects store installation by canonical NAME ("Camp Hansen"), not id -
  // so we resolve both forms when comparing.
  var installationMatchesId = function (projectInstallation, installId) {
    if (!projectInstallation) return false;
    if (projectInstallation === installId) return true;
    var inst = getInstallation(installId);
    if (inst && inst.name === projectInstallation) return true;
    return false;
  };

  /** @description Insert or update an installation by id; emits 'change'. */
  var upsertInstallation = function (inst) {
    if (!inst || !inst.id) throw new Error('upsertInstallation requires an id');
    return mutate('upsertInstallation', inst, function () {
      var idx = findIndexById(state.installations, inst.id);
      var copy = deepCopy(inst);
      if (idx === -1) state.installations.push(copy);
      else state.installations[idx] = copy;
      return copy;
    });
  };

  /**
   * @description Delete an installation. Cascade-guarded: if projects reference it,
   * returns {blocked:true,count} unless options.reassignTo is supplied.
   */
  var deleteInstallation = function (id, options) {
    options = options || {};
    var refs = state.projects.filter(function (p) { return installationMatchesId(p.installation, id); });
    if (refs.length > 0 && !options.reassignTo) {
      return { blocked: true, count: refs.length };
    }
    return mutate('deleteInstallation', { id: id, reassignTo: options.reassignTo || null }, function () {
      if (options.reassignTo) {
        var target = getInstallation(options.reassignTo);
        var targetName = (target && target.name) || options.reassignTo;
        state.projects.forEach(function (p) {
          if (installationMatchesId(p.installation, id)) {
            p.installation = targetName;
            if (options.reassignTo === 'unknown') p.unknownInstallation = true;
          }
        });
      }
      var idx = findIndexById(state.installations, id);
      if (idx === -1) return false;
      state.installations.splice(idx, 1);
      return true;
    });
  };

  // --- viewer ---------------------------------------------------------------

  /** @description Set the viewer name for export watermarks; emits 'change'. */
  var setViewer = function (name) {
    return mutate('setViewer', { viewer: name }, function () {
      state.viewer = String(name || '');
      return state.viewer;
    });
  };

  /** @description Return the current viewer name (string, possibly empty). */
  var getViewer = function () {
    return state.viewer;
  };

  // --- schema ---------------------------------------------------------------

  /** @description Return all schema columns (copy). */
  var listSchemaColumns = function () {
    return deepCopy(state.schema.columns);
  };

  /** @description Add or replace a schema column by key; emits 'change' + 'schema-change'. */
  var addSchemaColumn = function (col) {
    if (!col || !col.key) throw new Error('addSchemaColumn requires key');
    var result = mutate('addSchemaColumn', col, function () {
      var columns = state.schema.columns;
      var copy = deepCopy(col);
      if (typeof copy.userDefined !== 'boolean') copy.userDefined = true;
      if (typeof copy.order !== 'number') copy.order = columns.length;
      var idx = -1;
      for (var i = 0; i < columns.length; i++) if (columns[i].key === copy.key) { idx = i; break; }
      if (idx === -1) columns.push(copy);
      else columns[idx] = copy;
      return copy;
    });
    emit('schema-change', { type: 'add', key: col.key });
    return result;
  };

  /**
   * @description Remove a user-defined schema column; built-in columns can't be removed.
   * Emits 'change' + 'schema-change'.
   */
  var removeSchemaColumn = function (key) {
    var columns = state.schema.columns;
    for (var i = 0; i < columns.length; i++) {
      if (columns[i].key === key) {
        // Built-in columns mirror canonical fields and must not be deleted -
        // the schema editor should offer "hide" instead.
        if (columns[i].userDefined === false) {
          return { blocked: true, reason: 'builtin' };
        }
        break;
      }
    }
    var result = mutate('removeSchemaColumn', { key: key }, function () {
      for (var j = 0; j < state.schema.columns.length; j++) {
        if (state.schema.columns[j].key === key) {
          state.schema.columns.splice(j, 1);
          return true;
        }
      }
      return false;
    });
    emit('schema-change', { type: 'remove', key: key });
    return result;
  };

  /** @description Patch an existing column definition (label, unit, hidden, enumValues, order). */
  var updateSchemaColumn = function (key, patch) {
    var result = mutate('updateSchemaColumn', { key: key, patch: patch }, function () {
      var cols = state.schema.columns;
      for (var i = 0; i < cols.length; i++) {
        if (cols[i].key === key) {
          for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) cols[i][k] = patch[k];
          return true;
        }
      }
      return false;
    });
    emit('schema-change', { type: 'update', key: key, patch: patch });
    return result;
  };

  /** @description Store client-brief notes text on the root state so it travels with exports. */
  var setBriefNotes = function (text) {
    return mutate('setBriefNotes', { text: text }, function () { state.briefNotes = text || ''; });
  };
  var getBriefNotes = function () { return state.briefNotes || ''; };

  // --- events ---------------------------------------------------------------

  /** @description Subscribe to 'change' or 'schema-change'. */
  var on = function (event, cb) {
    if (typeof cb !== 'function') return;
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  };

  /** @description Unsubscribe a previously registered listener. */
  var off = function (event, cb) {
    var subs = listeners[event];
    if (!subs) return;
    var idx = subs.indexOf(cb);
    if (idx !== -1) subs.splice(idx, 1);
  };

  // --- undo / redo ----------------------------------------------------------

  /** @description Walk the history buffer back one step; emits 'change'. */
  var undo = function () {
    if (history.length === 0) return false;
    var prev = history.pop();
    future.push(serializeState());
    if (future.length > HISTORY_MAX) future.shift();
    restoreFrom(prev);
    persist();
    emit('change', { type: 'undo', payload: null });
    return true;
  };

  /** @description Walk forward one step in the redo stack; emits 'change'. */
  var redo = function () {
    if (future.length === 0) return false;
    var next = future.pop();
    history.push(serializeState());
    if (history.length > HISTORY_MAX) history.shift();
    restoreFrom(next);
    persist();
    emit('change', { type: 'redo', payload: null });
    return true;
  };

  // --- serialize / hydrate --------------------------------------------------

  /** @description Serialize full store (plus schema + viewer) for JSON export. */
  var serialize = function () {
    return serializeState();
  };

  /** @description Replace entire store from parsed JSON; emits 'change'. */
  var hydrate = function (json) {
    if (!json || typeof json !== 'object') throw new Error('hydrate requires an object');
    snapshot();
    if (Array.isArray(json.projects))      state.projects      = deepCopy(json.projects);
    if (Array.isArray(json.ccnCatalog))    state.ccnCatalog    = deepCopy(json.ccnCatalog);
    if (Array.isArray(json.installations)) state.installations = deepCopy(json.installations);
    if (Array.isArray(json.programs))      state.programs      = deepCopy(json.programs);
    if (json.schema && Array.isArray(json.schema.columns)) state.schema = deepCopy(json.schema);
    if (typeof json.viewer === 'string')   state.viewer        = json.viewer;
    persist();
    emit('change', { type: 'hydrate', payload: null });
    return serializeState();
  };

  // --- public API -----------------------------------------------------------
  return {
    init: init,
    getAll: getAll,
    getProjects: getProjects,
    getProject: getProject,
    upsertProject: upsertProject,
    deleteProject: deleteProject,
    getCCN: getCCN,
    upsertCCN: upsertCCN,
    deleteCCN: deleteCCN,
    listCCNs: listCCNs,
    getProgram: getProgram,
    listPrograms: listPrograms,
    upsertProgram: upsertProgram,
    deleteProgram: deleteProgram,
    getInstallation: getInstallation,
    listInstallations: listInstallations,
    upsertInstallation: upsertInstallation,
    deleteInstallation: deleteInstallation,
    setViewer: setViewer,
    getViewer: getViewer,
    addSchemaColumn: addSchemaColumn,
    removeSchemaColumn: removeSchemaColumn,
    updateSchemaColumn: updateSchemaColumn,
    setBriefNotes: setBriefNotes,
    getBriefNotes: getBriefNotes,
    listSchemaColumns: listSchemaColumns,
    on: on,
    off: off,
    undo: undo,
    redo: redo,
    serialize: serialize,
    hydrate: hydrate
  };
})();
