---
name: batch-features
description: Turn a pasted list of rough feature ideas into well-formed tracker issues, with a per-item debate before anything is filed. Use when the user hands over a batch of ideas, a backlog dump, a list of fixes, or says "file these as issues", "make tickets from this", "turn this list into issues", "batch these features", "create a backlog from this", "I have a list of things to do". Debates each item (restate, ask at most two questions with a proposed default, pin acceptance criteria), shows one review table for the whole batch, and only then files issues with labels. GitLab and GitHub.
---

# Batch features

Intake half of the workflow. The other half is `work-issue`.

You are not filing a backlog dump. You are turning rough ideas into issues an agent can plan
from without redoing your discovery. That means a debate per item, then one approval, then file.

**Announce at start:** "I'm using the batch-features skill to turn this list into issues."

## Setup

`shared/` is the directory next to this skill — `~/.agents/skills/shared/` when installed, or
`../shared/` in a checkout. If a `shared/...` path does not resolve, use the other one.

1. Read the repo: `AGENTS.md` (or `CLAUDE.md`) at the root. It is binding for conventions.
2. Read `.agent-skills/config.json` if it exists; otherwise read `shared/config.md`, ask the
   first-run questions, and write the file.
3. Read `shared/tracker-adapter.md`, `shared/labels.md`, and `shared/issue-template.md`.
4. Detect the tracker. Look at existing labels and issues so the new ones fit.
5. **Templates.** Check whether the project already has an issue template
   (`.gitlab/issue_templates/*.md`, `.github/ISSUE_TEMPLATE/*.md`). If it does, use it and record
   its path in config as `issueTemplate`. If it does not, note that you will offer once at the end
   to commit `shared/issue-template.md` into the project.

## The debate

Work through the list one item at a time. For each:

1. **Restate it** in your own words: what it is, who it serves, why now. Keep the original wording
   as a verbatim quote under **Intent** in the issue body — even when the rest is in English.
2. **Propose a concrete interpretation.** Not "what do you want here?" but "I read this as X,
   because Y. Say the word if you meant Z."
3. **Ask at most two questions.** Each must be specific, and each must carry a default the user
   can accept with one word. Ask the question whose answer would most change what gets built.
   If the user asked for a full grill, ask more; otherwise two.
4. **Pin two things:** acceptance criteria (each observable and checkable) and kind
   (`feature` / `fix` / `refactor` / `chore`). Nothing else — no size, no area, no dependencies.

If an item cannot be pinned after the debate, mark it `status::blocked` with a `needs spec` note
rather than guessing. Filing a vague issue is worse than not filing it.

Do not move to filing until every item has been debated.

## The review table

After the last item, present one table for the whole batch:

```markdown
| # | Title | Kind |
|---|-------|------|
| 1 | ...   | feature |
```

Then ask for approval. The user may edit titles, drop items, or change kinds. Nothing is filed
before this approval.

## File the issues

For each approved item, in the order the user prefers (creation order by default):

1. Create the issue with the tracker CLI, body from the project's template if it has one, else
   from `shared/issue-template.md`. Titles and bodies in the config's `language` (default `en`).
2. Apply labels: `status::ready` and `kind::<kind>`. Record the issue number.
3. Report the issue URLs.

If the user's list implied an ordering ("X puis Y"), note it in the issue body under **Notes** —
do not create a dependency relation or label.

If the project has no issue template and the user accepted your offer, commit
`shared/issue-template.md` to the tracker's expected path once, then file. Do not create it
silently.

## Report

At the end, print:

- The issue URLs, one line each.
- The batch summary: N filed, M blocked.
- One line: "To start work, say `work-issue <n>`."

## Hard gates

- No issue is created without the review-table approval.
- No issue is created with an empty **Acceptance criteria** or **Verification** section.
- No issue is created with a guessed scope: if it is vague after the debate, it is `status::blocked`.
- Never claim an issue or start implementation from this skill; that is `work-issue`.
