#!/usr/bin/env bash
# Install the skills by symlinking them into ~/.agents/skills.
# Safe to re-run. Works on any machine: clone this repo, then run ./install.sh.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
target="${AGENTS_SKILLS_DIR:-$HOME/.agents/skills}"

mkdir -p "$target"

for dir in batch-features work-issue shared; do
  src="$repo/skills/$dir"
  [ "$dir" = "shared" ] && src="$repo/shared"
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
