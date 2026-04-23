# Retro: DPRI / MCIPAC Integrated Facilities Dashboard

One planner, one agent, several days of iteration. Honest debate.

## What went well

**Data foundation.** 412 DPRI projects and 1,059 CCN codes extracted cleanly from the source files on the first pass. Umbrella filter counts matched normalization output exactly every time (412 / 33 / 15 / 12). The normalization script is deterministic and rerunnable. When field renames happened (BOD to Activation Finish, Unknown to SACO) the data migrated in one command because everything flowed through the Python pipeline.

**SPEC.md driven architecture.** Writing the data contracts up front kept the modules from drifting. When an agent finished early or a sub-module needed rewrite, the SPEC stayed authoritative and the new code snapped into place.

**Headless Chromium tests caught real bugs.** The grid list-editor warning, the shell layout bug where the grid container was empty, the blank-page boot failure: all found by the Playwright harness before the user saw them. The final 21-check QA sweep gave real confidence.

**Last third of the build was clean.** By the time the 5-digit CCN heatmap, card view, and instructions went in, the workflow was tight: read source, edit files, run build, run QA, screenshot, commit. That is the cadence it should have been the whole time.

**Architecture survived large pivots.** The heatmap went from 3-digit categories to 5-digit CCN codes with one function rewrite, not a gut job. The milestone model went from a single generic set to program-specific (DPRI F/B/D/C/A vs MLR/3/12 IOC/FOC) via one module, not a data migration. That is what the SPEC bought.

## What went badly

**I invented terminology the user does not use.** "BOD" instead of "Activation Finish". "Unknown" instead of "SACO". "Set Viewer" instead of "Prepared By". Each one was a small paper cut that added up to the user losing trust that I understood the domain. I should have pulled every visible label from the source DPRI and 12MLR HTMLs and used them verbatim. Instead I paraphrased.

**AI-ese kept leaking in.** "Suggested next actions". "Add assignments to light them up on the heatmap". "Seamless". The user called me out three times before I got aggressive about a banned-phrase list. I should have written that list on day one.

**Em-dashes kept coming back.** I scrubbed them multiple times and they reappeared through new code and agent output. This needed a pre-commit grep check, not manual discipline.

**Subagents timed out on complex work.** Wave 2 had five agents assigned; one finished (data layer), one produced partial output (template + styles), three wrote zero lines of code. Roughly 20 minutes of wall time wasted waiting on agents that would not deliver. I should have recognized the pattern after the second timeout and switched to writing the modules myself. Instead I retried.

**Initial Overview and Projects were too plain.** The first version looked like a hackathon prototype next to the user's own DPRI Construction Schedule. I did not study the DPRI chrome closely enough before building: horizontal KPI strip with inline mini-charts, multi-row header with org attribution and world clocks, tabs not dropdowns. That was all in the source HTML. I should have mirrored it on the first pass.

**Mobile experience failure.** The user tried to view the dashboard on iPhone. iOS refuses to render local .html from Files. I offered three workarounds (AirDrop to Safari, Documents by Readdle, local web server) before producing what actually worked (PDF snapshots). Should have produced PDFs on day one if mobile review was a possibility, or built a responsive mobile-lite variant from the start.

**Heatmap shipped with wrong axis labels.** I used 3-digit NAVFAC category series (100, 200, 300...). The user uses 5-digit CCN codes. That is what Marine Corps planners look at. Had I asked "what granularity do you plan at", the answer would have saved a rewrite. I assumed a sensible default and assumed wrong.

**Too many clarifying questions batched at once.** The user got fatigued. Four questions in one batch is fine. Eight questions is a test of patience. I should have made sensible defaults for the low-stakes items and only asked on the decisions that materially shaped the build.

**Silent-fail blank screens.** Two separate times the dashboard opened and showed nothing between the FOUO banners (Safari file-URL boot, grid container never populated). The error-overlay was added after the second occurrence. It should have been there from day one.

## What to do differently next time

1. **Terminology extraction pass before code.** Before the first commit, grep the user's reference artifacts for every visible label, column name, button text, section header. Assemble a glossary. Lint against it.

2. **Banned-phrase list from day one.** Em-dashes, en-dashes, AI-ese. Regex scan during build, fail the build if any present in source or rendered DOM.

3. **Vertical slice, not broad scaffolding.** One screen complete before the next starts. Watch it pass a headless QA. Then move.

4. **Error overlay before first run.** window.onerror into the banner, always.

5. **Sub-agent time boxing.** If an agent is still streaming at 180 seconds, cancel it and write the module myself. Do not keep waiting.

6. **Ask once, decide defaults twice.** Only one batch of clarifying questions per architectural decision. For every other question, pick a sensible default, state it in the commit, and ask the user to correct it if wrong.

7. **Mobile posture decided upfront.** First meeting: "will anyone need to open this on a phone?" If yes, responsive layout is in scope on day one.

8. **Print / PDF snapshot committed with every release.** Covers the mobile-viewer problem for free and gives the user a static artifact for briefings.

9. **Mirror the user's chrome language before inventing my own.** If the user has two existing dashboards, the new one should look like an evolution of them, not a replacement.

10. **Feed retro lessons into the skill file.** APEX OMEGA skill captured in `.claude/skills/apex-omega/SKILL.md`. Every future session reads it. Every retro feeds it.
