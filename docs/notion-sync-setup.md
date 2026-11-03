# Notion as the source of truth for skills

How the skills in this repo get authored in Notion and published back here as a
plugin marketplace. One-time setup; run it top to bottom.

The moving parts:

| Where | What |
| --- | --- |
| Notion DB **Agent Skills** | the source of truth — one row per skill, row body = `SKILL.md` without its YAML header |
| `hbardet/my-skills` (private) | a copy of [makenotion/notion-skills-github-sync](https://github.com/makenotion/notion-skills-github-sync) that syncs Notion → git |
| `hbardet/agent-skills` (this repo) | the publish target — the sync commits `plugins/<slug>/skills/<name>/` here |
| `~/.agents/skills/` | what your agent actually reads; `install.sh` symlinks it |

Nothing about the skills is edited in this repo any more — edit the Notion row and
let the sync commit the result.

## 1. Create the database

In Notion, open the **Process IA** page and add a **database — full page** named
`Agent Skills`. Give it exactly these properties, in this order:

| Property | Type | Filled by |
| --- | --- | --- |
| `Name` | Title | you — the skill name (`batch-features`, `work-issue`); must match the folder name |
| `Description` | Text | you — the whole YAML `description:` value, one line |
| `Tags` | Multi-select | optional — `gitlab`, `github`, `issues`, … |
| `Files` | Files & media | only for skills that ship extra files (zip them) |

The row **body** is the skill itself: everything below the YAML header of the
original `SKILL.md`, pasted as normal markdown (headings, lists, fenced code,
tables and quotes all survive). Leave the YAML header out — the sync renders it
from `Name` and `Description`.

## 2. Connect a token

1. <https://www.notion.so/profile/integrations> → **New connection** → name it
   `Skills Sync`, pick **Access token**, pick your workspace, **Create**.
2. Copy the `ntn_...` value. It is shown once.
3. In the Notion page: **Agent Skills** database → `…` → **Connections** →
   **Add connection** → `Skills Sync`. Do the same on the **Process IA** page.

That connection is the publish scope: the sync publishes exactly the skills it can
read, nothing else. Keep it on this one database.

Two workspace settings silently break this — check them under
**Settings → Connections**: *Limit who can create personal access tokens (PATs)* and
*Limit who can create internal connections*. If either is on, ask a workspace
owner.

## 3. Get the data source id

```bash
npx --yes ntn login            # once, opens a browser; write access for seeding
npx --yes ntn datasources resolve <database-id>
```

The `<database-id>` is the 32-hex string in the database URL. Put the returned id in
`.env` as `SKILLS_DATA_SOURCE_ID`.

## 4. Fill in `.env`

```bash
cp .env.example .env     # already gitignored
$EDITOR .env
```

Required: `NOTION_API_TOKEN`, `SKILLS_DATA_SOURCE_ID`. Add `GITHUB_TOKEN` (a
fine-grained PAT with **Contents: Read and write** on `hbardet/agent-skills` only,
1 year) before the first push. Every key in the file explains where its value comes
from.

## 5. Check it

```bash
scripts/notion-check.sh
```

It authenticates the token, resolves the data source, checks the four properties,
and lists the rows the connection can see. Fix anything it reports before moving on.

## 6. Seed the rows

Author the two rows by hand in Notion (paste the body, set `Name` and
`Description`), or let the script do it:

```bash
scripts/seed-notion.ts --dry-run   # prints the properties it would write
scripts/seed-notion.ts             # create-or-update, by Name
```

Both are safe to re-run. An existing row with the same `Name` is left alone unless
you pass `--force`, which replaces its body and `Description`.

## 7. Publish

```bash
scripts/notion-sync.sh dry-run   # what would change, no push
scripts/notion-sync.sh           # push to hbardet/agent-skills
```

The first run must land **one plugin, two skills**:
`plugins/<slug>/skills/batch-features/` and `plugins/<slug>/skills/work-issue/`.
The slug comes from the Notion plugin, i.e. the connection you created in step 2 —
rename the connection if you want a different slug.

## 8. Unattended

`scripts/set-sync-config.sh` copies `.env` into the fork's GitHub secrets and
variables, and the fork's `sync.yml` runs it hourly. See
[notion-sync-config.md](notion-sync-config.md).

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `object_not_found` on the database | connection not added to the database *and* the parent page |
| token works, no rows | connection added to a different database, or the rows are children of a page it cannot see |
| skills missing from the plugin | the row is outside the connection's scope, or its `Name` is empty (`notion-sync.sh dry-run` lists what the sync sees) |
| body lost its code fences | paste as code blocks, not as inline text; `notion-sync.sh dry-run` shows the rendered `SKILL.md` |
