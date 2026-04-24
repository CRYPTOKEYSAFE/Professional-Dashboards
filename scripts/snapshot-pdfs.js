#!/usr/bin/env node
/* snapshot-pdfs.js - regenerate the three committed PDF snapshots
 * (dashboard-overview.pdf, dashboard-projects.pdf, dashboard-brief.pdf)
 * from the current dashboard.html. Covers the mobile / offline review
 * posture called out in RETRO: iOS refuses local .html from Files, so a
 * static PDF is the fallback for phone or email review.
 *
 * Boots headless Chromium against the local file, pre-seeds the viewer
 * so the first-run prompt does not block rendering, navigates each
 * section, waits for the section's signature element, then writes a
 * print-media PDF. FOUO banners survive print because the template
 * fixes them and @media print switches them to static.
 *
 * Usage:
 *   node scripts/snapshot-pdfs.js
 */
process.env.NODE_PATH = "/opt/node22/lib/node_modules";
require("module").Module._initPaths();
const { chromium } = require("playwright");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FILE = "file://" + path.join(PROJECT_ROOT, "dashboard.html");

const PAGES = [
  {
    out: "dashboard-overview.pdf",
    section: "overview",
    waitFor: ".ov-kpi-bar",
    pdf: { format: "A3", landscape: true, printBackground: true, margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" } }
  },
  {
    out: "dashboard-projects.pdf",
    section: "projects",
    waitFor: ".grid-toolbar",
    pdf: { format: "A3", landscape: true, printBackground: true, margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" } },
    // Set page size as tall as the rendered content so the whole grid fits.
    expand: true
  },
  {
    out: "dashboard-brief.pdf",
    brief: true,
    waitFor: ".brief-slide",
    pdf: { format: "Letter", landscape: false, printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" } }
  }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();

  page.on("pageerror", (e) => console.error("[pageerror]", e.message));

  await page.addInitScript(() => {
    try { localStorage.setItem("dashboard.v1.viewer", "PPE Planner"); } catch (_) {}
  });
  await page.goto(FILE, { waitUntil: "load" });
  await page.waitForSelector(".app-header", { timeout: 10000 });
  await page.evaluate(() => {
    const d = document.querySelector('dialog[data-dashboard-role="viewer-prompt"]');
    if (d) { try { d.close(); } catch (_) {} d.remove(); }
  });

  for (const spec of PAGES) {
    if (spec.brief) {
      await page.evaluate(() => window.Shell && window.Shell.toggleBriefLayout && window.Shell.toggleBriefLayout(true));
    } else {
      await page.evaluate(() => { if (document.body.classList.contains("layout-brief")) window.Shell.toggleBriefLayout(false); });
      await page.click(`.nav-btn[data-section="${spec.section}"]`);
    }
    await page.waitForSelector(spec.waitFor, { timeout: 10000 });
    // Let fonts, svg, and any mutation observers settle.
    await page.waitForTimeout(600);
    await page.emulateMedia({ media: "print" });

    const outPath = path.join(PROJECT_ROOT, spec.out);
    await page.pdf(Object.assign({ path: outPath }, spec.pdf));
    // Reset from print media for the next iteration's DOM work.
    await page.emulateMedia({ media: "screen" });
    const size = require("fs").statSync(outPath).size;
    console.log(`wrote ${spec.out} (${size.toLocaleString()} bytes)`);
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
