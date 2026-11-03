---
name: |-
  work-issue
description: |-
  Implement one tracker issue end to end — read and claim the issue, plan it, build it, review it, and open a merge request. Use when the user says "work on #12", "implement issue 12", "pick the next ticket", "what should I do next", "take this one", or pastes an issue number or URL. Delegates planning to superpowers:writing-plans, execution to superpowers:executing-plans (or subagent-driven-development when a subagent tool exists), and review and branch finishing to executing-plans. GitLab and GitHub. The spec is the issue body; the plan is a comment on the issue.
notion_page_id: 40d901c1-90a1-810d-a65a-d63c9f7e592b
---

Pickup half of the workflow. The other half is `batch-features`.

The spec and the plan never live in the project repo. The spec is the **issue body**. The plan is a **comment on the issue** (web-editable) plus a **disposable local copy outside the repo** that superpowers' scripts can read. The repo gets code and the MR.

**Announce at start:** "I'm using the work-issue skill."

## Setup

`shared/` is the directory next to this skill — `~/.agents/skills/shared/` when installed, or `../shared/` in a checkout. If a `shared/...` path does not resolve, use the other one.

1. Read `.agent-skills/config.json`. If it is missing, say so and point at `shared/config.md`. Do not guess values.
2. Read `shared/tracker-adapter.md` and `shared/labels.md`.
3. Detect the tracker and get the issue body with the CLI. Do not invent scope — the issue is the spec, verbatim.

## Before you plan

**Reject thin specs.** If the issue has no acceptance criteria, no stated intent, or no verification path, stop and ask the user before doing anything. Do not file anything back to the tracker; the tracker is read-only from this skill. Fixing the spec is the user's call, not yours.

**Claim the issue.** Set `status::in-progress` and assign it to the current user if the tracker supports it. Refuse if the issue already has `status::in-progress`.

**Check dependencies.** There are no dependency labels. Read the issue body for a **Notes** line saying it waits on another issue; if it does and that issue is not done, refuse or switch to another ticket. Never silently work a blocked issue.

## Branch and worktree

Invoke `superpowers:using-git-worktrees` to create an isolated worktree and a branch named `<prefix>/<iid>-<slug>` per the config (for example `feat/12-<slug>`). If the user prefers to work in place, skip the worktree but still create the branch.

## Plan

Invoke `superpowers:writing-plans` with **the issue as the Spec**. Because the spec is a tracker issue and not a file, do the following, in this order:

1. Write the plan to the disposable local copy: `~/.agent-skills/state/<owner>/<repo>/plans/YYYY-MM-DD-<slug>.md` (`stateDir` from config; outside the repo, never committed).
2. Post the same plan as a **comment on the issue** — this is the web-editable copy.
3. The plan header must reference the spec as `GitLab issue #<n>` / `GitHub issue #<n>` plus its URL, **not** a file path. `writing-plans` allows this: "User preferences for plan location override this default."

**Verification override.** Read `AGENTS.md` and the config. If the repo has a test runner, the plan uses it normally. If it does not, the plan's **Verification** section is the config's `verification.commands` plus the manual check from config — never a test framework that does not exist, and never a bare "verify it works". You write the plan, so the plan itself carries the right commands; `executing-plans` then follows it literally.

## Execute

Invoke `superpowers:executing-plans` with the disposable local plan path. That skill drives task execution and ends with the final whole-branch review and `superpowers:finishing-a-development-branch` — so this skill does **not** re-run them; it picks up where `executing-plans` left off.

If the harness has a subagent tool and the user wants per-task review, invoke `superpowers:subagent-driven-development` instead. If there is no subagent tool, inline is the only option — that matches `executing-plans`' own rule.

**Sync the plan back.** Before each task, re-read the plan comment on the issue — the user may have edited it in the tracker. After each task, write the updated plan back to that comment. If the comment changed and the local copy disagrees, follow the comment.

## Finish

The MR/PR body is the project's template if it has one, otherwise `shared/mr-template.md`, and carries the final plan at the end. It links the issue with `Closes #<n>` (both trackers auto-close on merge) and lists the deferred minors. Then:

1. Comment on the issue with the MR link and a short summary.
2. Set `status::done`.
3. Report the MR link, the issue state, and the rulings.

## Next ticket mode

When the user says "what should I do next" or "pick the next ticket": list issues with `status::ready` in creation order, propose the top pick with one sentence on why, and wait for confirmation. There is no size or dependency label to order by, so the list is creation order and the user chooses.

## Hard gates

- No branch, commit, or MR without a plan that has **Acceptance criteria** and **Verification**.
- Never use a test framework the repo does not have.
- Never close an issue without a human-reviewed MR.
- Never work an issue that is already `status::in-progress`.
- Never write the plan or the spec into the project repo.
- Never silently invent scope: if the issue is thin, stop and ask.
