#!/usr/bin/env bash
# test/env-lib.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../scripts/lib/env.sh
source "$ROOT/scripts/lib/env.sh"
fails=0
tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
printf '# comment\n\nA=1\nB="quoted value"\nC=has#hash\nD=\nE=crlf\r\n' > "$tmp"
load_env "$tmp"
[[ "${A:-}" == 1 ]] || { echo "FAIL A=$A"; fails=1; }
[[ "${B:-}" == "quoted value" ]] || { echo "FAIL B=$B"; fails=1; }
[[ "${C:-}" == "has#hash" ]] || { echo "FAIL C=$C"; fails=1; }
[[ "${D+x}" == "x" && -z "$D" ]] || { echo "FAIL D unset-or-nonempty: ${D-<unset>}"; fails=1; }
[[ "${E:-}" == "crlf" ]] || { echo "FAIL E=$(printf %q "${E:-}")"; fails=1; }
err="$(require_vars A B ZZ 2>&1)" && { echo "FAIL require_vars exit 0"; fails=1; }
grep -q '^ZZ$' <<<"$err" || { echo "FAIL missing list: $err"; fails=1; }
grep -q '^A$' <<<"$err" && { echo "FAIL listed present var"; fails=1; }
load_env "$tmp" --check | grep -qx 'C  set' || { echo "FAIL --check"; fails=1; }
exit $fails
