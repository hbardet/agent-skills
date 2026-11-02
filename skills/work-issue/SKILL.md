---
name: work-issue
description: Take a tracker issue from "ready" to a merge request: read the issue, claim it, isolate a worktree, write the implementation plan with superpowers:writing-plans, execute it with superpowers:executing-plans, review it, and open an MR that closes the issue. Use when the user says "work on #12", "implement issue N", "pick the next ticket", "what should I do next", "take this issue", "start on this", "build the next ready issue", or points at a tracker issue and asks for it to be done. GitLab and GitHub.
---

# Work issue

Pickup half of the workflow. The other half is `batch-features`.

The plan and the code are superpowers' job. Your job is the wrapper: claim the issue, isolate the
work, invoke the right superpowers skill in the right order, and close the loop with an MR.

**Announce at start:** "I'm using the work-issue skill to carry #<n> to an MR."

## Setup

`shared/` is the directory next to this skill — `~/.agents/skills/shared/` when installed, or
`../shared/` in a checkout. If a `shared/...` path does not resolve, use the other one.

1. Read `.agent-skills/config.json` if it exists; otherwise read `shared/config.md`, ask the
   first-run questions, and write it.
2. Read `shared/tracker-adapter.md`, `shared/labels.md`, and `shared/mr-template.md`.
3. Read the repo's `AGENTS.md` (or `CLAUDE.md`). It is binding for commands and gotchas.

## 1. Read the issue

`glab issue view <n>` or `gh issue view <n>`. If the issue has no acceptance criteria, no intent,
or no verification section, stop and ask the user. Do not invent scope. If the user wants to,
they can run `batch-features` on the missing parts first.

## 2. Claim it

- Set `status::in-progress`.
- Assign it to the current user if the tracker supports it.
- Refuse if it already has `status::in-progress` (someone else is on it).

## 3. Check dependencies

Read `Depends on #n` lines. If any dependency is not `status::done` (or closed), refuse and propose
a different ticket. Never start on a blocked issue.

## 4. Materialize the spec

`writing-plans` requires a spec path on disk and says executors read both spec and plan. The
tracker issue is not a local file, so write the issue body to
`<spec.dir>/YYYY-MM-DD-<slug>-spec.md` (default `docs/superpowers/specs/`). This is the only file
this skill writes outside the worktree. Do not put it in the worktree — the spec outlives the
branch.

## 5. Isolate

**REQUIRED SUB-SKILL:** `superpowers:using-git-worktrees` — create a worktree and branch
`<prefix>/<iid>-<slug>` (`feat/`, `fix/`, `chore/` from config). Never start on the default branch.

## 6. Plan

**REQUIRED SUB-SKILL:** `superpowers:writing-plans` — the materialized spec file is the **Spec**.
Save the plan to `<plansDir>/YYYY-MM-DD-<slug>.md`.

**Verification override.** If the repo has a test runner (`verification.hasTestRunner`), the plan
uses it normally. If it does not, the plan's verification steps are the config's
`verification.commands` plus the `verification.manual` check — never a test framework that does
not exist, and never a bare "verify it works". You are writing the plan, so the plan itself carries
the right commands; `executing-plans` then follows them literally. Say so in the plan header.

Ask the user to review the plan and choose an execution method, as `writing-plans` requires.

## 7. Execute

**REQUIRED SUB-SKILL:** `superpowers:executing-plans` (default). If the harness has a
subagent tool and the user wants per-task review, use
`superpowers:subagent-driven-development` instead; if there is no subagent tool, inline is the
only option.

Follow the plan task by task. If a step is wrong, rule and ledger it; do not silently deviate.

## 8. Review and finish

`executing-plans` already performs the final whole-branch review and calls
`superpowers:finishing-a-development-branch`. **Do not re-run them.** Pick up where `executing-plans` left
off: open the MR with `superpowers:finishing-a-development-branch`'s guidance.

- Use the project's MR/PR template if it has one, else `shared/mr-template.md`.
- The MR body includes `Closes #<n>` (both trackers auto-close on merge).
- Comment on the issue with the MR link and a short summary.

## 9. Report

Print:

- The MR link.
- The issue state (`status::in-progress` until merge; do not flip to `status::done` yourself).
- The rulings you made, and any deferred minors.
- One line: "Merge the MR when you're ready; the issue closes automatically."

## Next-ticket mode

When the user asks "what should I work on next":

1. List issues with `status::ready`.
2. Drop any with unmet dependencies.
3. Order by dependencies-then-size.
4. Propose the top pick with one sentence on why.
5. Wait for the user to confirm, then run this skill on it.

## Hard gates

- Never start on an issue whose spec is thin without asking.
- Never start on a blocked issue.
- Never push to the default branch.
- Never merge or close without the user's explicit go-ahead.
- Never skip the final whole-branch review (it belongs to `executing-plans`; do not replace it).
