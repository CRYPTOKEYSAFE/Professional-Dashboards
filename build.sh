#!/usr/bin/env bash
# build.sh — inline vendor libs, src modules, and data into a single dashboard.html.
# Idempotent: same inputs produce byte-identical output.
set -euo pipefail

cd "$(dirname "$0")"

SRC_TEMPLATE="src/dashboard.template.html"
OUT="dashboard.html"

if [[ ! -f "$SRC_TEMPLATE" ]]; then
  echo "error: $SRC_TEMPLATE not found" >&2
  exit 1
fi

python3 - "$SRC_TEMPLATE" "$OUT" <<'PYEOF'
import os, re, sys, html

template_path, out_path = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.abspath(template_path))
# root is "src/", we want project root (parent)
project_root = os.path.dirname(root)

PLACEHOLDER = re.compile(r"<!--\s*INJECT:(vendor|style|module|data):([^\s]+)\s*-->")

with open(template_path, "r", encoding="utf-8") as f:
    template = f.read()

def inject(match):
    kind, rel = match.group(1), match.group(2)
    abs_path = os.path.join(project_root, rel)
    if not os.path.isfile(abs_path):
        sys.stderr.write(f"warn: missing injection source: {abs_path}\n")
        return match.group(0)
    with open(abs_path, "r", encoding="utf-8") as f:
        content = f.read()
    # For JSON embedded in <script type="application/json"> we must escape </script>
    # (vanishingly rare in JSON output, but defensive).
    if kind == "data":
        content = content.replace("</script", "<\\/script")
    # For JS modules embedded in <script> we also need to protect against closing tags
    if kind == "module" or (kind == "vendor" and rel.endswith(".js")):
        content = content.replace("</script", "<\\/script")
    return content

output = PLACEHOLDER.sub(inject, template)

with open(out_path, "w", encoding="utf-8") as f:
    f.write(output)

size = os.path.getsize(out_path)
print(f"Wrote {out_path} ({size:,} bytes)")
PYEOF
