# agent-skills

Portable skills for the two ends of a superpowers-based dev workflow:

- **`batch-features`** — turn a pasted list of rough ideas into well-formed tracker issues,
  with a per-item debate before anything is filed.
- **`work-issue`** — take an issue from `ready` to a merge request, delegating to
  `obra/superpowers` for planning, execution, review, and branch finishing.

Neither skill modifies superpowers. Both invoke them.

## Install

```bash
git clone https://github.com/<user>/agent-skills.git
cd agent-skills
./install.sh          # symlinks the skills into ~/.agents/skills
```

`install.sh` is idempotent and safe to re-run on any machine. Set `AGENTS_SKILLS_DIR` to override
the target directory.

## Layout

```
skills/batch-features/SKILL.md   intake: list → debate → review table → issues
skills/work-issue/SKILL.md       pickup: issue → worktree → plan → execute → MR
shared/                         tracker adapter, issue template, labels, config schema
config/                         per-repo config templates (optional)
specs/                          design docs for the skills themselves
install.sh                      symlink installer
```

## Where the spec and plan live

Neither lives in the project repo. The **spec is the tracker issue body** (read from the
issue), the **plan is a comment on the issue** (web-editable), plus a disposable local copy under
`~/.agent-skills/state/<owner>/<repo>/plans/` because superpowers' scripts take a file path.
The repo gets code and the MR.

## Tracker support

GitLab (`glab`) and GitHub (`gh`). Detected from `git remote -v`; the per-repo
`.agent-skills/config.json` stores the choice and the conventions.

## License

MIT
