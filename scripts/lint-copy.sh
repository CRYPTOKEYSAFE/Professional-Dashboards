#!/usr/bin/env bash
# lint-copy.sh - fail the build if banned copy slips into UI source.
# Patterns sourced from .claude/skills/apex-omega/SKILL.md Appendix B.
# Scans UI source only: app.js, modules, styles, template. Does not scan
# vendored libraries or embedded data blocks (those are not our copy).

set -uo pipefail

cd "$(dirname "$0")/.."

TARGETS=(
  "src/app.js"
  "src/styles.css"
  "src/dashboard.template.html"
)
while IFS= read -r -d '' f; do TARGETS+=("$f"); done < <(find src/modules -type f -name '*.js' -print0 | sort -z)

FAIL=0

# Case-sensitive literal character scan
scan_literal() {
  local pattern="$1" label="$2"
  local found
  found=$(grep -nF "$pattern" "${TARGETS[@]}" 2>/dev/null || true)
  if [[ -n "$found" ]]; then
    echo "=== banned: $label ==="
    echo "$found"
    echo
    FAIL=1
  fi
}

# Regex scan with case flag control
scan_regex() {
  local pattern="$1" label="$2" flags="$3"
  local found
  found=$(grep -nP $flags "$pattern" "${TARGETS[@]}" 2>/dev/null || true)
  if [[ -n "$found" ]]; then
    echo "=== banned: $label ==="
    echo "$found"
    echo
    FAIL=1
  fi
}

# Punctuation: em-dash and en-dash never allowed.
scan_literal $'\xe2\x80\x94' "em-dash (U+2014)"
scan_literal $'\xe2\x80\x93' "en-dash (U+2013)"

# AI-ese words: case-insensitive.
scan_regex '\bsuggested\b'     "suggested"     "-i"
scan_regex "\blet'?s\b"        "let's"         "-i"
scan_regex "\bhere'?s\b"       "here's"        "-i"
scan_regex '\blight them up\b' "light them up" "-i"
scan_regex '\bseamless\b'      "seamless"      "-i"
scan_regex '\bleverage\b'      "leverage"      "-i"
scan_regex '\bdive in\b'       "dive in"       "-i"
scan_regex '\bactionable\b'    "actionable"    "-i"
scan_regex '\bunlock\b'        "unlock"        "-i"
scan_regex '\bempower\b'       "empower"       "-i"
scan_regex '\beffortless\b'    "effortless"    "-i"
scan_regex '\bstreamline\b'    "streamline"    "-i"

# Domain terms per Appendix B: case-sensitive.
# BOD as all caps is the acronym to catch. The lowercase identifier `bod`
# (if any) is a code variable, not user copy.
scan_regex '\bBOD\b'     "BOD (use 'Activation Finish' for the user term)" ""
# Capitalized Unknown suggests the installation bucket the skill banned;
# lowercase 'unknown' (CSS classes, identifiers) is fine.
scan_regex '\bUnknown\b' "Unknown (use 'SACO' for the installation bucket)" ""

if [[ $FAIL -eq 1 ]]; then
  echo "lint-copy: banned copy detected. Fix the lines above before building."
  exit 1
fi

echo "lint-copy: clean (${#TARGETS[@]} files scanned)"
