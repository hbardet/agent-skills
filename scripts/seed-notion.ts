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
import { createZip, type ZipEntry } from "./lib/zip";
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

// Everything in the skill's directory except SKILL.md travels as one zip in the
// row's files property; the sync expands a lone zip in place, which is how a
// skill's scripts/ and references/ survive the round trip.
function extraFiles(dir: string): ZipEntry[] {
  const out: ZipEntry[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(rel ? join(dir, rel) : dir, { withFileTypes: true })) {
      const path = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path);
      else if (path !== "SKILL.md") out.push({ path, data: readFileSync(join(dir, path)) });
    }
  };
  walk("");
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

const NOTION_VERSION = "2025-09-03";

async function attachZip(pageId: string, name: string, bytes: Uint8Array, filesProperty: string) {
  const token = process.env.NOTION_API_TOKEN ?? "";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
  const create = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "single_part", filename: name, content_type: "application/zip" }),
  });
  if (!create.ok) throw new Error(`file_uploads: ${create.status} ${await create.text()}`);
  const upload = (await create.json()) as { id: string; upload_url: string };

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/zip" }), name);
  const send = await fetch(upload.upload_url, {
    method: "POST",
    headers: { Authorization: headers.Authorization, "Notion-Version": NOTION_VERSION },
    body: form,
  });
  if (!send.ok) throw new Error(`file_uploads send: ${send.status} ${await send.text()}`);

  const patch = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      properties: { [filesProperty]: { files: [{ type: "file_upload", file_upload: { id: upload.id } }] } },
    }),
  });
  if (!patch.ok) throw new Error(`attach to ${pageId}: ${patch.status} ${await patch.text()}`);
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
    const dir = join(skillsDir, entry.name);
    const file = join(dir, "SKILL.md");
    const { data, body } = splitFrontmatter(readFileSync(file, "utf8"));
    return { file, dir, body, extras: extraFiles(dir), ...skillProperties(data) };
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
  const extras = skill.extras.length > 0 ? createZip(skill.extras) : undefined;
  console.log(
    `create ${skill.title} (body ${markdown.length} chars after reflow, description ${skill.description.length} chars` +
      (extras ? `, ${skill.extras.length} file(s) in a ${extras.length}-byte zip)` : ")"),
  );

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
  if (extras) {
    await attachZip(pageId, `${skill.title}.zip`, extras, map.files);
  }
  console.log(`  ${created.url ?? pageId}`);
}

console.log(dryRun ? "\n(dry run — nothing was written)" : "\ndone");
