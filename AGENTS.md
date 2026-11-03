# Agent notes

## To change a skill

Edit its row in the Notion **Skills** database (data source `40d901c1-90a1-80ed-ad69-000b4515f34b`,
under the Process IA page). The row's title property is the skill name, its description property is
the frontmatter `description`, and the page body is the skill.
`hbardet/my-skills` publishes it here within the hour.

## Never edit `plugins/`

`plugins/`, `.claude-plugin/`, `.cursor-plugin/` and `.agents/plugins/` are generated. Edits there
are overwritten by the next sync. If a published file looks wrong, fix the Notion row.

## Still hand-maintained in git

- `shared/` — tracker adapter, issue template, MR template, labels, config schema.
- `config/` — the starter `.agent-skills/config.json`.

`shared/` sits next to the skills after `install.sh`, which is what the skills' `shared/…` reads
rely on.

## Seeding and syncing

```bash
bash scripts/notion-check.sh        # is the DB reachable, are the rows there
bun scripts/seed-notion.ts --dry-run # what a seed would create
bash scripts/notion-sync.sh dry-run  # what the repo would receive
bash scripts/notion-sync.sh sync     # publish now (normally the hourly workflow does this)
```

`test/fixtures/skills/` holds the frozen originals the rows were seeded from; nothing reads them at
runtime.
