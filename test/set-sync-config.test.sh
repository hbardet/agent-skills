#!/usr/bin/env bash
# test/set-sync-config.test.sh — drives the script against a fake gh.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/gh" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "$GH_LOG"; cat >> "$GH_LOG"; echo >> "$GH_LOG"
EOF
chmod +x "$tmp/gh"
printf 'NOTION_API_TOKEN=ntn_secret\nGITHUB_TOKEN=ghp_secret\nGITHUB_REPO=hbardet/agent-skills\nGITHUB_BRANCH=main\nNOTION_ENV=prod\nSKILLS_DATA_SOURCE_ID=ds_1\nGIT_AUTHOR_NAME=my-skills\nGIT_AUTHOR_EMAIL=my-skills@users.noreply.github.com\n' > "$tmp/.env"
GH_LOG="$tmp/log" GH_BIN="$tmp/gh" ENV_FILE="$tmp/.env" bash "$ROOT/scripts/set-sync-config.sh" >/dev/null
grep -q 'secret set NOTION_API_TOKEN' "$tmp/log" || { echo "FAIL notion secret"; exit 1; }
grep -q 'secret set GH_PUSH_TOKEN' "$tmp/log" || { echo "FAIL push secret"; exit 1; }
grep -q 'variable set SKILLS_GITHUB_REPO' "$tmp/log" || { echo "FAIL repo var"; exit 1; }
grep -q 'ntn_secret' <(grep '^secret set' "$tmp/log") && { echo "FAIL token in argv"; exit 1; }
grep -c 'ntn_secret' "$tmp/log" | grep -qx 1 || { echo "FAIL token not on stdin"; exit 1; }
GH_LOG="$tmp/log2" GH_BIN="$tmp/gh" ENV_FILE="$tmp/.env" bash "$ROOT/scripts/set-sync-config.sh" --print | grep -q 'ntn_secret' && { echo "FAIL --print leaked"; exit 1; }
echo ok
