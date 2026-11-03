#!/usr/bin/env bash
# Install the skills by symlinking them into ~/.agents/skills.
# Safe to re-run. Works on any machine: clone this repo, then run ./install.sh.
#
# Skill prose is authored in Notion and published here by the sync
# (plugins/<slug>/skills/<name>/). `shared/` is still maintained in this repo.
# While the first sync is being verified both layouts are accepted.
set -euo pipefail

repo="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
target="${AGENTS_SKILLS_DIR:-$HOME/.agents/skills}"

mkdir -p "$target"

# The synced tree wins when it exists; otherwise fall back to the pre-sync layout.
skills_dir="$repo/skills"
plugin_skills="$(ls -d "$repo"/plugins/*/skills 2>/dev/null | head -1 || true)"
if [ -n "$plugin_skills" ]; then
  skills_dir="$plugin_skills"
fi

if [ ! -d "$skills_dir" ]; then
  echo "no skills directory in $repo (looked for plugins/*/skills and skills/)" >&2
  exit 1
fi

names="$(cd "$skills_dir" && ls -d */ 2>/dev/null | sed 's:/$::' || true)"
if [ -z "$names" ]; then
  echo "no skills found in $skills_dir" >&2
  exit 1
fi

for dir in $names shared; do
  src="$skills_dir/$dir"
  [ "$dir" = "shared" ] && src="$repo/shared"
  if [ ! -d "$src" ]; then
    echo "missing $src — refusing to link a dangling target" >&2
    exit 1
  fi
  dst="$target/$dir"
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    echo "skip $dst (exists and is not a symlink)"
    continue
  fi
  ln -sfn "$src" "$dst"
  echo "linked $dst -> $src"
done

echo
echo "Done. Verify with: ls -l $target"
