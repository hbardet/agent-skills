---
name: |-
  init-agent-repo
description: |-
  Use when a repository has no AGENTS.md, a stale one, or no issue/PR template, CONTRIBUTING.md or tracker config — or when the user says "set this repo up for the agent workflow", "write the AGENTS.md", "init this repo", "onboard this project", "make this repo work with the skills", "document the architecture for agents", "add contributing". Inspects the repo first and asks only what the code cannot answer, then writes AGENTS.md with its eight sections (project name, context, description, architecture folder by folder, how to add a feature, how to test, where the code is hosted, which labels exist), CONTRIBUTING.md, the issue and merge-request templates for GitHub or GitLab, and .agent-skills/config.json. Drafts everything for one review before writing anything. GitHub and GitLab.
notion_page_id: 41a901c1-90a1-8171-b193-f48082a89d99
---

Every later skill — `batch-features`, `brainstorming`, `writing-plans`, `work-issue` — starts by reading `AGENTS.md`. If it is missing or vague, each of them re-discovers the same facts, badly, on every run. This skill writes those facts down once.

The output is four files and a label vocabulary. Not a template zoo, not aspirational rules the project does not follow.

**Announce at start:** "I'm using the init-agent-repo skill to set this repo up for the workflow."

## Setup

`shared/` is the directory next to this skill — `~/.agents/skills/shared/` when installed, or `../shared/` in a checkout. If a `shared/...` path does not resolve, use the other one.

1. Read `shared/tracker-adapter.md`, `shared/labels.md`, `shared/config.md`, `shared/issue-template.md`, `shared/mr-template.md`.
2. Detect the tracker from `git remote -v`: `github.com` → GitHub, anything else with `gitlab` in the host → GitLab. Do not guess if the remote is ambiguous; ask.
3. Read what already exists: `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `.github/`, `.gitlab/`, `.agent-skills/config.json`. Existing files win over anything here.
4. Inventory the code (next section). This is what turns the interview into three questions instead of twenty.

## Read the repo before asking anything

| Look at | It answers |
| --- | --- |
| Manifest — `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml` | name, language, runtime, the scripts that exist |
| CI — `.github/workflows/*.yml`, `.gitlab-ci.yml` | the commands that actually gate a merge |
| Test layout and config — `test/`, `*_test.go`, `vitest.config.*`, `Makefile` | how to run one test, what a fixture looks like |
| Top-level directories and their `README`/`index` files | the architecture table, entry points |
| `graphify-out/GRAPH_REPORT.md`, if it exists | communities and hub files: the architecture table's rows, already named |
| `Dockerfile`, `compose.yml`, `.env.example` | the services it talks to, ports, required env |
| `git log --oneline -20`, branch names | commit style, branch prefix, review habits |
| `.gitlab/`, `.github/` | templates that already exist |

Anything the repo cannot answer — who the users are, why it exists, what "done" means — becomes an interview question with a proposed default taken from what you read.

## The eight sections of [AGENTS.md](http://AGENTS.md)

Write these in this order. Every section is facts, not slogans.

| # | Section | Must answer | Source |
| --- | --- | --- | --- |
| 1 | Project | The project's name, exactly as the tracker and package call it | manifest, remote |
| 2 | Context | Why it exists, who uses it, what it talks to (services, APIs, data, on-call owner) | interview |
| 3 | Description | What it does in behaviour terms — the nouns and verbs a newcomer needs | README, interview |
| 4 | Architecture | One row per folder or part: what it is for, its entry point, what depends on it. Plus the three files to read first | code inventory |
| 5 | Adding a feature | The workflow below, the branch prefix, where new code goes, when a change needs an issue | `shared/config.md`, git log |
| 6 | Testing | Exact commands, how to run a single test, what counts as green, what manual check replaces a missing suite | CI, scripts |
| 7 | Where the code lives | Tracker and remote, default branch, merge target, the CI jobs that matter, who reviews | remote, CI |
| 8 | Labels | The two prefixes, what each label means, when to apply it | `shared/labels.md`  • the labels that exist |

Add one short **Rules that bite** section after them: the five or six things an agent gets wrong in this repo (generated directories not to edit, secrets, a command that must never run, a case-sensitivity or line-ending trap). Omit the section rather than fill it with platitudes.

### How to add a feature

This is section 5, and it is the section that makes the rest of the toolkit work. State the path in the project's own vocabulary:

1. **Design first.** `superpowers:brainstorming` turns the idea into a short description of what changes. The approved design is filed as the **spec document** on a tracker issue.
2. **Issue.** One issue per change, with the body short and the spec document attached. Labels: one `status::` and one `kind::`.
3. **Plan.** `superpowers:writing-plans` attaches the **plan document** to the same issue. There is no plan in the repo.
4. **Build.** `work-issue` claims the issue, reads the spec and plan documents, and works the plan in a branch.
5. **Merge request.** Open it with the body from the MR template, linking the issue and its plan document.

Say where in the tree a new feature usually lands, and which of the existing parts is the closest example to copy.

### Architecture, with graphify

Build the graph before you write the table. It answers "what depends on what" better than reading imports by hand, and with `--code-only` it costs nothing:

```bash
export PATH="$HOME/.local/bin:$PATH"   # graphify installs there (uv tool install graphifyy)
graphify . --code-only --no-viz         # local AST extraction, ~2 s, no API key
graphify cluster-only .                 # adds graphify-out/GRAPH_REPORT.md and graph.html
graphify query "what depends on src/core" --budget 800
```

- `--code-only` reads the code with local AST extraction and needs no key. A plain `graphify .` also reads docs, papers and images semantically, and stops with "no LLM API key found" unless `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MOONSHOT_API_KEY` or `DEEPSEEK_API_KEY` is set. Use the key when the docs carry half the architecture; otherwise `--code-only`.
- **Community hubs become your rows.** `GRAPH_REPORT.md` lists them under *Community Hubs (Navigation)* — one row per hub with its folder, role and entry point. Confirm each **Depends on** cell with `graphify query` or `graphify explain <part>`, never from a filename.
- **Keep the graph out of the repo.** `graphify-out/` is regenerable: add it to `.gitignore` and paste only the distilled table into `AGENTS.md`. The report records the commit it was built from (<i>Built from commit </i>*`<sha>`*), and `graphify update .` re-extracts just the changed files at no API cost — name that command next to the table so the next agent knows how to refresh it.
- Want a picture? `graphify . --svg` writes a `graph.svg` that renders on GitHub and GitLab, and `graphify --wiki` writes `docs/architecture/index.md` plus one article per community. The default HTML output is for looking at once, not for committing.

Either way the section is a table first:

| Part | Role | Entry point | Depends on |
| --- | --- | --- | --- |
| `src/api/` | HTTP surface, request validation | `src/api/server.ts` | `src/core/` |

Then the builder reads first, in order, and one refresh line: `graphify update .` (or the commands section 6 lists) keeps it honest.

A mermaid graph is a fine second picture when the project would rather commit a diagram than a graph:

```javascript

```

graph LR cli --> core api --> core core --> store

```javascript

```

Never draw an edge you have not read in the imports of both ends, and do not install a mapper just for this page: `madge`, `pydeps`, `cargo modules` and `go mod graph` only earn a mention when the project already runs one. A wrong diagram is worse than a table.

## The other files

| File | GitLab | GitHub | Content |
| --- | --- | --- | --- |
| Agent rules | `AGENTS.md` | `AGENTS.md` | the eight sections above |
| Human guide | `CONTRIBUTING.md` | `CONTRIBUTING.md` | setup, run, test, branch and review etiquette, label meanings, one line pointing to `AGENTS.md` |
| Issue template | `.gitlab/issue_templates/feature.md` | `.github/ISSUE_TEMPLATE/feature.md` | from `shared/issue-template.md`, rendered into the project's language |
| MR/PR template | `.gitlab/merge_request_templates/default.md` | `.github/pull_request_template.md` | from `shared/mr-template.md` |
| Workflow config | `.agent-skills/config.json` | same | from `shared/config.md`, filled with the answers: tracker, default branch, verification commands, label sets, `issueTemplate`, `mrTemplate` |

Rules for all five:

- **Merge, never clobber.** If a file exists, show the diff you would apply and keep every existing section nobody asked you to remove. An existing project template beats `shared/`'s — record its path in the config instead of replacing it.
- **No duplication.** `AGENTS.md` is the source. `CONTRIBUTING.md` is the human summary and links to it rather than restating it.
- <b>Keep </b>**`AGENTS.md`**<b> readable in one sitting</b> — roughly 250 lines. Depth goes in `docs/agents/*.md` with a one-line pointer from `AGENTS.md`.
- **Only rules the project actually follows.** Check the last 20 commits before writing a commit convention. If the repo has no test suite, section 6 says so and names the manual check; it does not promise tests that do not exist.
- Write in the language of `config.language` (default `en`). Quote the user's own wording where they gave it.

## Labels

The vocabulary is `shared/labels.md`: one `status::` and one `kind::` per issue. List the ones the tracker actually has, mark any that are missing, and offer once to create them:

```bash
gh label create "status::ready" --color "428BCA"        # GitHub
glab label create -n "status::ready" -c "#428BCA"       # GitLab
```

If the project already uses a different vocabulary, document that one and say so — do not create a second set alongside it.

## One review, then write

Draft everything, show one table and the draft `AGENTS.md` in full:

```markdown
| File | Action | Size |
|---|---|---|
| AGENTS.md | create | 120 lines |
| CONTRIBUTING.md | update (+18 −2) | 60 lines |
| .github/ISSUE_TEMPLATE/feature.md | create | 30 lines |
```

Ask for approval. The user may cut sections, change the architecture rows, or rename labels. Write nothing before that approval.

After writing:

1. Re-read each written file; check every path, command and link in it exists.
2. Run the commands section 6 documents. If a documented command fails, fix the document — a `AGENTS.md` that teaches a broken command is worse than none.
3. `git status` to show what appeared, and offer a commit (`docs: agent and contributor setup`) — do not push or open a branch unless asked.
4. Report the label set that was created, if any, and the templates that already existed and were left alone.

## Checklist

- [ ] Tracker detected from the remote, not assumed
- [ ] Every one of the eight sections present, empty ones deleted rather than padded
- [ ] Architecture table matches the actual directories; entry points exist
- [ ] Graph built in this session (or the imports read, if graphify is unavailable); the refresh command named next to the table
- [ ] Section 6 commands were run, and they pass
- [ ] Templates written for the right tracker, existing ones preserved
- [ ] `.agent-skills/config.json` written and valid JSON
- [ ] Labels documented; missing ones created or flagged
- [ ] `AGENTS.md` under \~250 lines, nothing duplicated in `CONTRIBUTING.md`
