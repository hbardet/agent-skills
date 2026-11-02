# Batch feature → issue → implementation workflow

**Date:** 2026-11-02
**Status:** approved
**Repo:** `github.com/hbardet/agent-skills` (public, MIT)
**Skill home:** `skills/batch-features/` and `skills/work-issue/`, symlinked into `~/.agents/skills/<name>/` per machine. `shared/` is also symlinked into `~/.agents/skills/shared/`.

---

## Intent

You run your dev workflow through `obra/superpowers` skills, which already cover the back half
(planning, executing, reviewing, finishing a branch). What is missing is the two ends:

1. **Intake** — you have a list of rough feature ideas (in the project's native language, e.g.
   French) and you want each one debated with an agent until it becomes a well-formed issue on
   your tracker. You explicitly want the debate: restate the intent, surface the hidden decisions,
   ask the right questions, then pin acceptance criteria.
2. **Pickup** — later, another agent starts from an issue, plans it, implements it, and closes it
   with a merge request.

The goal is "a little more" on top of superpowers, not a fork. No superpowers skill is modified.

A second goal shapes the whole design: **the spec and the plan do not live in the project repo.**
They live where you can edit them from the web — the tracker. The repo gets code and the MR.

## Goals

- A skill that turns a pasted list of rough ideas into a set of well-formed tracker issues.
- A skill that takes an issue number and carries it to a merge request.
- Specs and plans are editable in the tracker's web UI and never committed to the project repo.
- Portable across projects: tracker, labels, language, and verification commands are configured per
  repo, discovered automatically where possible.
- Explicit `REQUIRED SUB-SKILL` chains so the agent uses superpowers' plan/execute/review/finish
  flow unchanged instead of improvising.

## Non-goals

- Running unattended (no poller, no CI job, no daemon). A human invokes a skill.
- A web UI, dashboard, or long-lived state database of our own.
- Replacing or rewriting any superpowers skill.
- Automatic merging, pushing to protected branches, or closing issues without a human review.
- Putting specs, plans, ledgers, or templates inside the project repo.

## Anti-goals

- Filing issues that are vague enough that the pickup agent has to redo the discovery.
- A plan that assumes a test runner exists when the repo has none.
- Silently filing issues without an explicit human approval of the batch.
- Two sources of truth for the spec or the plan that can drift.
- Unattended loops that keep claiming work (this is a skill, not a scheduler).

## Constraints

- Superpowers skills stay untouched; we only call them.
- Tracker adapter supports GitLab (`glab`) and GitHub (`gh`) — detected from `git remote -v`.
- Every repo has its own conventions; read `AGENTS.md` (or `CLAUDE.md`) at the repo root before
  planning, and treat it as binding for commands and gotchas.
- Repos may have no test runner. "Verified" must be defined per repo, not assumed.
- Repos may already have their own issue and MR templates; those win over ours.
- superpowers' scripts take a **file path** for the plan. A disposable local copy outside the repo
  is therefore unavoidable; it is scratch, never committed.

## Approaches considered

**A. Two thin portable skills + conventions (chosen).**
`batch-features` for intake, `work-issue` for pickup, sharing an issue template, a label
convention, a tracker adapter, and a per-repo config file. Both are model-invocable (their
descriptions fire when the user says "file these as issues" or "work on #12"). Everything else is
delegated to superpowers.

**B. One skill with two modes.** Fewer files, but the description must name both intents, the
trigger gets muddy, and one mode's context pollutes the other. Rejected.

**C. Prompt/command templates only (no SKILL.md).** Lightest to write, but behavior drifts between
sessions and nothing guarantees the chain into `writing-plans` / `executing-plans`. Rejected.

**D. Unattended poller / CI job that watches labels.** Real autonomy, but needs a runner, token
management, and monitoring; explicitly out of scope ("a little more"). Rejected.

**E. Notion as the spec/plan home.** Considered seriously (the user proposed it). Rejected in favor
of the tracker: the tracker already gives web-editable + not-in-repo, and it is already the system
of record this workflow starts from. Notion would add an integration token, an MCP server, and a
sync rule against the local script copy. Revisit if the user wants Notion's extra structure.

## Parts of the how, as decided

### Where the spec and plan live

| Artifact | Home | Local copy |
|---|---|---|
| Spec | the tracker **issue body** | none — read it from the tracker |
| Plan | a **comment on the issue** (and the MR description at the end) | `~/.agent-skills/state/<owner>/<repo>/plans/YYYY-MM-DD-<slug>.md`, disposable, outside any repo |
| Ledger, briefs, review packages | superpowers' own scratch | `<repo>/.superpowers/sdd/<plan-basename>/`, gitignored, disposable |

The plan's header references the spec as the **tracker issue** (number + URL), not a file path.
`writing-plans` allows this: "User preferences for plan location override this default."

The local plan copy exists only because `scripts/task-start PLAN_FILE N`, `task-done`, and
`review-package` require a path. It is never committed and never the source of truth. Rule: the
agent re-reads the issue comment before each task and writes the updated plan back after.

### Shared pieces (prose, not executables)

`shared/` holds five prose files the agent **reads** — there is no adapter binary, no CLI, no
script. The agent interprets them with its own tools (`glab`, `gh`, `git`, `read`).

| File | What it is |
|---|---|
| `shared/tracker-adapter.md` | Detect GitLab vs GitHub; the exact `glab`/`gh` commands for reading, filing, labeling, commenting, and opening MRs/PRs. |
| `shared/issue-template.md` | The section structure for an issue body. |
| `shared/mr-template.md` | The section structure for an MR/PR body. |
| `shared/labels.md` | The label vocabulary and the "create if missing" behavior. |
| `shared/config.md` | The `.agent-skills/config.json` schema and the first-run questions. |

`shared/` is symlinked into `~/.agents/skills/shared/`. Skills reference it as `shared/...` and
say so explicitly (`~/.agents/skills/shared/` when installed, `../shared/` in a checkout) — a bare
`../shared/` does not resolve through a symlinked skill directory, because the kernel resolves
`..` against the symlink target.

### Conventions

- **Issue template.** If the project already has an issue template
  (`.gitlab/issue_templates/*.md`, `.github/ISSUE_TEMPLATE/*.md`), **use it** — our section
  structure is only a fallback. If it has none, the skill offers once to commit
  `shared/issue-template.md` into the project at the tracker's expected path. Same rule for
  MR/PR templates: use the project's if present, otherwise commit ours (`shared/mr-template.md`).
- **Labels** (created on first run if missing):
  - `status::ready`, `status::blocked`, `status::in-progress`, `status::done`
  - `kind::feature`, `kind::fix`, `kind::refactor`, `kind::chore`

  No size, no area, no dependency labels. Size and area were dropped at the user's request;
  `status::blocked` remains for manual marking.
- **Per-repo config** `.agent-skills/config.json` (gitignored by default; committed if the user
  wants to share it). Holds: tracker, default branch, label vocabulary, language, verification
  commands, plan/branch conventions, and the local state directory. Created on first run by asking
  the user once, then reused.
- **Language.** Issue titles and bodies are written in **English**, regardless of the language of
  the pasted list. The original wording is preserved verbatim as a quote under **Intent**, so the
  source idea is never lost. The config key `language` (default `en`) records this and can be
  changed per repo.
- **Branch naming** `<prefix>/<iid>-<slug>` (`feat/`, `fix/`, `chore/` from config).

### Skill 1: `batch-features`

**Trigger:** user pastes a list of rough features/ideas and says something like "file these",
"make issues from this", "turn this list into tickets", "batch these".

**Flow:**

1. **Read the repo.** Read `AGENTS.md`, detect the tracker, load `.agent-skills/config.json`
   (create it on first run), and look at existing labels/issues and the project's issue template
   so the new ones fit.
2. **Debate item by item** (the core of the skill):
   - Restate the item in your own words → what it is, who it serves, why now.
   - Propose a concrete interpretation rather than an open question.
   - Ask **at most 2 questions** per item (the user's choice; can be raised to a full grill).
     Questions must be specific and Socratic, each with a suggested default the user can accept.
   - Pin: **acceptance criteria** (each observable and checkable) and **kind**
     (feature/fix/refactor/chore). Nothing else — no size, no area, no dependencies.
3. **Present one review table** for the whole batch: item → title → kind. The user approves or
   edits. Nothing is filed before this approval.
4. **File issues** with the tracker CLI, in the order the user prefers (creation order by
   default). Each body follows the project's template if it has one, otherwise ours. Apply labels
   (`status::ready` + `kind::`). The body carries Intent, Scope, Acceptance criteria, Out of scope,
   Verification, Notes.
5. **Report** the issue URLs and a short summary.

**Hard gates:** no issue is created without batch approval. If an item is too vague to plan from
after the debate, it is filed with `status::blocked` and a `needs spec` note rather than guessed.

**Consequence of dropping size/area/deps:** `work-issue`'s "what should I do next" mode has no
size or dependency signal to order by, so it lists `status::ready` issues in creation order and
lets the user pick. If the user's list implies an ordering ("X puis Y"), the skill may note it in
the issue body under **Notes**, but it does not create a dependency relation.

### Skill 2: `work-issue`

**Trigger:** user says "work on #12", "pick the next ticket", "implement issue N".

**Flow:**

1. **Read the issue.** If the spec is thin (no acceptance criteria, no intent), stop and ask the
   user — do not silently invent scope.
2. **Claim it.** Set `status::in-progress`; assign it to the current user if the tracker supports
   it. Refuse if it already has `status::in-progress`.
3. **Check dependencies.** With no dependency labels, "blocked" is manual: read the issue body for
   a **Notes** line saying it waits on another issue. If it does and that issue is not done,
   refuse or switch to another ticket.
4. **Isolate.** Invoke `superpowers:using-git-worktrees` to create a worktree and branch
   `<prefix>/<iid>-<slug>`.
5. **Plan.** Invoke `superpowers:writing-plans` with the **issue as the Spec**. Because the spec
   is a tracker issue and not a file, the agent:
   - writes the plan to `~/.agent-skills/state/<owner>/<repo>/plans/YYYY-MM-DD-<slug>.md`
     (disposable, outside the repo) so the superpowers scripts have a path;
   - posts the same plan as a **comment on the issue** (web-editable, the human-facing copy);
   - the plan header references the spec as `GitLab issue #<n>` / `GitHub issue #<n>` (number + URL).
6. **Verification override.** If the repo has a test runner, the plan uses it normally. If it does
   not, the plan's verification steps are the config's `verification.commands` plus the manual
   check from config — never a test framework that does not exist, and never a bare "verify it
   works". The agent writes the plan, so the plan itself carries the right commands;
   `executing-plans` then follows them literally.
7. **Execute.** Invoke `superpowers:executing-plans` (default). If the harness has a
   subagent tool and the user wants per-task review, invoke
   `superpowers:subagent-driven-development` instead; if there is no subagent tool, inline is the
   only option (this matches `executing-plans`' own rule).
   Before each task, re-read the plan comment on the issue (the human may have edited it); after
   each task, write the updated plan back to the comment.
8. **Review and finish.** `executing-plans` already performs the final whole-branch review and
   calls `superpowers:finishing-a-development-branch`. `work-issue` does **not** re-run them — it picks up
   where `executing-plans` left off. The MR body includes `Closes #<n>` (both trackers auto-close
   on merge), and the skill comments on the issue with the MR link and a summary.
9. **Report.** MR link, issue state, rulings, deferred minors.

**"Next ticket" mode:** list issues with `status::ready`, in creation order, and propose the top
pick with one sentence on why. The user confirms before work starts.

### What's left to the builder (the agent)

- The exact wording of each issue (the skill gives the template and the debate, not the prose).
- The exact plan tasks and code (superpowers owns that).
- Whether to use inline or subagent-driven execution (the skill asks, defaulting to inline).
- The first-run config values (the skill asks the user once, then remembers).

---

## Builder-check results

A fresh worker subagent read an earlier revision of this document and reported 8 findings. Two
were answered by the user; the rest were settled here.

| # | Finding | Disposition |
|---|---|---|
| 1 | Tracker adapter form and shared file locations unspecified | **Settled:** prose recipes the agent reads, not executables; `shared/` at repo root, symlinked into `~/.agents/skills/shared/`. |
| 2 | Language handling undefined | **Settled with the user:** English titles/bodies, `language` config key defaulting to `en`, original wording quoted verbatim under **Intent**. |
| 3 | Whether `batch-features` writes an issue template into the target repo | **Settled with the user:** use the project's existing template if it has one; if none, offer once to commit ours. Same rule for MR/PR templates. |
| 4 | How a tracker issue is fed to `writing-plans` as the "Spec" | **Settled with the user:** it is not a local file. The spec stays in the issue body; the plan is a comment on the issue; the local copy lives outside the repo at `~/.agent-skills/state/...`. |
| 5 | Whether a subagent tool exists in the target environment | **Settled:** instructions are conditional — offer `subagent-driven-development` when a subagent tool exists, otherwise inline. |
| 6 | Whether `work-issue` re-invokes review and finish, or defers to `executing-plans` | **Settled:** defer. `executing-plans` already does the final review and calls `finishing-a-development-branch`. |
| 7 | How the config's verification command overrides superpowers' hardcoded test commands | **Settled:** the plan's verification steps are written with the config's commands (or the manual check) when there is no test runner; `executing-plans` follows the plan literally. |
| 8 | What `spec` in the config means | **Settled:** there is no `spec.dir` anymore — the spec is the issue body. The config keeps `plansDir` (local disposable copy) and `stateDir`. |

## Open questions

None.
