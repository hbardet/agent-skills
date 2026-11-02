# MR / PR template

**This is a fallback**, same rule as the issue template: if the project already has an MR/PR
template (`.gitlab/merge_request_templates/*.md`, `.github/PULL_REQUEST_TEMPLATE.md`, recorded in
`.agent-skills/config.json` as `mrTemplate`), use it. Only when the project has none does the
skill offer once to commit this file.

```markdown
## What

<!-- One to three sentences: what changed and why. -->

## How

<!-- The approach, in broad strokes. Reference the plan if there is one:
     docs/superpowers/plans/<file>.md -->

## Verification

<!-- The commands that were run and their result, plus any manual check.
     Fill from .agent-skills/config.json when the repo has one. -->

## Checklist

- [ ] `bun run build` (or the repo's build command) passes
- [ ] `bun run lint` (or the repo's lint command) passes
- [ ] Manual check: <!-- the specific steps for this change -->

Closes #<issue number>
```
