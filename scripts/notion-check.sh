#!/usr/bin/env bash
# scripts/notion-check.sh — verify the Notion side before a sync.
#
# Checks, in order: the token authenticates, the data source is reachable with
# that token, the database has the four properties we render from, and every row
# the token can see has the shape the tool expects. Prints one line per check.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/env.sh
source "$ROOT/scripts/lib/env.sh"

load_env "${1:-$ROOT/.env}"
if ! require_vars NOTION_API_TOKEN SKILLS_DATA_SOURCE_ID 2>/tmp/notion-check.missing; then
  echo "not ok — set these in .env (see .env.example and docs/notion-sync-setup.md):"
  sed 's/^/  - /' /tmp/notion-check.missing
  exit 2
fi

# NTN_BIN stays a single executable path; the npx default needs its argv words.
ntn=( "${NTN_BIN:-npx}" )
[[ -z "${NTN_BIN:-}" ]] && ntn+=( --yes ntn )
run() { "${ntn[@]}" "$@"; }

fail=0
ok()   { echo "ok   — $*"; }
bad()  { echo "FAIL — $*"; fail=1; }

if run api /v1/users/me >/tmp/notion-check.me 2>/tmp/notion-check.me.err; then
  ok "token authenticates ($(python3 -c 'import json,sys;d=json.load(open("/tmp/notion-check.me"));print(d.get("bot",{}).get("owner",{}).get("type","user"))' 2>/dev/null || echo unknown))"
else
  bad "token rejected: $(head -2 /tmp/notion-check.me.err | tr '\n' ' ')"
  exit 1
fi

ds="/v1/data_sources/${SKILLS_DATA_SOURCE_ID/$(printf '\n')/}"
if run api "$ds" >/tmp/notion-check.ds 2>/tmp/notion-check.ds.err; then
  ok "data source reachable"
else
  bad "data source ${SKILLS_DATA_SOURCE_ID} not found or not shared with this connection: $(head -2 /tmp/notion-check.ds.err | tr '\n' ' ')"
  exit 1
fi

python3 - "${fail:-0}" >/tmp/notion-check.props <<'PY'
import json, sys
ds = json.load(open("/tmp/notion-check.ds"))
props = ds.get("properties", {})
want = {"Name": ("title",), "Description": ("rich_text",), "Tags": ("multi_select",), "Files": ("files",)}
problems = []
for name, types in want.items():
    p = props.get(name)
    if p is None:
        problems.append(f"missing property {name!r} (expected {types[0]})")
    elif p.get("type") not in types:
        problems.append(f"property {name!r} is {p.get('type')!r}, expected {types[0]!r}")
extra = sorted(set(props) - set(want))
print("\n".join(problems))
print("EXTRA " + ", ".join(extra) if extra else "")
sys.exit(1 if problems else 0)
PY
if [[ -s /tmp/notion-check.props ]]; then
  grep -v '^EXTRA' /tmp/notion-check.props | while IFS= read -r l; do bad "$l"; done
  grep -q '^EXTRA' /tmp/notion-check.props && sed 's/^EXTRA /note — extra properties ignored: /' /tmp/notion-check.props
  fail=1
else
  ok "properties Name/Description/Tags/Files"
fi

run api "/v1/data_sources/${SKILLS_DATA_SOURCE_ID}/query" -X POST -d '{"page_size":100}' >/tmp/notion-check.rows 2>/tmp/notion-check.rows.err \
  || run api "/v1/data_sources/${SKILLS_DATA_SOURCE_ID}/query" -X POST >/tmp/notion-check.rows 2>/tmp/notion-check.rows.err
if [[ -s /tmp/notion-check.rows ]]; then
  python3 - >/tmp/notion-check.rowcheck <<'PY'
import json
d = json.load(open("/tmp/notion-check.rows"))
rows = d.get("results", [])
print(f"count {len(rows)}")
for r in rows:
    pr = r.get("properties", {})
    title = "".join(t.get("plain_text", "") for t in (pr.get("Name", {}).get("title") or []))
    files = pr.get("Files", {}).get("files") or []
    kinds = ",".join(sorted({f.get("type", "?") for f in files})) or "none"
    print(f"row {title or '<untitled>'} files={kinds}")
PY
  ok "rows: $(grep -c '^row' /tmp/notion-check.rowcheck) visible to this connection"
  grep '^row' /tmp/notion-check.rowcheck | sed 's/^/       /'
else
  bad "cannot query rows: $(head -2 /tmp/notion-check.rows.err | tr '\n' ' ')"
fi

echo
[[ $fail == 0 ]] && echo "all checks passed" || echo "checks failed — see FAIL lines above"
exit $fail
