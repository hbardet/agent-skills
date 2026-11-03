// test/skill-md.test.ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { splitFrontmatter, skillProperties } from "../scripts/lib/skill-md";

test("splits the real work-issue skill", () => {
  const { data, body } = splitFrontmatter(readFileSync("test/fixtures/skills/work-issue/SKILL.md", "utf8"));
  expect(data.name).toBe("work-issue");
  expect(data.description.length).toBeGreaterThan(200);
  expect(body.startsWith("# Work issue")).toBe(true);
  expect(body).not.toContain("---\nname:");
});

test("tolerates CRLF and a missing trailing newline", () => {
  const { data, body } = splitFrontmatter("---\r\nname: x\r\ndescription: y\r\n---\r\n\r\n# X");
  expect(data).toEqual({ name: "x", description: "y" });
  expect(body).toBe("# X");
});

test("rejects a file without frontmatter", () => {
  expect(() => splitFrontmatter("# no yaml")).toThrow(/frontmatter/);
});

test("maps to DB properties", () => {
  expect(skillProperties({ name: "x", description: "d" })).toEqual({ title: "x", description: "d" });
});
