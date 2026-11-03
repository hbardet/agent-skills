#!/usr/bin/env bash
# test/install-sh.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
# fake repo: only a plugins tree, no skills/
mkdir -p "$tmp/repo/plugins/agent-skills/skills/work-issue" "$tmp/repo/plugins/agent-skills/skills/batch-features" "$tmp/repo/shared" "$tmp/dest"
echo x > "$tmp/repo/plugins/agent-skills/skills/work-issue/SKILL.md"
echo x > "$tmp/repo/plugins/agent-skills/skills/batch-features/SKILL.md"
echo x > "$tmp/repo/shared/labels.md"
cp "$ROOT/install.sh" "$tmp/repo/install.sh"
AGENTS_SKILLS_DIR="$tmp/dest" REPO_ROOT="$tmp/repo" bash "$tmp/repo/install.sh" >/dev/null || { echo "FAIL exit"; exit 1; }
[[ -f "$tmp/dest/work-issue/SKILL.md" ]] || { echo "FAIL work-issue not linked"; exit 1; }
[[ -f "$tmp/dest/shared/labels.md" ]] || { echo "FAIL shared not linked"; exit 1; }
[[ -L "$tmp/dest/work-issue" ]] || { echo "FAIL not a symlink"; exit 1; }
# and the no-plugins fallback still works
rm -rf "$tmp/repo/plugins"; mkdir -p "$tmp/repo/skills/work-issue" "$tmp/repo/skills/batch-features"; touch "$tmp/repo/skills/work-issue/SKILL.md" "$tmp/repo/skills/batch-features/SKILL.md"
rm -rf "$tmp/dest"; mkdir -p "$tmp/dest"
AGENTS_SKILLS_DIR="$tmp/dest" REPO_ROOT="$tmp/repo" bash "$tmp/repo/install.sh" >/dev/null || { echo "FAIL fallback exit"; exit 1; }
[[ -f "$tmp/dest/work-issue/SKILL.md" ]] || { echo "FAIL fallback link"; exit 1; }
echo ok
