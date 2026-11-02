# Tracker adapter

One adapter, two trackers. Detect from `git remote -v` (or from `.agent-skills/config.json` when
it already exists). Never hardcode both command sets in a skill's own body.

## Detection

```bash
git remote -v | grep -oE 'gitlab[^/]*\.|github\.com' | head -1
```

- `gitlab` → GitLab. Use `glab`.
- `github.com` → GitHub. Use `gh`.
- Neither → stop and ask the user which tracker to use; do not guess.

## Commands

### GitLab (`glab`)

| Action | Command |
|---|---|
| List issues | `glab issue list --per-page 100` |
| Read one | `glab issue view <n>` |
| File | `glab issue create --title "..." --description "..." --label "..."` |
| Comment | `glab issue note <n> --message "..."` |
| Close | `glab issue close <n>` |
| Labels | `glab label list`, `glab label create <name> --color "#hex"` |
| MR | `glab mr create --title "..." --description "..." --target-branch <default> --source-branch <branch>` |
| MR link | the MR URL returned by `glab mr create`; also `Closes #<n>` in the body auto-closes the issue on merge |

Dependencies: GitLab supports `blocks` / `blocked_by` only on premium tiers. Always write
`Depends on #n` in the body; add the native relation only when `glab api` reports it is available.

### GitHub (`gh`)

| Action | Command |
|---|---|
| List issues | `gh issue list --limit 100` |
| Read one | `gh issue view <n>` |
| File | `gh issue create --title "..." --body-file <path> --label "..."` |
| Comment | `gh issue comment <n> --body "..."` |
| Close | `gh issue close <n>` |
| Labels | `gh label list`, `gh label create <name> --color <hex>` |
| PR | `gh pr create --title "..." --body "..." --base <default> --head <branch>` |
| PR link | the PR URL returned by `gh pr create`; `Closes #<n>` in the body auto-closes on merge |

Dependencies: GitHub issue dependencies are available on some plans. Always write `Blocked by #n`
in the body; add the native dependency only when `gh api` reports it is available.

## Rules

- Always read an issue before acting on it; never assume its labels or state.
- Never claim an issue that already has `status::in-progress`.
- Always write the dependency in the body, not only in the native field.
- Never push to the default branch; always work on a feature branch.
- Never merge or close without the user's explicit go-ahead (the `work-issue` skill finishes with
  an MR proposal, not an auto-merge).
