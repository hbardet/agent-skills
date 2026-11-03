// scripts/lib/notion-schema.ts — the Agent Skills DB property names.
//
// A Notion *skills* database has a fixed shape (title + rich_text + files +
// multi_select, plus an auto created_by), but the labels follow the workspace
// language: "Skill name"/"Nom de la skill", "Files"/"Fichiers", "Tags"/"Étiquettes".
// So resolve by property *type*, never by name. The sync tool itself reads
// Notion's plugins API and needs none of this — only seeding and the preflight do.

export type SkillPropertyMap = { title: string; description: string; files: string; tags: string };

type Properties = Record<string, { type?: string }>;

function byType(properties: Properties, type: string): string[] {
  return Object.entries(properties)
    .filter(([, p]) => p?.type === type)
    .map(([name]) => name);
}

export function pickProperties(properties: Properties): SkillPropertyMap {
  const missing: string[] = [];
  const one = (type: string, preferred: RegExp): string => {
    const names = byType(properties, type);
    if (names.length === 0) {
      missing.push(type);
      return "";
    }
    return names.find((name) => preferred.test(name)) ?? names[0];
  };
  const map = {
    title: one("title", /name|nom/i),
    description: one("rich_text", /description/i),
    files: one("files", /file|fichier/i),
    tags: one("multi_select", /tag|étiquette|etiquette/i),
  };
  if (missing.length > 0) throw new Error(`data source is missing property types: ${missing.join(", ")}`);
  return map;
}
