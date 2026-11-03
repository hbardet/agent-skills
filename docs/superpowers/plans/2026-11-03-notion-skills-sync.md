# Notion Skills Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a Notion Skills database the source of truth for the `batch-features` and `work-issue` skills, with `hbardet/agent-skills` holding the published copy that `install.sh` installs.

**Architecture:** A private repo `hbardet/my-skills` (a copy of `makenotion/notion-skills-github-sync`) holds the hourly sync workflow and its credentials; it publishes `plugins/<slug>/…` + `.claude-plugin/marketplace.json` into `hbardet/agent-skills` `main` through the GitHub API. Two Notion rows are seeded once from the current `skills/*/SKILL.md`; after that Notion is authoritative, `skills/` is deleted, and `shared/` stays hand-maintained in git. One `.env` here is the only secret store, exported into local sync runs and pushed to the fork as Actions secrets/variables.

**Tech Stack:** bash 4+, Bun (fork's runtime), `npx --yes ntn` 0.23.26 (Notion CLI), `gh` CLI, Notion public API (`/v1/ai/plugins`, `/v1/pages`, `/v1/data_sources`).

**Spec:** `specs/2026-11-03-notion-skills-sync-design.md`

## Global Constraints

- Repo is public: `hbardet/agent-skills`, branch `main`. Bot commits land on `main` directly.
- Skills' bodies ship **unchanged** — only the YAML frontmatter block is moved into DB properties. No rewriting, no generalising, no "improving" the prose.
- `shared/` stays in git and stays installed; it is **not** published into the plugin. The README must state that a marketplace-only consumer gets two skills whose `../shared/` does not exist.
- Notion DB: **two rows** (`batch-features`, `work-issue`), DB lives under the **Process IA** page `40d901c1-90a1-808c-b01f-f0115d8c9e2a`, one connection named **Skills Sync** added to that DB only (plus its parent page, needed for the first insert).
- Push credential: fine-grained PAT, Contents read & write, repo `hbardet/agent-skills` only. The user fills `.env`; no script may ever print a token value.
- `npx --yes ntn` (bridge the CLI as `NTN_BIN`, default `npx --yes ntn`); `jq` is **not** installed on this machine — parse JSON with `bun -e` or `node -e`.
- Every bash script starts with `set -euo pipefail` and resolves `REPO_ROOT` from its own path (works from any cwd).
- Fork working copy: `${SYNC_FORK_DIR:-$HOME/work/my-skills}`.
- Tokens never appear in `argv`: `gh secret set` reads the value on stdin.

## Review Focus

- `NOTION_API_TOKEN` is an `ntn_…` string pasted into `.env`; a stray quote, trailing space, or CRLF must not survive into the request (a mangled token looks like "not found", not "bad token").
- Secrets must never be echoed: `set -x` in a script, `gh secret set` with the value as an argument, or a debug print of the whole env file would leak the PAT.
- Seeding half-succeeds (page created, property PATCH failed) and is re-run: it must find the existing row by `Skill name` and finish, not create a duplicate.
- The sync publishes **every plugin the token can read**; if a second skills DB or plugin is ever connected to "Skills Sync", a sync rewrites `plugins/` with content we did not author.
- `install.sh` after `skills/` is deleted: a leftover fallback path must not leave a dangling symlink in `~/.agents/skills`.

---

### Task 1: `.env` plumbing

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`
- Create: `scripts/lib/env.sh`
- Test: `test/env-lib.test.sh`

**Interfaces:**
- Produces: `load_env [file]` (defaults to `$REPO_ROOT/.env`, exports key/values, no output), `require_vars NAME…` (exits 1 listing missing names on stderr), `env_names` (prints `KEY` per line, or `KEY  set|missing` with `--check`).

- [ ] **Step 1: Write the failing test**

```bash
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
[[ "${D:-unset}" == "" ]] || { echo "FAIL D=$D"; fails=1; }
[[ "${E:-}" == "crlf" ]] || { echo "FAIL E=$(printf %q "${E:-}")"; fails=1; }
err="$(require_vars A B ZZ 2>&1)" && { echo "FAIL require_vars exit 0"; fails=1; }
grep -q '^ZZ$' <<<"$err" || { echo "FAIL missing list: $err"; fails=1; }
grep -q '^A$' <<<"$err" && { echo "FAIL listed present var"; fails=1; }
load_env "$tmp" --check | grep -qx 'C  set' || { echo "FAIL --check"; fails=1; }
exit $fails
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash test/env-lib.test.sh; echo "exit=$?"`
Expected: `exit=1` (script missing `scripts/lib/env.sh`, source fails).

- [ ] **Step 3: Implement `scripts/lib/env.sh`**

`load_env` reads `KEY=VALUE` lines, skips blanks/`#`, strips one layer of matching single or double quotes, drops a trailing CR (`\r`), and `export`s. `require_vars` collects the names where `[[ -z "${!name:-}" ]]` and prints them one per line to stderr. `env_names --check` prints `NAME  set` or `NAME  missing`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bash test/env-lib.test.sh; echo "exit=$?"`
Expected: `exit=0` with no `FAIL` lines.

- [ ] **Step 5: Add `.env.example` and ignore `.env`**

`.env.example` is the block already in the spec's *Configuration* section (Notion token, `NOTION_ENV`, `SKILLS_DATA_SOURCE_ID`, `GITHUB_REPO=hbardet/agent-skills`, `GITHUB_BRANCH=main`, `GITHUB_TOKEN`, the three optional `GITHUB_APP_*`, `GIT_AUTHOR_NAME=my-skills`, `GIT_AUTHOR_EMAIL=my-skills@users.noreply.github.com`). `.gitignore` gains `.env` and `*.local`.

- [ ] **Step 6: Verify `.env` cannot be committed**

Run: `git check-ignore -v .env || touch .env && git check-ignore -v .env`
Expected: a line naming `.gitignore:` and `.env`.

- [ ] **Step 7: Commit**

```bash
git add .env.example .gitignore scripts/lib/env.sh test/env-lib.test.sh
git commit -m "chore: add .env plumbing for the Notion sync"
```

---

### Task 2: Fork working copy of the sync tool

**Files:**
- Create: `scripts/bootstrap-fork.sh`

**Interfaces:**
- Produces: `$SYNC_FORK_DIR` on disk with remotes `origin` (→ `hbardet/my-skills`) and `upstream` (→ `makenotion/notion-skills-github-sync`), dependencies installed, `.github/workflows/sync.yml` present. Prints the resolved path on success.

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# scripts/bootstrap-fork.sh — create/refresh the sync-tool working copy.
set -euo pipefail
DIR="${SYNC_FORK_DIR:-$HOME/work/my-skills}"
UPSTREAM="https://github.com/makenotion/notion-skills-github-sync.git"
if [[ ! -d "$DIR/.git" ]]; then
  git clone "$UPSTREAM" "$DIR"
  git -C "$DIR" remote rename origin upstream
  git -C "$DIR" remote add origin git@github.com:hbardet/my-skills.git
fi
[[ -f "$DIR/.github/workflows/sync.yml" ]] || { echo "no sync.yml in $DIR" >&2; exit 1; }
(cd "$DIR" && bun install --frozen-lockfile)
echo "$DIR"
```

- [ ] **Step 2: Create the private repo and push**

Run: `gh repo create hbardet/my-skills --private --description "Notion skills sync (fork of makenotion/notion-skills-github-sync)"`
Then: `SYNC_FORK_DIR=$HOME/work/my-skills bash scripts/bootstrap-fork.sh && git -C "$HOME/work/my-skills" push -u origin main`
Expected: clone + install succeed, push reports `main -> main`.

- [ ] **Step 3: Verify the tool runs**

Run: `cd "${SYNC_FORK_DIR:-$HOME/work/my-skills}" && bun run src/cli.ts --help`
Expected: usage text listing `sync` (no exception, no missing-env stack trace).

- [ ] **Step 4: Verify remotes**

Run: `git -C "${SYNC_FORK_DIR:-$HOME/work/my-skills}" remote -v`
Expected: `origin` → `hbardet/my-skills` (fetch/push), `upstream` → `makenotion/notion-skills-github-sync`.

- [ ] **Step 5: Verify upstream updates still apply**

Run: `git -C "${SYNC_FORK_DIR:-$HOME/work/my-skills}" fetch upstream && git -C "${SYNC_FORK_DIR:-$HOME/work/my-skills}" log --oneline -1 upstream/main`
Expected: a commit hash; nothing to merge on a fresh copy (`git status` clean).

- [ ] **Step 6: Commit the script**

```bash
git add scripts/bootstrap-fork.sh
git commit -m "feat: bootstrap the my-skills sync-tool fork"
```

---

### Task 3: Notion database, connection, and a checker

**Files:**
- Create: `scripts/notion-check.sh`
- Create: `docs/notion-sync-setup.md`

**Interfaces:**
- Consumes: `.env` (`NOTION_API_TOKEN`, `SKILLS_DATA_SOURCE_ID`, optional `NOTION_ENV`).
- Produces: `scripts/notion-check.sh` prints three sections — identity, data source, plugins — and exits 1 if the token is rejected or more than one plugin is visible.

- [ ] **Step 1: Manual (the user does this once, in the browser)**

1. Open **Process IA** (`https://app.notion.com/p/Process-IA-40d901c190a1808cb01ff0115d8c9e2a`) → new **Database** → set its type to **Skills** (the Agent Plugins type) → title it **Agent Skills**.
2. On the DB page, `···` → **Connections** → **Add connection** → the connection must be created first at `notion.so` → Settings → **Connections** → **New connection** → name **Skills Sync** → access token → capabilities **Read**, **Insert content**, **Update content** → copy the `ntn_…` value into `.env` as `NOTION_API_TOKEN`.
3. Without adding the connection to the parent page **Process IA** too, the first insert fails with "object not found" — add it there as well.
4. Copy the data-source id into `.env` as `SKILLS_DATA_SOURCE_ID` (Step 3 prints it).

- [ ] **Step 2: Write the checker**

```bash
#!/usr/bin/env bash
# scripts/notion-check.sh — fail fast on a wrong token or an over-scoped connection.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=./lib/env.sh
source "$ROOT/scripts/lib/env.sh"
load_env "${ENV_FILE:-$ROOT/.env}"
require_vars NOTION_API_TOKEN SKILLS_DATA_SOURCE_ID
NTN="${NTN_BIN:-npx --yes ntn}"

echo "== identity"
$NTN api /v1/users/me | grep -E '"(name|type)"' || { echo "token rejected" >&2; exit 1; }

echo "== data source $SKILLS_DATA_SOURCE_ID"
$NTN api "/v1/data_sources/$SKILLS_DATA_SOURCE_ID" | grep -E '"(name|object)"'

echo "== plugins visible to this connection"
out="$($NTN api /v1/ai/plugins)"
echo "$out"
count="$(bun -e 'const s=await Bun.stdin.text();const j=JSON.parse(s);console.log((j.results??j.plugins??[]).length)' <<<"$out")"
[[ "$count" == "1" ]] || { echo "expected exactly 1 plugin, got $count — check what is connected to Skills Sync" >&2; exit 1; }
```

- [ ] **Step 3: Resolve the data source id**

Run: `NOTION_API_TOKEN=$(grep -oP '^NOTION_API_TOKEN=\K.*' .env) npx --yes ntn datasources resolve <database-id-from-url>`
Expected: one data-source id; it is what goes into `SKILLS_DATA_SOURCE_ID`.

- [ ] **Step 4: Run the checker with an empty DB**

Run: `bash scripts/notion-check.sh; echo "exit=$?"`
Expected: identity prints your name; data source prints `Agent Skills`; plugins section fails with `expected exactly 1 plugin, got 0` — correct for an empty DB, so note that this check only goes green after Task 4.

- [ ] **Step 5: Run the checker with a bad token**

Run: `NOTION_API_TOKEN=ntn_bogus bash scripts/notion-check.sh; echo "exit=$?"`
Expected: `token rejected` on stderr, `exit=1`, no token value printed anywhere.

- [ ] **Step 6: Write `docs/notion-sync-setup.md`**

Sections: the six `.env` values and where each comes from (Notion connection, PAT builder URL `https://github.com/settings/personal-access-tokens/new`, the org-approval case), the two workspace settings that silently block connections ("Limit who can create personal access tokens", "Limit who can create internal connections"), the DB/connection steps from Step 1, and the note that the connection must also be added to the parent page.

- [ ] **Step 7: Commit**

```bash
git add scripts/notion-check.sh docs/notion-sync-setup.md
git commit -m "feat: verify the Notion connection and its publish scope"
```

---

### Task 4: Seed the two rows from `skills/*/SKILL.md`

**Files:**
- Create: `scripts/lib/skill-md.ts`
- Create: `scripts/seed-notion.ts`
- Test: `test/skill-md.test.ts`

**Interfaces:**
- Produces: `splitFrontmatter(raw: string): { data: Record<string,string>; body: string }` and `skillProperties(data): { title: string; description: string }` from `scripts/lib/skill-md.ts`; CLI `bun scripts/seed-notion.ts [--dry-run] [--force]` (env: `NOTION_API_TOKEN`, `SKILLS_DATA_SOURCE_ID`, `NTN_BIN`, `SKILLS_DIR`).

- [ ] **Step 1: Write the failing test**

```ts
// test/skill-md.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { splitFrontmatter, skillProperties } from "../scripts/lib/skill-md";

test("splits the real work-issue skill", () => {
  const { data, body } = splitFrontmatter(readFileSync("skills/work-issue/SKILL.md", "utf8"));
  expect(data.name).toBe("work-issue");
  expect(data.description.length).toBeGreaterThan(200);
  expect(body.startsWith("# Work issue")).toBe(true);
  expect(body).not.toContain("---\nname:");
});

test("tolerates CRLF and a missing trailing newline", () => {
  const { data, body } = splitFrontmatter("---\r\nname: x\r\ndescription: y\r\n---\r\n\r\n# X");
  expect(data).toEqual({ name: "x", description: "y" });
  expect(body).toBe("# X");
});

test("rejects a file without frontmatter", () => {
  expect(() => splitFrontmatter("# no yaml")).toThrow(/frontmatter/);
});

test("maps to DB properties", () => {
  expect(skillProperties({ name: "x", description: "d" })).toEqual({ title: "x", description: "d" });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun test test/skill-md.test.ts`
Expected: FAIL — cannot find module `../scripts/lib/skill-md`.

- [ ] **Step 3: Implement `scripts/lib/skill-md.ts`**

Split on the first two lines that are exactly `---`, normalise `\r\n`→`\n` first, parse `key: value` per line (values are single-line in both skills — no YAML lib), throw `new Error("missing frontmatter")` when there is no leading `---`, and trim the body's leading blank lines. `skillProperties` returns `{ title: data.name, description: data.description }` and throws if either is empty.

- [ ] **Step 4: Run it to verify it passes**

Run: `bun test test/skill-md.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Implement `scripts/seed-notion.ts`**

Per skill directory (`${SKILLS_DIR:-skills}/*/SKILL.md`), in this order:
1. list existing rows: `$NTN_BIN datasources query --data-source "$SKILLS_DATA_SOURCE_ID"` → parse with `Bun` → set of `Skill name` values;
2. if the name exists and `--force` is absent, print `skip <name> (exists)` and continue;
3. otherwise `$NTN_BIN pages create --parent "data-source:$SKILLS_DATA_SOURCE_ID"` with `body` on stdin (`--content -` or stdin per the CLI's behaviour, whichever the tool accepts — verify by running it);
4. then `$NTN_BIN api -X PATCH "v1/pages/<page-id>" -d @props.json` where props are `{"properties":{"Description":{"rich_text":[{"text":{"content":<description>}}]},"Tags":{"multi_select":[{"name":"agent-skill"}]}}}`;
5. `--dry-run` prints the exact commands and the description length, changes nothing.

- [ ] **Step 6: Verify `--dry-run` twice is identical and side-effect free**

Run: `bun scripts/seed-notion.ts --dry-run > /tmp/a; bun scripts/seed-notion.ts --dry-run > /tmp/b; diff /tmp/a /tmp/b && echo identical`
Expected: `identical`, and `/tmp/a` contains both skill names, two `pages create` lines, and no `ntn_` token anywhere.

- [ ] **Step 7: Seed for real, then re-run to prove idempotency**

Run: `bun scripts/seed-notion.ts && bun scripts/seed-notion.ts`
Expected: first run creates 2 pages and patches 2; second run prints `skip batch-features (exists)` and `skip work-issue (exists)` with exit 0. Then `bash scripts/notion-check.sh` exits 0 with exactly one plugin.

- [ ] **Step 8: Confirm the rendered body matches**

Run in the DB: open each row; compare against `skills/*/SKILL.md` section by section (headings, lists, tables, code fences).
Expected: the body text is identical; only the frontmatter is gone (it now comes from the properties). Record any block the markdown importer flattened in `docs/notion-sync-setup.md` under "Known renderer differences".

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/skill-md.ts scripts/seed-notion.ts test/skill-md.test.ts
git commit -m "feat: seed the Notion skills DB from the repo"
```

---

### Task 5: Local sync runner

**Files:**
- Create: `scripts/notion-sync.sh`

**Interfaces:**
- Consumes: `.env`, `$SYNC_FORK_DIR`.
- Produces: `scripts/notion-sync.sh [dry-run|sync]` (default `dry-run`), running the fork's CLI from the fork directory with `.env` exported; `dry-run` passes `--dry-run` to the tool and never writes to GitHub.

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# scripts/notion-sync.sh [dry-run|sync]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-dry-run}"
case "$MODE" in dry-run|sync) ;; *) echo "usage: $0 [dry-run|sync]" >&2; exit 2 ;; esac
# shellcheck source=./lib/env.sh
source "$ROOT/scripts/lib/env.sh"
load_env "${ENV_FILE:-$ROOT/.env}"
require_vars NOTION_API_TOKEN GITHUB_REPO GITHUB_BRANCH
FORK="${SYNC_FORK_DIR:-$HOME/work/my-skills}"
[[ -d "$FORK" ]] || { echo "no fork at $FORK (run scripts/bootstrap-fork.sh)" >&2; exit 1; }
if [[ "$MODE" == sync ]]; then require_vars GITHUB_TOKEN; fi
args=(src/cli.ts sync)
[[ "$MODE" == dry-run ]] && args+=(--dry-run)
cd "$FORK" && bun run "${args[@]}"
```

- [ ] **Step 2: Verify required vars are enforced**

Run: `NOTION_API_TOKEN= bash scripts/notion-sync.sh; echo "exit=$?"`
Expected: prints `NOTION_API_TOKEN` on stderr and `exit=1`; no request is made.

- [ ] **Step 3: Run the dry run against the seeded DB**

Run: `bash scripts/notion-sync.sh dry-run; echo "exit=$?"`
Expected: exit 0, output names one plugin and lists the files it would write (`plugins/<slug>/skills/batch-features/SKILL.md`, `…/work-issue/SKILL.md`, `.claude-plugin/marketplace.json`, `.notion-sync.json`), and no `shared/` path.

- [ ] **Step 4: Diff the rendered body against the live file**

Run (after the first `sync` in Task 7): `diff skills/work-issue/SKILL.md plugins/*/skills/work-issue/SKILL.md`
Expected: differences limited to the regenerated frontmatter (name/description now come from the DB
properties) and trailing whitespace; no missing paragraph, no flattened table.

- [ ] **Step 5: Commit**

```bash
git add scripts/notion-sync.sh
git commit -m "feat: run the Notion sync locally from the canonical .env"
```

---

### Task 6: Push the configuration to the fork

**Files:**
- Create: `scripts/set-sync-config.sh`
- Test: `test/set-sync-config.test.sh`

**Interfaces:**
- Consumes: `.env`, `GH_BIN` (default `gh`), argument `<owner/repo>` (default `hbardet/my-skills`).
- Produces: fork secrets `NOTION_API_TOKEN`, `GH_PUSH_TOKEN`, `SKILLS_GITHUB_APP_PRIVATE_KEY` (when set); variables `SKILLS_GITHUB_REPO`, `SKILLS_GITHUB_BRANCH`, `NOTION_ENV`, `SKILLS_DATA_SOURCE_ID`, `SKILLS_GITHUB_APP_ID` (when set), `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`. `--print` mode prints the commands with values redacted.

- [ ] **Step 1: Write the failing test**

```bash
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bash test/set-sync-config.test.sh; echo "exit=$?"`
Expected: FAIL — `scripts/set-sync-config.sh` does not exist.

- [ ] **Step 3: Implement `scripts/set-sync-config.sh`**

`gh secret set <NAME> -R "$REPO"` with the value piped on stdin; `gh variable set <NAME> --body "$value" -R "$REPO"` (variables are not secret). Map `GITHUB_TOKEN`→`GH_PUSH_TOKEN`, `GITHUB_REPO`→`SKILLS_GITHUB_REPO`, `GITHUB_BRANCH`→`SKILLS_GITHUB_BRANCH`, `GITHUB_APP_ID`→`SKILLS_GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`→`SKILLS_GITHUB_APP_PRIVATE_KEY` (secret). Skip optional names when empty. `--print` prints `would set secret NAME` / `would set variable NAME=value` with secret values replaced by `<redacted>`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bash test/set-sync-config.test.sh; echo "exit=$?"`
Expected: `ok` and `exit=0`.

- [ ] **Step 5: Apply it to the fork**

Run: `bash scripts/set-sync-config.sh hbardet/my-skills`
Expected: eight-ish `✓ Set` lines; no token echoed.

- [ ] **Step 6: Verify on GitHub**

Run: `gh secret list -R hbardet/my-skills && gh variable list -R hbardet/my-skills`
Expected: secrets `NOTION_API_TOKEN`, `GH_PUSH_TOKEN` with recent timestamps; variables `SKILLS_GITHUB_REPO=hbardet/agent-skills`, `SKILLS_GITHUB_BRANCH=main`, `NOTION_ENV`, `SKILLS_DATA_SOURCE_ID`, `GIT_AUTHOR_*`.

- [ ] **Step 7: Commit**

```bash
git add scripts/set-sync-config.sh test/set-sync-config.test.sh
git commit -m "feat: push .env to the fork as Actions secrets and variables"
```

---

### Task 7: First real sync, and `install.sh` on the synced tree

**Files:**
- Modify: `install.sh`
- Create: `test/install-sh.test.sh`

**Interfaces:**
- Produces: `install.sh` links, per skill, `plugins/*/skills/<name>` when present, else `skills/<name>`; always links the repo's `shared/`; removes a link it owns before replacing it; refuses to link a target that does not exist.

- [ ] **Step 1: Read the current script and keep its contract**

Run: `cat install.sh`
Expected: it symlinks `skills/batch-features`, `skills/work-issue`, `shared` into `$AGENTS_SKILLS_DIR` (default `~/.agents/skills`). Preserve the flag names and the summary output; only the source resolution changes.

- [ ] **Step 2: Write the failing test**

```bash
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bash test/install-sh.test.sh; echo "exit=$?"`
Expected: `FAIL exit` (current script looks only under `skills/` and ignores `REPO_ROOT`).

- [ ] **Step 4: Modify `install.sh`**

Resolve `ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")" && pwd)}"`, discover `PLUGIN_SKILLS="$(ls -d "$ROOT"/plugins/*/skills 2>/dev/null | head -1)"`, and for each skill name pick `"${PLUGIN_SKILLS:-$ROOT/skills}/<name>"` if the directory exists; error out (exit 1, naming the skill) if neither exists. Link `shared/` from `$ROOT/shared` always.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bash test/install-sh.test.sh; echo "exit=$?"`
Expected: `ok`, `exit=0`.

- [ ] **Step 6: First real sync**

Run: `bash scripts/notion-sync.sh sync; echo "exit=$?"`
Expected: exit 0; commits land on `hbardet/agent-skills` `main`.

- [ ] **Step 7: Verify the published tree**

Run: `git -C /home/hugo/work/agent-skills pull --ff-only && ls -R plugins | head -20 && cat .claude-plugin/marketplace.json`
Expected: `plugins/<slug>/skills/{batch-features,work-issue}/SKILL.md`, one marketplace entry per skill, and no `shared/` under `plugins/`.

- [ ] **Step 8: Verify a real install**

Run: `rm -rf /tmp/skills-home && AGENTS_SKILLS_DIR=/tmp/skills-home bash install.sh && ls -l /tmp/skills-home && test -f /tmp/skills-home/work-issue/SKILL.md && test -f /tmp/skills-home/shared/labels.md && echo installed`
Expected: `installed`, three symlinks, no dangling target.

- [ ] **Step 9: Commit**

```bash
git add install.sh test/install-sh.test.sh plugins .claude-plugin
git commit -m "feat: install skills from the synced plugin tree"
```

---

### Task 8: Retire `skills/` and document the new source of truth

**Files:**
- Delete: `skills/batch-features/SKILL.md`, `skills/work-issue/SKILL.md`
- Create: `test/fixtures/batch-features.SKILL.md`, `test/fixtures/work-issue.SKILL.md`
- Modify: `test/skill-md.test.ts`, `README.md`, `AGENTS.md`

**Interfaces:**
- Produces: a repo where the only editable skill prose is in Notion; `shared/` and `config/` documented as the two hand-maintained exceptions.

- [ ] **Step 1: Freeze the frontmatter fixtures before deleting**

Run: `mkdir -p test/fixtures && cp skills/batch-features/SKILL.md test/fixtures/batch-features.SKILL.md && cp skills/work-issue/SKILL.md test/fixtures/work-issue.SKILL.md`
Then point `test/skill-md.test.ts` at `test/fixtures/work-issue.SKILL.md`. Without this, `bun test`
breaks the moment `skills/` disappears.

- [ ] **Step 2: Run the suite to confirm the fixtures work**

Run: `bun test test/skill-md.test.ts`
Expected: 4 passing, still reading the real frontmatter.

- [ ] **Step 3: Delete the old copies**

Run: `git rm -r skills`
Expected: both `SKILL.md` files removed; `git status` shows only deletions.

- [ ] **Step 4: Verify nothing still reads them**

Run: `grep -rn "skills/" --include='*.sh' --include='*.ts' --include='*.md' . | grep -v plugins/ | grep -v node_modules | grep -v docs/superpowers | grep -v specs/`
Expected: no hit that is a code path (mentions in `README`/`AGENTS` must be rewritten in the next step).

- [ ] **Step 5: Rewrite the source-of-truth sections**

`README.md`: replace "the skills live in `skills/`" with — Notion **Agent Skills** DB (link to Process IA) is the source; `plugins/` is generated by `hbardet/my-skills`' hourly workflow and must never be hand-edited; `shared/` and `config/` are still git-maintained; a marketplace-only consumer gets skills whose `../shared/` is absent (known limitation); `install.sh` is the supported install path. `AGENTS.md`: same rules in imperative form, plus "to change a skill, edit the Notion row; do not edit `plugins/`".

- [ ] **Step 6: Verify a clean install from a fresh clone**

Run: `tmp=$(mktemp -d) && git clone . "$tmp/r" && AGENTS_SKILLS_DIR="$tmp/h" bash "$tmp/r/install.sh" && test -f "$tmp/h/work-issue/SKILL.md" && test -f "$tmp/h/shared/labels.md" && echo ok`
Expected: `ok` — the clone has no `skills/`, so this proves the published tree is installable on its own.

- [ ] **Step 7: Commit**

```bash
git add -A skills test README.md AGENTS.md
git commit -m "docs: Notion is the source of truth for the two skills"
```

---

### Task 9: Prove the scheduled workflow

**Files:** none (verification in the fork and on GitHub).

**Interfaces:**
- Consumes: fork secrets/variables from Task 6, a pushed `.github/workflows/sync.yml`.

- [ ] **Step 1: Dispatch once**

Run: `gh workflow run sync.yml -R hbardet/my-skills && sleep 20 && gh run list -R hbardet/my-skills -w sync.yml -L 1`
Expected: a run in progress or completed with conclusion `success`.

- [ ] **Step 2: Read the run log for the write path**

Run: `gh run view -R hbardet/my-skills --log | grep -Ei "plugin|commit|up to date|no changes" | head -20`
Expected: one plugin, either a commit sha or `no changes`; no `401`/`403`.

- [ ] **Step 3: Prove idempotency**

Run: `gh workflow run sync.yml -R hbardet/my-skills && sleep 60 && gh run list -R hbardet/my-skills -w sync.yml -L 2` then `git -C /home/hugo/work/agent-skills pull --ff-only && git status --short`
Expected: second run succeeds and produces **no** new commit (working tree clean after the pull).

- [ ] **Step 4: Confirm the cron is registered**

Run: `gh api "repos/hbardet/my-skills/actions/workflows" | grep -o '"path":"[^"]*"\|"state":"[^"]*"'`
Expected: `.github/workflows/sync.yml` with `"state":"active"`.

- [ ] **Step 5: Record the outcome**

Append a short "Verified" section to `docs/notion-sync-setup.md`: date, run ids, and the one thing that surprised you. Commit:

```bash
git add docs/notion-sync-setup.md
git commit -m "docs: record the first verified scheduled sync"
```
