# shared/

Pieces used by both `batch-features` and `work-issue`.

- `tracker-adapter.md` — how to detect GitLab vs GitHub and the exact `glab`/`gh` commands for
  reading, filing, labeling, linking, and commenting on issues. Both skills read this file instead
  of each carrying a copy.
- `issue-template.md` — the body template for a feature issue. Rendered by whichever skill files
  issues.
- `mr-template.md` — the body template for an MR/PR. Used by `work-issue` when opening the MR.
- `labels.md` — the label vocabulary and the "create if missing" behavior.
- `config.md` — the per-repo `.agent-skills/config.json` schema and the first-run questions.
