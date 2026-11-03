// test/notion-schema.test.ts
import { expect, test } from "bun:test";
import { pickProperties } from "../scripts/lib/notion-schema";

const french = {
  "Créée par": { type: "created_by" },
  Description: { type: "rich_text" },
  Fichiers: { type: "files" },
  "Nom de la skill": { type: "title" },
  Étiquettes: { type: "multi_select" },
};

const english = {
  "Skill name": { type: "title" },
  Description: { type: "rich_text" },
  Files: { type: "files" },
  Tags: { type: "multi_select" },
};

test("resolves the localized skills schema by type", () => {
  expect(pickProperties(french)).toEqual({
    title: "Nom de la skill",
    description: "Description",
    files: "Fichiers",
    tags: "Étiquettes",
  });
});

test("resolves the english names too", () => {
  expect(pickProperties(english)).toEqual({
    title: "Skill name",
    description: "Description",
    files: "Files",
    tags: "Tags",
  });
});

test("ignores type-property noise and prefers a property called description", () => {
  const map = { ...english, Notes: { type: "rich_text" } };
  expect(pickProperties(map).description).toBe("Description");
});

test("throws when a required type is missing", () => {
  const { Files, ...noFiles } = english;
  expect(() => pickProperties(noFiles)).toThrow(/files/);
});
