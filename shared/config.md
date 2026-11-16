# Per-repo config

File: `.agent-skills/config.json` at the repo root. Gitignored by default; the user can commit it
to share the conventions with the team.

Created on first run by asking the user a handful of questions. Both skills read the project's
`AGENTS.md` first, then this file: an explicit tracker, label vocabulary or verification command in
`AGENTS.md` wins, and these answers fill whatever it leaves open. If both are missing, the skills
fall back to detection and offer to create this file.

## Schema

```json
{
  "tracker": "gitlab",
  "defaultBranch": "main",
  "labels": {
    "status": ["ready", "blocked", "in-progress", "done"],
    "kinds": ["feature", "fix", "refactor", "chore"]
  },
  "verification": {
    "hasTestRunner": false,
    "commands": ["bun run build", "bun run lint"],
    "manual": "agent-browser: open the app, <specific steps for the feature>"
  },
  "stateDir": "~/.agent-skills/state/<owner>/<repo>",
  "plansDir": "~/.agent-skills/state/<owner>/<repo>/plans",
  "language": "en",
  "branchPrefix": "feat",
  "issueTemplate": null,
  "mrTemplate": null
}
```

- `stateDir` — root for disposable state **outside the project repo**. Neither the spec nor the
  plan is written here as an original: both are documents attached to the tracker issue, and the
  design is not kept locally at all.
- `plansDir` — the disposable local copy of the plan, because superpowers' scripts require a file
  path. `writing-plans` writes `YYYY-MM-DD-<slug>.md` here after attaching the plan to the issue;
  `work-issue` refreshes it from the issue before each task and syncs edits back. Never committed;
  the issue's plan document is the source of truth.
- `labels` — `status::` and `kind::` only. No size, area, or dependency labels. Ordering and
  blocking go in the issue body under **Notes**.
- `language` — the language for issue **titles and bodies**. Default `en`. The original wording
  of a pasted idea is always preserved verbatim as a quote under **Intent**, whatever this is.
- `issueTemplate` / `mrTemplate` — path to the project's own template when it has one; `null`
  means "none, use ours / offer to commit ours".

## First-run questions

1. Which tracker? (`AGENTS.md` states it when the project pins one; otherwise `git remote -v`;
   confirm before filing anything.)
2. What is the default branch? (detected from `git symbolic-ref refs/remotes/origin/HEAD`.)
3. Does the repo have a test runner? If yes, what command? If no, what command(s) prove a change
   works (build, lint, typecheck, manual browser check)?
4. Where should disposable state live? (Default `~/.agent-skills/state/<owner>/<repo>`; it is
   outside the repo by design.)
5. What language should issue titles and bodies use? (Default `en`; the original wording of a
   pasted idea is preserved as a quote regardless.)
6. Does the project already have an issue template and an MR/PR template? (If yes, record the
   paths; the skills use them instead of ours.)

## Fallbacks

- `tracker`: detect from `git remote -v`; if ambiguous, ask.
- `defaultBranch`: detect from `origin/HEAD`; else `main`.
- `verification.commands`: read `AGENTS.md` for build/lint commands; if none, ask.
- `stateDir` / `plansDir`: `~/.agent-skills/state/<owner>/<repo>` and `.../plans`.
- `language`: `en`.
