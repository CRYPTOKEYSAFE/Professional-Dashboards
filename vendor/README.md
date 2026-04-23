# `vendor/` — pinned third-party libraries

This directory holds the JS/CSS/SVG assets needed to build a fully
self-contained, single-file `dashboard.html`. Once the dashboard is built,
it makes **zero** runtime network calls — every dependency is inlined from
the files in this directory.

## Contents

| File                          | Library              | Pinned version | License (SPDX) | Purpose                           |
| ----------------------------- | -------------------- | -------------- | -------------- | --------------------------------- |
| `tabulator-6.4.0.min.js`      | Tabulator            | 6.4.0          | MIT            | Editable data grid                |
| `tabulator-6.4.0.min.css`     | Tabulator (styles)   | 6.4.0          | MIT            | Default Tabulator theme           |
| `d3-7.9.0.min.js`             | D3                   | 7.9.0          | ISC            | Heatmap + time-slider visuals     |
| `papaparse-5.5.3.min.js`      | PapaParse            | 5.5.3          | MIT            | CSV import/export                 |
| `icons.svg`                   | Lucide (subset)      | 1.8.0          | ISC + MIT      | 24-icon SVG `<symbol>` sprite     |
| `MANIFEST.txt`                | —                    | —              | —              | SHA-256 hashes + upstream URLs    |
| `LICENSES.md`                 | —                    | —              | —              | Verbatim license texts            |
| `README.md`                   | —                    | —              | —              | This file                         |

## Provenance & integrity

- Every library was downloaded from `https://cdn.jsdelivr.net/npm/...` with
  the version number baked into the URL (e.g. `tabulator-tables@6.4.0`,
  not `@latest`), so the bytes are reproducible.
- `MANIFEST.txt` records, for each file: `<sha256>  <filename>  <upstream_url>  <license_spdx>`.
- To verify integrity at any time, run from the repo root:

  ```sh
  ( cd vendor && sha256sum -c <(awk 'NF && $1 !~ /^#/ {print $1"  "$2}' MANIFEST.txt) )
  ```

## Lucide icon sprite

`icons.svg` is **not** a copy of upstream `lucide-static`. It is a hand-rolled
SVG sprite that contains a single `<symbol id="icon-NAME">` per icon. Path
data was sourced verbatim from Lucide v1.8.0 for these 24 names:

```
home, grid, layers, activity, link, settings, search, filter,
plus, minus, edit, trash, download, upload, eye, eye-off,
chevron-down, chevron-right, play, pause, info, alert-triangle,
check, x
```

Use in HTML:

```html
<svg class="icon"><use href="#icon-search"/></svg>
```

The sprite is included once near the top of `dashboard.html` (or inlined by
`build.sh`) and individual `<use>` elements reference it by `id` thereafter.

## How `build.sh` uses these files

The repository's `scripts/build.sh` produces `dashboard.html` by inlining
each vendored asset into the HTML template:

1. The CSS file `tabulator-6.4.0.min.css` is wrapped in a `<style>` block.
2. The JS files (`d3-7.9.0.min.js`, `tabulator-6.4.0.min.js`,
   `papaparse-5.5.3.min.js`) are wrapped in `<script>` blocks in dependency
   order (D3 first, then Tabulator, then PapaParse, then app code).
3. `icons.svg` is inlined verbatim immediately after `<body>` so all
   `<use href="#icon-*"/>` references resolve without HTTP.
4. `build.sh` re-verifies each vendored file's SHA-256 against
   `MANIFEST.txt` before inlining; mismatch aborts the build.

The result is a single `dashboard.html` with no `<link rel="stylesheet">` to
external origins, no `<script src="https://...">` references, and no
`fetch()` calls to anything other than `data:` / `blob:` URIs.

## How to refresh versions

Re-run the library-vendoring agent (or, equivalently, follow these steps
manually):

1. Discover the latest stable upstream version, e.g.
   `curl -s https://cdn.jsdelivr.net/npm/tabulator-tables@latest/package.json | jq -r .version`.
2. Download the pinned-version URL,
   e.g. `https://cdn.jsdelivr.net/npm/tabulator-tables@<NEW>/dist/js/tabulator.min.js`.
3. Save under `vendor/<name>-<NEW>.<ext>`.
4. `sha256sum` the file and update `MANIFEST.txt` (one line per file).
5. If a major version changed, update the verbatim license text in
   `LICENSES.md` from the upstream `LICENSE` file.
6. Delete the old version's file(s).
7. Update the version reference in `scripts/build.sh` and re-run the build.
8. Smoke-test `dashboard.html` offline (disconnect network, open in browser,
   confirm no failed requests in the dev-tools network panel).

## Security posture (FOUO)

- All assets are pinned by exact version number in both filename and CDN URL.
- SHA-256 of each file is recorded in `MANIFEST.txt`; verify on every build.
- Built `dashboard.html` is air-gap-safe: no outbound network calls at
  runtime. Any future contributor adding a `<script src="https://...">` or
  `fetch('https://...')` to the template breaks this guarantee and must be
  rejected in code review.
- Licenses are all permissive (MIT/ISC). Redistribution inside FOUO
  artifacts is permitted provided `LICENSES.md` ships alongside.
