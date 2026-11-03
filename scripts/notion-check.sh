#!/usr/bin/env bash
# scripts/notion-check.sh — verify the Notion side before a sync.
#
# Authenticates the token, then hands the schema and row inspection to
# scripts/notion-inspect.ts (which resolves the localized property names by type).
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

if ! "${ntn[@]}" api /v1/users/me >/dev/null 2>/tmp/notion-check.me.err; then
  echo "FAIL — token rejected: $(head -2 /tmp/notion-check.me.err | tr '\n' ' ')"
  exit 1
fi
echo "ok   — token authenticates"

cd "$ROOT" && bun run scripts/notion-inspect.ts
status=$?
echo
if [[ $status == 0 ]]; then echo "all checks passed"; else echo "checks failed — see FAIL lines above"; fi
exit $status
