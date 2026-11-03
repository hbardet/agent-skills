#!/usr/bin/env bash
# scripts/notion-sync.sh [dry-run|sync] — run the Notion → GitHub sync by hand.
#
# The tool itself lives in its own repo (scripts/bootstrap-fork.sh) because it
# needs push credentials and a workflow. This wrapper only puts the canonical
# .env in front of it, so a local run and the scheduled run agree.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-dry-run}"
case "$MODE" in dry-run|sync) ;; *) echo "usage: $0 [dry-run|sync]" >&2; exit 2 ;; esac
# shellcheck source=./lib/env.sh
source "$ROOT/scripts/lib/env.sh"
load_env "${ENV_FILE:-$ROOT/.env}"
require_vars NOTION_API_TOKEN GITHUB_REPO GITHUB_BRANCH
FORK="${SYNC_FORK_DIR:-$HOME/work/my-skills}"
if [[ ! -d "$FORK" ]]; then
  echo "no fork at $FORK (run scripts/bootstrap-fork.sh)" >&2
  exit 1
fi
if [[ "$MODE" == sync ]]; then require_vars GITHUB_TOKEN; fi
args=(src/cli.ts sync)
[[ "$MODE" == dry-run ]] && args+=(--dry-run)
cd "$FORK" && bun run "${args[@]}"
