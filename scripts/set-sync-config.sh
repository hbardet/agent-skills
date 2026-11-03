#!/usr/bin/env bash
# scripts/set-sync-config.sh [owner/repo] [--print]
#
# The canonical configuration is .env in this repo (gitignored). The workflow that
# runs every hour lives in the fork, so its secrets and variables are a copy of
# those values. Run this after editing .env; it never echoes a secret.
#
# Secrets:   NOTION_API_TOKEN, GH_PUSH_TOKEN (from GITHUB_TOKEN),
#            SKILLS_GITHUB_APP_PRIVATE_KEY (from GITHUB_APP_PRIVATE_KEY, optional)
# Variables: SKILLS_GITHUB_REPO, SKILLS_GITHUB_BRANCH, NOTION_ENV,
#            SKILLS_DATA_SOURCE_ID, SKILLS_GITHUB_APP_ID (optional),
#            GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=./lib/env.sh
source "$ROOT/scripts/lib/env.sh"

REPO="hbardet/my-skills"
PRINT=0
for arg in "$@"; do
  case "$arg" in
    --print) PRINT=1 ;;
    -*) echo "usage: $0 [owner/repo] [--print]" >&2; exit 2 ;;
    *) REPO="$arg" ;;
  esac
done

GH="${GH_BIN:-gh}"
load_env "${ENV_FILE:-$ROOT/.env}"

secret_names=( NOTION_API_TOKEN )
secret_values=( "${NOTION_API_TOKEN:-}" )
[[ -n "${GITHUB_TOKEN:-}" ]] && { secret_names+=( GH_PUSH_TOKEN ); secret_values+=( "$GITHUB_TOKEN" ); }
[[ -n "${GITHUB_APP_PRIVATE_KEY:-}" ]] && { secret_names+=( SKILLS_GITHUB_APP_PRIVATE_KEY ); secret_values+=( "$GITHUB_APP_PRIVATE_KEY" ); }

var_names=( SKILLS_GITHUB_REPO SKILLS_GITHUB_BRANCH NOTION_ENV SKILLS_DATA_SOURCE_ID GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL )
var_values=( "${GITHUB_REPO:-}" "${GITHUB_BRANCH:-}" "${NOTION_ENV:-prod}" "${SKILLS_DATA_SOURCE_ID:-}" "${GIT_AUTHOR_NAME:-my-skills}" "${GIT_AUTHOR_EMAIL:-my-skills@users.noreply.github.com}" )
if [[ -n "${SYNC_IGNORE_PLUGINS:-}" ]]; then
  var_names+=( SYNC_IGNORE_PLUGINS )
  var_values+=( "$SYNC_IGNORE_PLUGINS" )
fi
if [[ -n "${GITHUB_APP_ID:-}" ]]; then
  var_names+=( SKILLS_GITHUB_APP_ID )
  var_values+=( "$GITHUB_APP_ID" )
fi

missing=()
for i in "${!secret_names[@]}"; do [[ -z "${secret_values[i]}" ]] && missing+=( "${secret_names[i]} (from its .env key)" ); done
for i in "${!var_names[@]}"; do [[ -z "${var_values[i]}" ]] && missing+=( "${var_names[i]}" ); done
if (( ${#missing[@]} > 0 )); then
  echo "missing values in .env:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  exit 1
fi

for i in "${!secret_names[@]}"; do
  name="${secret_names[i]}"
  if [[ $PRINT == 1 ]]; then
    echo "would set secret $name on $REPO"
  else
    printf '%s' "${secret_values[i]}" | "$GH" secret set "$name" -R "$REPO" >/dev/null
    echo "set secret $name"
  fi
done
for i in "${!var_names[@]}"; do
  name="${var_names[i]}"
  if [[ $PRINT == 1 ]]; then
    echo "would set variable $name=${var_values[i]}"
  else
    "$GH" variable set "$name" --body "${var_values[i]}" -R "$REPO" >/dev/null
    echo "set variable $name"
  fi
done
[[ $PRINT == 1 ]] && echo "(nothing was sent)" || true
