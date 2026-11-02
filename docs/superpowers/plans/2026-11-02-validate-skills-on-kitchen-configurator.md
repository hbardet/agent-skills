# Validate batch-features and work-issue on the kitchen configurator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the two new skills work end to end on a real project — file real GitLab issues from a real feature list, then take the smallest one to a real merge request.

**Architecture:** Run `batch-features` against `gitlab.com/hbardet-work/poc-kitchen-configurator` with a real list, then run `work-issue` on the smallest filed issue. Everything the skills write goes to GitLab (issues, labels, comments) or to the disposable state dir under `~/.agent-skills/state/`; the only thing that lands in the project repo is code and the MR. Defects found during the run are fixed in `/home/hugo/work/agent-skills` and the affected step is re-run.

**Tech Stack:** `batch-features` and `work-issue` skills (markdown interpreted by the agent), `glab` CLI, GitLab issues/labels/MRs, `bun run build` for verification, `obra/superpowers` for planning and execution.

**Spec:** specs/2026-11-02-batch-issue-workflow-design.md

## Global Constraints

- Target repo `/home/hugo/work/poc-kitchen-configurator`; GitLab `gitlab.com/hbardet-work/poc-kitchen-configurator`; default branch `main`; remote `git@gitlab.com:hbardet-work/poc-kitchen-configurator.git`; current HEAD `73fb910`.
- `AGENTS.md` lives at `client/web/AGENTS.md`, **not** the repo root. Read it before planning; it is binding.
- No test runner exists. Verification is `bun run build` (and `bun run lint`). Never invent a test framework.
- French conventional commits: `feat(web):`, `fix(cube):`.
- Labels are exactly `status::{ready,blocked,in-progress,done}` and `kind::{feature,fix,refactor,chore}`.
- Issue titles and bodies in English; the original French wording is quoted verbatim under **Intent**.
- The spec and the plan never enter the project repo: spec = issue body, plan = issue comment plus `~/.agent-skills/state/hbardet-work/poc-kitchen-configurator/plans/`.
- Skills live in `/home/hugo/work/agent-skills`, symlinked from `~/.agents/skills/`.
- `glab` is authenticated as `hbardet-dev`; the project is in the `hbardet-work` group.

## Review Focus

- **`AGENTS.md` was not at the repo root.** Task 1 adds one. Expected: both skills read it and follow its pointer to `client/web/AGENTS.md`. Owner: Task 4.
- **No issue or MR template exists.** Expected: the skill offers once to commit `shared/issue-template.md` / `shared/mr-template.md` instead of silently filing a bare body. Owner: Task 2.
- **No test runner.** Expected: the plan's Verification section says `bun run build`, never "run the tests". Owner: Task 3.
- **`hbardet-dev` may lack permission** to create labels or issues in `hbardet-work/poc-kitchen-configurator`. Expected: a clear permission error, not a silent skip. Owner: Task 1.
- **The MR must not be merged by the skill.** Expected: the skill stops at "MR opened, awaiting review". Owner: Task 3.

---

### Task 1: Repo setup — root AGENTS.md, config, labels

**Files:**
- Create: `/home/hugo/work/poc-kitchen-configurator/AGENTS.md`
- Create: `/home/hugo/work/poc-kitchen-configurator/.agent-skills/config.json`
- Modify: `/home/hugo/work/poc-kitchen-configurator/.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: a root `AGENTS.md` that explains the repo and points to `client/web/AGENTS.md`; `.agent-skills/config.json` holding `tracker`, `defaultBranch`, `labels`, `verification`, `stateDir`, `plansDir`, `language`, `branchPrefix`, `issueTemplate`, `mrTemplate`; and 8 GitLab labels.

- [ ] **Step 1: Create the root `AGENTS.md`**

The repo root has no `AGENTS.md` today (the only one is `client/web/AGENTS.md`), so both skills
would miss the project conventions. Create `/home/hugo/work/poc-kitchen-configurator/AGENTS.md`
with these sections:

- **Layout** — `client/web` is the app (React 19 + TS 5.7 + Vite 6 + Tailwind 4); `admin` is an
  empty placeholder (`.gitkeep` only). Include the source tree and a table of the UI panel
  directories under `client/web/src/components/UI/`.
- **Commands** — run from `client/web` with **bun**: `bun dev`, `bun run build`, `bun run lint`,
  `bun run preview`. State that no test runner exists and that `bun run build` must run before
  pushing.
- **Rules** — never commit to `main`; French conventional commits; dimensions live in
  `ModuleSelectorPart/modules.json` (43 entries, `widthCm`/`heightCm`/`depthCm`, cm → m in
  `Scene.tsx`); strings go through `t()`; prices go through `formatPrice(value, lang)`.
- **CI** — `.gitlab-ci.yml` runs SAST + secret detection only.
- **Adding a new top-level part** — follow the `admin/` pattern.

The file must state that `client/web/AGENTS.md` is binding for anything inside `client/web`.

- [ ] **Step 2: Ignore the config directory**

Append to `.gitignore`:

```
# agent-skills per-repo config
.agent-skills/
```

- [ ] **Step 3: Verify the ignore**

Run: `cd /home/hugo/work/poc-kitchen-configurator && git check-ignore -v .agent-skills/config.json`
Expected: `.gitignore:<line>:.agent-skills/	.agent-skills/config.json`

- [ ] **Step 4: Write the config**

Create `.agent-skills/config.json`:

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
  "stateDir": "~/.agent-skills/state/hbardet-work/poc-kitchen-configurator",
  "plansDir": "~/.agent-skills/state/hbardet-work/poc-kitchen-configurator/plans",
  "language": "en",
  "branchPrefix": "feat",
  "issueTemplate": null,
  "mrTemplate": null
}
```

- [ ] **Step 5: Validate the JSON**

Run: `python3 -m json.tool /home/hugo/work/poc-kitchen-configurator/.agent-skills/config.json > /dev/null && echo OK`
Expected: `OK`

- [ ] **Step 6: Create the 8 labels on GitLab**

```bash
cd /home/hugo/work/poc-kitchen-configurator
for l in status::ready status::blocked status::in-progress status::done \
         kind::feature kind::fix kind::refactor kind::chore; do
  glab label create -n "$l" -c "#428BCA" -R gitlab.com/hbardet-work/poc-kitchen-configurator
done
```

- [ ] **Step 7: Verify the labels**

Run: `glab label list -R gitlab.com/hbardet-work/poc-kitchen-configurator`
Expected: 8 labels, each appearing exactly once.

- [ ] **Step 8: Commit**

```bash
cd /home/hugo/work/poc-kitchen-configurator
git checkout -b docs/root-agents-md
git add AGENTS.md .gitignore
git commit -m "docs: add root AGENTS.md and ignore .agent-skills"
```

---

### Task 2: batch-features on a real list

**Files:**
- Create: the GitLab issues on `gitlab.com/hbardet-work/poc-kitchen-configurator`
- Create (only if the user accepts): `.gitlab/issue_templates/feature.md`

**Interfaces:**
- Consumes: Task 1's config and labels.
- Produces: issues carrying `status::ready` + `kind::<kind>`, English titles, and the original French wording quoted under **Intent**.

- [ ] **Step 1: Announce and set up**

Say "I'm using the batch-features skill to turn this list into issues." Then read `client/web/AGENTS.md`, `.agent-skills/config.json`, `~/.agents/skills/shared/tracker-adapter.md`, `~/.agents/skills/shared/labels.md`, and `~/.agents/skills/shared/issue-template.md`.

- [ ] **Step 2: Confirm there is no project issue template**

Run: `ls -d /home/hugo/work/poc-kitchen-configurator/.gitlab/issue_templates /home/hugo/work/poc-kitchen-configurator/.github/ISSUE_TEMPLATE 2>/dev/null || echo "none"`
Expected: `none` → offer once to commit `shared/issue-template.md` to `.gitlab/issue_templates/feature.md`. Record the answer in config as `issueTemplate`.

- [ ] **Step 3: Debate each item**

For each item in the list the user pastes: restate it, propose a concrete interpretation, ask at most two questions each with a default, and pin acceptance criteria and kind. File nothing yet.

- [ ] **Step 4: Present the review table**

```
| # | Title | Kind |
|---|-------|------|
| 1 | ...   | feature |
```

Wait for the user's approval.

- [ ] **Step 5: File the issues**

For each approved item, in order, write the body to a temp file and run:

```bash
cd /home/hugo/work/poc-kitchen-configurator
glab issue create --title "<English title>" \
  --description-file /tmp/issue-<n>.md \
  --label "status::ready" --label "kind::<kind>" --yes \
  -R gitlab.com/hbardet-work/poc-kitchen-configurator
```

Body sections: Intent (with the French quote), Scope, Acceptance criteria, Out of scope, Verification, Notes.

- [ ] **Step 6: Verify the list**

Run: `glab issue list -R gitlab.com/hbardet-work/poc-kitchen-configurator`
Expected: one line per filed issue, each showing `status::ready` and its `kind::` label.

- [ ] **Step 7: Verify one body**

Run: `glab issue view <n> -R gitlab.com/hbardet-work/poc-kitchen-configurator`
Expected: all six sections present; **Acceptance criteria** has at least one checkbox; **Verification** is not empty.

---

### Task 3: work-issue end to end

**Files:**
- Create: worktree and branch `feat/<iid>-<slug>` under `/home/hugo/work/poc-kitchen-configurator`
- Create: `~/.agent-skills/state/hbardet-work/poc-kitchen-configurator/plans/YYYY-MM-DD-<slug>.md`
- Create: one comment on the issue, holding the plan
- Create: one GitLab MR whose body contains `Closes #<iid>`

**Interfaces:**
- Consumes: one `status::ready` issue filed in Task 2.
- Produces: `status::done` on the issue, an MR, and the implemented feature.

- [ ] **Step 1: Pick the issue**

Choose the smallest issue filed in Task 2. Record its IID `<iid>` and slug `<slug>`.

- [ ] **Step 2: Announce and read**

Say "I'm using the work-issue skill." Read the issue with `glab issue view <iid> -R gitlab.com/hbardet-work/poc-kitchen-configurator`. If it has no acceptance criteria or no intent, stop and ask the user.

- [ ] **Step 3: Claim it**

```bash
glab issue update <iid> --label "status::in-progress" --unlabel "status::ready" \
  -R gitlab.com/hbardet-work/poc-kitchen-configurator
```

- [ ] **Step 4: Verify the claim**

Run: `glab issue view <iid> -R gitlab.com/hbardet-work/poc-kitchen-configurator`
Expected: labels show `status::in-progress`, not `status::ready`.

- [ ] **Step 5: Create the worktree and branch**

Invoke `superpowers:using-git-worktrees`. Branch `feat/<iid>-<slug>`.

- [ ] **Step 6: Write the plan to the disposable local copy**

Create `~/.agent-skills/state/hbardet-work/poc-kitchen-configurator/plans/YYYY-MM-DD-<slug>.md` with the `writing-plans` header. Its `**Spec:**` line is `GitLab issue #<iid> (https://gitlab.com/hbardet-work/poc-kitchen-configurator/-/issues/<iid>)` — not a file path. The **Verification** section says `bun run build` and `bun run lint`; it never says "run the tests".

- [ ] **Step 7: Post the plan as a comment on the issue**

```bash
glab issue note <iid> \
  --message "$(cat ~/.agent-skills/state/hbardet-work/poc-kitchen-configurator/plans/YYYY-MM-DD-<slug>.md)" \
  -R gitlab.com/hbardet-work/poc-kitchen-configurator
```

- [ ] **Step 8: Verify the comment**

Run: `glab issue view <iid> -R gitlab.com/hbardet-work/poc-kitchen-configurator`
Expected: the plan is visible in the issue's comments.

- [ ] **Step 9: Execute**

Invoke `superpowers:executing-plans` with the local plan path. Before each task, re-read the plan comment; after each task, write the updated plan back to the comment.

- [ ] **Step 10: Verify the build**

Run: `cd <worktree> && bun run build`
Expected: exit 0.

- [ ] **Step 11: Open the MR**

The project has no MR template, so build the body from `~/.agents/skills/shared/mr-template.md`. Write it to a temp file (it ends with the plan and contains `Closes #<iid>`), then:

```bash
glab mr create --title "<title>" --description-file /tmp/mr-<iid>.md \
  --target-branch main --source-branch feat/<iid>-<slug> \
  -R gitlab.com/hbardet-work/poc-kitchen-configurator
```

- [ ] **Step 12: Close out the issue**

```bash
glab issue note <iid> --message "MR: <url>" -R gitlab.com/hbardet-work/poc-kitchen-configurator
glab issue update <iid> --label "status::done" --unlabel "status::in-progress" \
  -R gitlab.com/hbardet-work/poc-kitchen-configurator
```

Do **not** merge the MR.

---

### Task 4: Fix what the validation surfaced

**Files:**
- Modify: `/home/hugo/work/agent-skills/skills/batch-features/SKILL.md`
- Modify: `/home/hugo/work/agent-skills/skills/work-issue/SKILL.md`
- Modify: `/home/hugo/work/agent-skills/shared/config.md`
- Modify: `/home/hugo/work/agent-skills/config/config.template.json`

**Interfaces:**
- Consumes: the defects recorded during Tasks 1-3.
- Produces: corrected skills, committed and pushed to `github.com/hbardet/agent-skills`.

- [ ] **Step 1: Confirm both skills pick up the root `AGENTS.md`**

Task 1 added a root `AGENTS.md`. Confirm both skills read it and follow its pointer to
`client/web/AGENTS.md`. If a skill still assumes the file lives somewhere else, fix the skill —
do not move the file.

- [ ] **Step 2: Record every other defect found in Tasks 1-3**

For each: fix the skill or shared file that caused it, and name it in the commit message.

- [ ] **Step 3: Re-run the affected step**

Re-run the step that exposed each defect and confirm it now behaves.

- [ ] **Step 4: Commit and push**

```bash
cd /home/hugo/work/agent-skills
git add -A
git commit -m "fix: skills locate AGENTS.md outside the repo root"
git push
```
