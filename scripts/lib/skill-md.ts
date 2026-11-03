// scripts/lib/skill-md.ts — the SKILL.md <-> Notion row mapping.
//
// Notion owns the two YAML fields (they become the Name/Description properties)
// and the body (the row content). Nothing else about the file changes.

export type SkillFrontmatter = { data: Record<string, string>; body: string };

export function splitFrontmatter(raw: string): SkillFrontmatter {
  const text = raw.replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") throw new Error("missing frontmatter: expected a leading --- line");
  const close = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
  if (close === -1) throw new Error("missing frontmatter: no closing --- line");

  const data: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    let value = rawValue.trim();
    if (value.length >= 2 && /^".*"$|^'.*'$/.test(value)) value = value.slice(1, -1);
    data[key] = value;
  }

  const body = lines
    .slice(close + 1)
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "");
  return { data, body };
}

export function skillProperties(data: Record<string, string>): { title: string; description: string } {
  const title = (data.name ?? "").trim();
  const description = (data.description ?? "").trim();
  if (!title) throw new Error("frontmatter has no name");
  if (!description) throw new Error("frontmatter has no description");
  return { title, description };
}
