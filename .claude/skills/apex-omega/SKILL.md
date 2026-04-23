---
name: apex-omega
description: Build briefing-grade internal tools end-to-end. Applies when the deliverable is an executive/planner dashboard, a single-file HTML handoff, or any artifact where the user has existing reference artifacts and domain terminology that must be preserved verbatim. Invoke when the user mentions OMEGA APEX, matching the look of existing dashboards, FOUO handling, or explicitly asks for this standard of work.
---

# APEX OMEGA

The standard this skill encodes comes from a real NAVFAC MCIPAC G-F / PPE dashboard build. It is not theoretical. Every rule here was written because the opposite was tried and failed.

## 1. Source material first, code second

Before writing any code, read every reference artifact the user provided, end to end. Extract:

- Visible terminology (button labels, column names, section titles, placeholders).
- Field semantics (what does "A Finish" mean in the user's world? what does a BEQ mean?).
- Color palette, typography, layout density, the shape of their chrome (banners, attribution lines, clocks, tabs).
- The exact copy the user uses, verbatim, so you never invent a synonym.

If the user has two or three source artifacts with different styles, identify which pieces are their "APEX" (best) and which are drafts.

Never let an agent paraphrase. Never use training-data guesses at domain terms. If you do not find the term in the source, ask once and keep the exact word the user said.

## 2. Forbidden in UI copy and code comments

- Em-dashes `—`
- En-dashes `–`
- Hyphens used as prose separators (`Prepared by John - Today`). Hyphens only inside ISO dates (2025-03-10) and compound words (re-save, self-contained).
- AI-ese phrases: "suggested", "let's", "here's", "light them up", "seamless", "leverage", "dive in", "explore", "actionable", "unlock", "empower", "effortless", "streamline".
- Field-name jargon exposed in UI copy: `totalCost + fyPlan`, `UM=SF`, `bodFYOverride`. If the internal field name must be referenced, give it a human label.
- Invented acronyms. Only use acronyms that appear in the user's source artifacts.

Before every commit, grep the rendered DOM for these patterns and fail the check if any remain.

## 3. Vertical slice before broad build

Pick one screen (usually the landing / overview) and implement it completely: real data, real chrome, real interactivity. Get that screen to 100 percent of the target quality. Only then expand to other sections.

Do not build skeletons of many sections in parallel. They come back as ten small things to fix instead of one complete reference.

## 4. Headless smoke test from day one

Install Playwright (or similar) at the start of the project, not at the end. After every meaningful change:

1. Boot the artifact headless at the actual viewport the user uses (1600x1000 is a good default for laptops).
2. Navigate every section.
3. Check `console.error`, `console.warning`, `pageerror`. Zero tolerance.
4. Take a screenshot. Compare it to what you expected.
5. Run at least 10 functional checks (CRUD, undo, filter, cascade guards, export wiring).

Fail the commit if any check fails or any console warning is present.

## 5. Visible error surface

A silently blank screen is unacceptable. Always install a global `window.onerror` handler that renders the stack trace visibly in-page, inside the handling banner. Parse embedded data with `try/catch` and surface parse failures the same way. The cost is twenty lines of code. The benefit is that the user never sees a white screen without a reason.

## 6. Handling posture

When the deliverable carries a caveat (FOUO, CUI, proprietary):

- Vendor all libraries. No runtime CDN calls. Verify by checking `document.Network` empty on load.
- Banner top and bottom, exact text from the user's artifacts, not a rewording.
- Stamp every export (JSON, CSV, print, re-baked HTML) with a "Prepared By (name) on (date)" line carrying the caveat.
- Prompt the user for their name once. Save it in localStorage.
- No external fonts, images, analytics, telemetry.
- Keep the repo private if that is the policy. Confirm.

## 7. Data model hygiene

- Normalize source data deterministically in a Python script committed to the repo. Rerunning must produce byte-identical output.
- Canonicalize identity fields on ingestion: installation names, program labels, category codes. Never canonicalize at render time.
- Preserve the original raw value in a `notes` or `*_raw` field when you canonicalize something. A planner may need to see what the source actually said.
- Version the localStorage key every time the schema changes (`v1`, `v2`, `v3`). Old saves should not collide with new fields.

## 8. Agent delegation

Subagents time out on complex prompts. Empirically the limit lands around 240 seconds of idle stream. To stay under it:

- Prefer one file per agent, not multi-file prompts.
- Write the hardest module (data layer) yourself. Delegate leaf UI modules.
- If an agent times out, do the module yourself rather than retrying with a smaller prompt. Retrying costs more than writing it.
- Never let an agent write user-facing copy. Agents produce AI-ese. Copy belongs to the user.

## 9. Terminology confirmation gate

Before shipping any feature that names a domain concept (a field, a button, a section header):

- Look up the term in the user's source artifacts. If present, use verbatim.
- If absent, ask the user one question. Do not guess.
- Write a short "terminology locked" note in the commit message so future sessions can see the decision.

Common failure: inventing "BOD" (Beneficial Occupancy Date) when the user's vocabulary is "Activation Finish". The dashboard then reads as written by an outsider and the user loses trust.

## 10. Mobile and alternate environments

If the deliverable is a single-file HTML, make a conscious decision up front: is mobile in scope or not? iOS specifically refuses to render local HTML from Files app. If mobile matters, plan for it: either add responsive CSS and a mobile-lite layout from day one, or commit PDF snapshots to the repo for mobile review.

Do not discover this at the end.

## 11. QA checklist (minimum before push)

- [ ] Every section renders with content length greater than 200 chars.
- [ ] Every CRUD path round-trips (add then delete returns counts to baseline).
- [ ] Undo and redo work and round-trip byte-for-byte.
- [ ] Filter counts match normalization output.
- [ ] Cascade guards fire for referenced entities.
- [ ] All exports carry the handling caveat and Prepared By watermark.
- [ ] No em-dashes, en-dashes, or AI-ese in rendered DOM.
- [ ] Zero console errors, zero console warnings, zero page errors.
- [ ] File size and boot time within budget (2-3 MB is fine for a data-heavy single-file HTML; 10 MB is not).

## 12. Retro after every meaningful release

Write a honest retro. What went well. What went badly. What will be done differently. Commit it alongside the code. Feed the lessons back into this skill.

---

## Appendix A: Commit message style

- Title is a single line, no em-dashes.
- Body breaks into sections: what was changed, why, and what was verified (with concrete numbers like "21 QA checks green", "0 warnings").
- End with the Claude Code session link footer.

## Appendix B: Banned copy list

Active regexes to grep for in UI copy and comments:

```
—        (em-dash)
–        (en-dash)
\bsuggested\b
\blet'?s\b
\bhere'?s\b
\blight them up\b
\bseamless\b
\bleverage\b
\bdive in\b
\bactionable\b
\bunlock\b
\bempower\b
\beffortless\b
\bstreamline\b
\bBOD\b         (project-specific; replace with "Activation Finish")
\bUnknown\b     (when referring to an installation bucket; use "SACO" or the real term)
```
