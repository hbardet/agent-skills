# Per-repo config

File: `.agent-skills/config.json` at the repo root. Gitignored by default; the user can commit it
to share the conventions with the team.

Created on first run by asking the user a handful of questions. Both skills read it instead of
asking again. If it is missing, the skills fall back to detection + `AGENTS.md` and offer to
create it.

## Schema

```json
{
  "tracker": "gitlab",
  "defaultBranch": "main",
  "labels": {
    "status": ["ready", "blocked", "in-progress", "done"],
    "sizes": ["S", "M", "L"],
    "kinds": ["feature", "fix", "refactor", "chore"],
    "areas": ["web", "admin", "api"]
  },
  "verification": {
    "hasTestRunner": false,
    "commands": ["bun run build", "bun run lint"],
    "manual": "agent-browser: open the app, <specific steps for the feature>"
  },
  "spec": {
    "dir": "docs/superpowers/specs",
    "plansDir": "docs/superpowers/plans"
  },
  "language": "en",
  "branchPrefix": "feat",
  "issueTemplate": null,
  "mrTemplate": null
}
```

- `spec.dir` — local directory for **spec files materialized from tracker issues**. `work-issue`
  writes the issue body here because `writing-plans` requires a spec path on disk.
- `spec.plansDir` — where `writing-plans` saves the plan.
- `language` — the language for issue **titles and bodies**. Default `en`. The original wording
  of a pasted idea is always preserved verbatim as a quote under **Intent**, whatever this is.
- `issueTemplate` / `mrTemplate` — path to the project's own template when it has one; `null`
  means "none, use ours / offer to commit ours".

## First-run questions

1. Which tracker? (detected from `git remote -v`; confirm.)
2. What is the default branch? (detected from `git symbolic-ref refs/remotes/origin/HEAD`.)
3. Does the repo have a test runner? If yes, what command? If no, what command(s) prove a change
   works (build, lint, typecheck, manual browser check)?
4. Which top-level areas should the `area::` labels cover?
5. What language should issue titles and bodies use? (Default `en`; the original wording of a
   pasted idea is preserved as a quote regardless.)
6. Where should specs and plans live? (Defaults to superpowers' `docs/superpowers/...`.)
7. Does the project already have an issue template and an MR/PR template? (If yes, record the
   paths; the skills use them instead of ours.)

## Fallbacks

- `tracker`: detect from `git remote -v`; if ambiguous, ask.
- `defaultBranch`: detect from `origin/HEAD`; else `main`.
- `verification.commands`: read `AGENTS.md` for build/lint commands; if none, ask.
- `spec.dir` / `spec.plansDir`: `docs/superpowers/specs` / `docs/superpowers/plans`.
- `language`: `en`.
