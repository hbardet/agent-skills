# Issue template

**This is a fallback.** If the project already has an issue template
(`.gitlab/issue_templates/*.md` or `.github/ISSUE_TEMPLATE/*.md`, recorded in
`.agent-skills/config.json` as `issueTemplate`), use that instead — the project's template wins.
Only when the project has none does the skill offer once to commit this file into the project.

Copy this into `.gitlab/issue_templates/feature.md` (GitLab) or `.github/ISSUE_TEMPLATE/feature.md`
(GitHub) when the repo has none. Both skills fill the same sections when filing.

Titles and bodies are written in the config's `language` (default `en`). The original wording of
a pasted idea is preserved verbatim as a quote under **Intent**, whatever the language.

```markdown
## Intent

<!-- What this is, who it serves, and why now. One to three sentences.
     Keep the original wording of the request in a quote when the idea
     came from a list. -->

## Scope

<!-- What is in scope. Bullet list of the concrete pieces. -->

## Acceptance criteria

- [ ] <!-- observable, checkable behavior; one per criterion -->
- [ ]

## Out of scope

<!-- What this deliberately does not do, so a plan does not drift into it. -->

## Dependencies

<!-- "Depends on #n" for each blocker. Write the issue number, not only the
     native tracker relation. -->

## Verification

<!-- The commands / checks that prove this works. Filled from
     .agent-skills/config.json when the repo has one; otherwise the
     repo's AGENTS.md conventions. Examples:
       - `bun run build`
       - `bun run lint`
       - manual browser check with agent-browser: <specific steps>
     Never leave this empty; if the repo has no test runner, say what
     manual verification replaces it. -->

## Notes

<!-- Anything else: prior art, constraints, links, screenshots. -->
```
