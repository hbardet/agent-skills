#!/usr/bin/env bash
# scripts/lib/env.sh — read a dotenv file without ever echoing its values.
#
#   load_env [file] [--check]   # default: $REPO_ROOT/.env
#   require_vars NAME...        # exit 1 listing the names that are unset or empty
#   env_names --check           # NAME  set|missing, one per line
#
# Values are exported. One layer of matching single or double quotes is stripped,
# a trailing CR is dropped, and anything after ' #' inside an unquoted value is
# kept as part of the value (only whole-line comments are comments).

# shellcheck shell=bash

_env_file="${_env_file:-}"

load_env() {
  local file="${1:-${ENV_FILE:-${REPO_ROOT:-$PWD}/.env}}"
  local check=0
  [[ "${2:-}" == "--check" ]] && check=1
  _env_file="$file"
  if [[ ! -f "$file" ]]; then
    [[ $check == 1 ]] && return 0
    echo "missing env file: $file" >&2
    return 1
  fi
  local line key val
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" == \#* ]] && continue
    line="${line#export }"
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    key="${key//[[:space:]]/}"
    [[ -z "$key" ]] && continue
    val="${line#*=}"
    if [[ "$val" == \"*\" && "$val" == *\" && ${#val} -ge 2 ]]; then
      val="${val:1:${#val}-2}"
    elif [[ "$val" == \'*\' && "$val" == *\' && ${#val} -ge 2 ]]; then
      val="${val:1:${#val}-2}"
    fi
    export "$key=$val"
    [[ $check == 1 ]] && _env_report "$key"
  done < "$file"
  return 0
}

_env_report() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    printf '%s  set\n' "$name"
  else
    printf '%s  missing\n' "$name"
  fi
}

require_vars() {
  local missing=() name
  for name in "$@"; do
    [[ -z "${!name:-}" ]] && missing+=("$name")
  done
  if (( ${#missing[@]} > 0 )); then
    printf '%s\n' "${missing[@]}" | while IFS= read -r n; do printf '%s\n' "$n" >&2; done
    return 1
  fi
  return 0
}

env_names() {
  [[ "${1:-}" == "--check" ]] || return 0
  local line key
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" == \#* ]] && continue
    line="${line#export }"
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    key="${key//[[:space:]]/}"
    [[ -n "$key" ]] && _env_report "$key"
  done < "${_env_file:-${ENV_FILE:-${REPO_ROOT:-$PWD}/.env}}"
}
