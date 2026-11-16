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
| File | `glab issue create --title "..." --description-file <path> --label "..." --yes` |
| Comment | `glab issue note <n> --message "..."` |
| Close | `glab issue close <n>` |
| Labels | `glab label list`, `glab label create -n <name> -c "#hex"` |
| MR | `glab mr create --title "..." --description-file <path> --target-branch <default> --source-branch <branch>` |
| MR link | the MR URL returned by `glab mr create`; also `Closes #<n>` in the body auto-closes the issue on merge |

Dependencies: there are no dependency labels. If the issue body's **Notes** says it waits on
another issue, check that issue's state before starting; add the native relation only when the
CLI reports it is available and the user asked for it.

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

Dependencies: there are no dependency labels. If the issue body's **Notes** says it waits on
another issue, check that issue's state before starting; add the native dependency only when the
CLI reports it is available and the user asked for it.

## Spec and plan documents

The issue is the container for the whole change, and it holds three things:

| Part | Where | Lifetime |
|---|---|---|
| What the change is | issue **body**, from the project's own template | set once |
| The design | **spec** document attached to the issue | set once, edited only on request |
| The implementation plan | **plan** document attached to the issue | rewritten as tasks complete |

The body stays short. The documents carry the prose, so a long design does not bloat the issue.
Nothing here is ever written into the project repo — not even gitignored, because the next machine
will not have it.

### GitHub (`gh`)

`gh issue artifact` is a preview command and needs `gh >= 2.103`. Probe it once per session:

```bash
gh issue artifact --help >/dev/null 2>&1 || echo "no artifacts — use the comment fallback"
```

| Action | Command |
|---|---|
| File the issue | `gh issue create --title "..." --body-file <description.md> --label status::ready --label kind::feature` |
| Attach the spec | `gh issue artifact create <n> '<design.md>#design'` |
| Attach the plan | `gh issue artifact create <n> --type plan --name plan --body-file <plan.md>` |
| Find them | `gh issue artifact list <n> --json number,title,type` |
| Read one | `gh issue artifact view <n> <artifact-number>` |
| Replace the plan | `gh issue artifact edit <n> <artifact-number> --body-file <plan.md>` |

Fallback when the CLI is too old or artifacts are not enabled: post each document as a comment
whose first line is `<!-- agent-skills:spec -->` or `<!-- agent-skills:plan -->`
(`{ echo '<!-- agent-skills:spec -->'; cat design.md; } | gh issue comment <n> -F -`), and read it
back with `gh issue view <n> --comments`.

### GitLab (`glab`)

`glab work-items` is experimental, `create` and `update` take no `--label`, and it has no note
subcommand. Create the work item, label it through `glab issue update` (a work item is an issue and
shares its iid), and carry both documents as comments.

| Action | Command |
|---|---|
| File the work item | `glab work-items create --type issue --title "..." --description-file <description.md>` |
| Label it | `glab issue update <iid> --label "status::ready,kind::feature"`; fallback `glab api "projects/:id/issues/<iid>" -X PUT -f "add_labels=status::ready,kind::feature"` |
| Attach the spec | `{ echo '<!-- agent-skills:spec -->'; cat design.md; } \| glab issue note <iid>` |
| Attach the plan | `{ echo '<!-- agent-skills:plan -->'; cat plan.md; } \| glab issue note <iid>` |
| Find them | `glab api "projects/:id/issues/<iid>/notes?per_page=100" --paginate` |
| Replace the plan | `glab api "projects/:id/issues/<iid>/notes/<note-id>" -X PUT -F "body=@plan.md"` |

The marker line is what makes a document findable later: fetch the notes, pick the one whose body
starts with it, and ignore the rest.

## Rules

- Always read an issue before acting on it; never assume its labels or state.
- Never claim an issue that already has `status::in-progress`.
- Use `--description-file` / `--body-file` for anything multi-line; a shell-quoted body breaks.
- Never push to the default branch; always work on a feature branch.
- Never merge or close without the user's explicit go-ahead (the `work-issue` skill finishes with
  an MR proposal, not an auto-merge).
- The tracker's copy of the plan is the source of truth. A local copy under `plansDir` is scratch:
  write it from the tracker before executing, refresh it when the tracker copy changes, never commit
  it, and let the tracker win on any conflict.
- Labels come from the project's `AGENTS.md` first, then `.agent-skills/config.json`, then
  `shared/labels.md` for defaults. Never invent a label name.
