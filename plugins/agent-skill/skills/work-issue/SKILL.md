---
name: |-
  work-issue
description: |-
  Implement one tracker issue end to end — read and claim the issue, fetch its spec and plan documents, build it, review it, and open a merge request. Use when the user says "work on #12", "implement issue 12", "pick the next ticket", "what should I do next", "take this one", or pastes an issue number or URL. Delegates planning to superpowers:writing-plans only when the issue has no plan yet, execution to superpowers:executing-plans (or subagent-driven-development when a subagent tool exists), and review and branch finishing to executing-plans. GitLab and GitHub. The spec and the plan are documents attached to the issue, never files in the repo.
notion_page_id: 40d901c1-90a1-810d-a65a-d63c9f7e592b
---

# Work issue

Pickup half of the workflow. The other half is `batch-features`.

The spec and the plan never live in the project repo. The issue carries both: the body is a short description from the project's issue template, and the **spec** and the **plan** are documents attached to the issue — a GitHub artifact, a marker comment on GitLab — each with a **disposable local copy outside the repo** that superpowers' scripts can read. The repo gets code and the MR.

**Announce at start:** "I'm using the work-issue skill."

## Setup

`shared/` is the directory next to this skill — `~/.agents/skills/shared/` when installed, or `../shared/` in a checkout. If a `shared/...` path does not resolve, use the other one.

1. Read `.agent-skills/config.json`. If it is missing, say so and point at `shared/config.md`. Do not guess values.
2. Read `shared/tracker-adapter.md` and `shared/labels.md`.
3. Detect the tracker and read the issue: the body, and its spec document. Do not invent scope — the spec document is the spec, verbatim. Commands are in `shared/tracker-adapter.md`. No spec document means the work never went through `brainstorming`: say so and stop.

## Before you work

**Reject thin specs.** If the spec document has no acceptance criteria, no stated intent, or no verification path, stop and ask the user before doing anything. A thin spec goes back through `superpowers:brainstorming`; rewriting it here is your call to make only if the user asks.

**Claim the issue.** Set `status::in-progress` and assign it to the current user if the tracker supports it. Refuse if the issue already has `status::in-progress`.

**Check dependencies.** There are no dependency labels. Read the issue body for a **Notes** line saying it waits on another issue; if it does and that issue is not done, refuse or switch to another ticket. Never silently work a blocked issue.

## Branch and worktree

Invoke `superpowers:using-git-worktrees` to create an isolated worktree and a branch named `<prefix>/<iid>-<slug>` per the config (for example `feat/12-<slug>`). If the user prefers to work in place, skip the worktree but still create the branch.

## Plan

The plan is a **document on the issue**, written by `superpowers:writing-plans` — not by this skill, and not in the repo. Look for it before writing anything: the artifact with `--type plan` on GitHub (`gh issue artifact list <n> --json number,title,type`), or the note whose first line is `<!-- agent-skills:plan -->` on GitLab.

- **No plan document yet** — invoke `superpowers:writing-plans` with the issue and its spec document as the spec. It attaches the plan as the issue's plan document and writes the disposable local copy at `~/.agent-skills/state/<owner>/<repo>/plans/YYYY-MM-DD-<slug>.md` (`plansDir` from config). Do not draft a plan yourself here: there is one plan, and it lives on the issue.
- **Plan document already there** — save it to that same local path and go straight to execution. The user may have edited it in the tracker, so the tracker copy is the source of truth.

**Verification override.** Read `AGENTS.md` and the config. If the repo has a test runner, the plan uses it normally. If it does not, the plan's **Verification** section is the config's `verification.commands` plus the manual check from config — never a test framework that does not exist, and never a bare "verify it works". The plan carries those commands, which is why it is written from the spec and not improvised at execution time; `executing-plans` follows it literally.

## Execute

Invoke `superpowers:executing-plans` with the disposable local plan path. That skill drives task execution and ends with the final whole-branch review and `superpowers:finishing-a-development-branch` — so this skill does **not** re-run them; it picks up where `executing-plans` left off.

If the harness has a subagent tool and the user wants per-task review, invoke `superpowers:subagent-driven-development` instead. If there is no subagent tool, inline is the only option — that matches `executing-plans`' own rule.

**Sync the plan back.** Before each task, re-read the plan document — the user may have edited it in the tracker (`gh issue artifact view <n> <artifact#>` on GitHub, the marker note on GitLab). After each task, write the updated plan back, which keeps its version history: `gh issue artifact edit <n> <artifact#> --body-file <path>` on GitHub, `glab api "projects/:id/issues/<iid>/notes/<note_id>" -X PUT -F "body=@<path>"` on GitLab. If the tracker copy changed and the local copy disagrees, follow the tracker.

## Finish

The MR/PR body is the project's template if it has one, otherwise `shared/mr-template.md`, and links the issue's plan document at the end. It links the issue with `Closes #<n>` (both trackers auto-close on merge) and lists the deferred minors. Then:

1. Comment on the issue with the MR link and a short summary.
2. Set `status::done`.
3. Report the MR link, the issue state, and the rulings.

## Next ticket mode

When the user says "what should I do next" or "pick the next ticket": list issues with `status::ready` in creation order, propose the top pick with one sentence on why, and wait for confirmation. There is no size or dependency label to order by, so the list is creation order and the user chooses.

## Hard gates

- No branch, commit, or MR without a **plan document on the issue** that has **Acceptance criteria** and **Verification**.
- Never use a test framework the repo does not have.
- Never close an issue without a human-reviewed MR.
- Never work an issue that is already `status::in-progress`.
- Never write the plan or the spec into the project repo.
- Never silently invent scope: if the issue is thin, stop and ask.
