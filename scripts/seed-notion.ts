#!/usr/bin/env bun
// scripts/seed-notion.ts — create/update the Notion rows from skills/*/SKILL.md.
//
// Notion is the source of truth; this script exists only to get the current repo
// content into it once. Body = the markdown below the YAML header, Name and
// Description = the YAML fields. Safe to re-run: existing rows are skipped
// unless --force is passed (which archives the row and recreates it).
//
// Usage: bun scripts/seed-notion.ts [--dry-run] [--force] [--skip-existing]
// Env:   NOTION_API_TOKEN, SKILLS_DATA_SOURCE_ID (read from .env by bun),
//        NTN_BIN (executable, default `npx --yes ntn`), SKILLS_DIR (default `test/fixtures/skills`).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { reflowMarkdown } from "./lib/markdown-reflow";
import { pickProperties, type SkillPropertyMap } from "./lib/notion-schema";
import { skillProperties, splitFrontmatter } from "./lib/skill-md";

type Row = { id: string; title: string };

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has("--dry-run");
const force = argv.has("--force");

const dataSourceId = process.env.SKILLS_DATA_SOURCE_ID ?? "";
// The live copy of the prose is the Notion row; these fixtures are the frozen
// originals the rows were seeded from, kept so a reseed has a source.
const skillsDir = process.env.SKILLS_DIR ?? "test/fixtures/skills";
const ntn: string[] = process.env.NTN_BIN ? [process.env.NTN_BIN] : ["npx", "--yes", "ntn"];
const hasCreds = Boolean(process.env.NOTION_API_TOKEN && dataSourceId);

if (!dryRun && !hasCreds) {
  console.error("set NOTION_API_TOKEN and SKILLS_DATA_SOURCE_ID in .env first (scripts/notion-check.sh)");
  process.exit(2);
}

function run(args: string[], input?: string) {
  const proc = Bun.spawnSync([...ntn, ...args], {
    stdin: input ? new TextEncoder().encode(input) : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = proc.stdout.toString();
  if (proc.exitCode !== 0) {
    throw new Error(`ntn ${args[0]} ${args[1] ?? ""} failed (${proc.exitCode}): ${proc.stderr.toString().trim() || out.trim()}`);
  }
  return out;
}

const fallbackMap: SkillPropertyMap = { title: "Name", description: "Description", files: "Files", tags: "Tags" };

function schema(): SkillPropertyMap {
  if (!hasCreds) return fallbackMap;
  const ds = JSON.parse(run(["api", `/v1/data_sources/${dataSourceId}`])) as { properties?: Record<string, { type?: string }> };
  return pickProperties(ds.properties ?? {});
}

function existingRows(map: SkillPropertyMap): Row[] {
  if (!hasCreds) return [];
  const out = run(["datasources", "query", dataSourceId, "--json", "--limit", "100"]);
  const json = JSON.parse(out) as { results?: any[] };
  return (json.results ?? []).map((row) => ({
    id: row.id as string,
    title: (row.properties?.[map.title]?.title ?? []).map((t: any) => t.plain_text ?? "").join(""),
  }));
}

const local = readdirSync(skillsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const file = join(skillsDir, entry.name, "SKILL.md");
    const { data, body } = splitFrontmatter(readFileSync(file, "utf8"));
    return { file, body, ...skillProperties(data) };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

const map = schema();
const rows = existingRows(map);
if (!hasCreds) console.error("# no NOTION_API_TOKEN — assuming an empty database");

for (const skill of local) {
  const hit = rows.find((row) => row.title === skill.title);
  if (hit && !force) {
    console.log(`skip ${skill.title} (exists)`);
    continue;
  }
  if (hit) console.log(`archive ${skill.title} (${hit.id}) — --force`);

  // One line per paragraph: the Notion importer makes a block per source line.
  const markdown = `---\ntitle: ${skill.title}\n---\n\n${reflowMarkdown(skill.body)}`;
  console.log(`create ${skill.title} (body ${markdown.length} chars after reflow, description ${skill.description.length} chars)`);

  if (dryRun) {
    console.log(`  ${ntn.join(" ")} pages create --parent data-source:$SKILLS_DATA_SOURCE_ID --json  (markdown ${markdown.length} chars on stdin)`);
    console.log(`  ${ntn.join(" ")} api v1/pages/<id> -X PATCH -d @properties.json`);
    continue;
  }

  if (hit) {
    run(["api", `v1/pages/${hit.id}`, "-X", "PATCH", "-d", JSON.stringify({ in_trash: true })]);
  }

  // `--content` rejects a value that starts with `---` (frontmatter would be parsed as
  // flags), so the markdown always goes in on stdin.
  const created = JSON.parse(
    run(["pages", "create", "--parent", `data-source:${dataSourceId}`, "--json"], markdown),
  ) as { id?: string; url?: string };
  const pageId = created.id;
  if (!pageId) throw new Error(`pages create returned no id for ${skill.title}`);

  run([
    "api",
    `v1/pages/${pageId}`,
    "-X",
    "PATCH",
    "-d",
    JSON.stringify({
      properties: {
        [map.title]: { title: [{ text: { content: skill.title } }] },
        [map.description]: { rich_text: [{ text: { content: skill.description } }] },
        [map.tags]: { multi_select: [{ name: "agent-skill" }] },
      },
    }),
  ]);
  console.log(`  ${created.url ?? pageId}`);
}

console.log(dryRun ? "\n(dry run — nothing was written)" : "\ndone");
