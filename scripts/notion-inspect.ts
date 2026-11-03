#!/usr/bin/env bun
// scripts/notion-inspect.ts — print what the sync will see: schema + rows.
// Exit 1 if the database shape is wrong. Backs scripts/notion-check.sh.
//
// Env: NOTION_API_TOKEN, SKILLS_DATA_SOURCE_ID (bun reads .env), NTN_BIN.
import { pickProperties } from "./lib/notion-schema";

const dataSourceId = process.env.SKILLS_DATA_SOURCE_ID ?? "";
const ntn: string[] = process.env.NTN_BIN ? [process.env.NTN_BIN] : ["npx", "--yes", "ntn"];

if (!process.env.NOTION_API_TOKEN || !dataSourceId) {
  console.error("FAIL — set NOTION_API_TOKEN and SKILLS_DATA_SOURCE_ID in .env");
  process.exit(1);
}

function run(args: string[]) {
  const proc = Bun.spawnSync([...ntn, ...args], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    throw new Error(proc.stderr.toString().trim() || proc.stdout.toString().trim() || `exit ${proc.exitCode}`);
  }
  return proc.stdout.toString();
}

let ds: any;
try {
  ds = JSON.parse(run(["api", `/v1/data_sources/${dataSourceId}`]));
} catch (error) {
  console.error(`FAIL — cannot read data source ${dataSourceId}: ${(error as Error).message}`);
  console.error("       is the connection added to the database (and to its parent page)?");
  process.exit(1);
}

const title = (ds.title ?? []).map((t: any) => t.plain_text ?? "").join("");
const properties = (ds.properties ?? {}) as Record<string, { type?: string }>;
console.log(`ok   — data source "${title}" (${ds.database_type ?? "database"})`);

let map;
try {
  map = pickProperties(properties);
} catch (error) {
  console.error(`FAIL — ${(error as Error).message}`);
  const seen = Object.entries(properties).map(([name, p]) => `${name}:${p?.type}`).join(", ");
  console.error(`       found: ${seen}`);
  process.exit(1);
}
console.log(
  `ok   — properties title=${JSON.stringify(map.title)} description=${JSON.stringify(map.description)} ` +
    `files=${JSON.stringify(map.files)} tags=${JSON.stringify(map.tags)}`,
);

let rows: any[] = [];
try {
  rows = (JSON.parse(run(["datasources", "query", dataSourceId, "--json", "--limit", "100"])).results ?? []) as any[];
} catch (error) {
  console.error(`FAIL — cannot query rows: ${(error as Error).message}`);
  process.exit(1);
}

console.log(`ok   — ${rows.length} row(s) visible to this connection`);
for (const row of rows) {
  const props = row.properties ?? {};
  const rowTitle = (props[map.title]?.title ?? []).map((t: any) => t.plain_text ?? "").join("");
  const files = props[map.files]?.files ?? [];
  const kinds = files.length === 0 ? "none" : [...new Set(files.map((f: any) => f.type ?? "?"))].join(",");
  const tags = (props[map.tags]?.multi_select ?? []).map((t: any) => t.name).join(",") || "-";
  const words = Object.values(props as Record<string, any>)
    .flatMap((p) => (p?.rich_text ?? []).map((t: any) => t.plain_text ?? ""))
    .join("");
  console.log(`       row ${rowTitle || "<untitled>"} files=${kinds} tags=${tags} description=${words.length}b`);
}
process.exit(0);
