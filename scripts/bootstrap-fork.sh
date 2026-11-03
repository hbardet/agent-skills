#!/usr/bin/env bash
# scripts/bootstrap-fork.sh — create/refresh the sync-tool working copy.
#
# The tool lives in its own private repo (hbardet/my-skills) because its
# workflow holds the Notion + GitHub credentials and commits into the target
# repo. Remotes: origin = our copy, upstream = makenotion/notion-skills-github-sync
# (so `bun run update` and manual `git merge upstream/main` keep working).
set -euo pipefail

DIR="${SYNC_FORK_DIR:-$HOME/work/my-skills}"
UPSTREAM="https://github.com/makenotion/notion-skills-github-sync.git"
ORIGIN="${SYNC_ORIGIN:-git@github.com:hbardet/my-skills.git}"

if [[ ! -d "$DIR/.git" ]]; then
  git clone "$UPSTREAM" "$DIR"
  git -C "$DIR" remote rename origin upstream
  git -C "$DIR" remote add origin "$ORIGIN"
fi

if [[ ! -f "$DIR/.github/workflows/sync.yml" ]]; then
  echo "no sync.yml in $DIR — wrong repository?" >&2
  exit 1
fi

(cd "$DIR" && bun install --frozen-lockfile)
echo "$DIR"
