// test/markdown-reflow.test.ts
import { expect, test } from "bun:test";
import { reflowMarkdown } from "../scripts/lib/markdown-reflow";

test("joins soft-wrapped paragraph lines", () => {
  expect(reflowMarkdown("one line\ntwo lines\n\nnext para\n")).toBe("one line two lines\n\nnext para\n");
});

test("keeps fenced code byte-for-byte, blank lines included", () => {
  const input = "before\n\n```bash\nset -e\n\necho hi\n```\n\nafter\n";
  expect(reflowMarkdown(input)).toBe(input);
});

test("keeps headings and table rows on their own lines", () => {
  const input = "## Head\n| a | b |\n| - | - |\n| 1 | 2 |\n";
  expect(reflowMarkdown(input)).toBe(input);
});

test("joins a list item's continuation lines into the item", () => {
  expect(reflowMarkdown("1. first item\n   continues here\n2. second\n")).toBe(
    "1. first item continues here\n2. second\n",
  );
  expect(reflowMarkdown("- bullet\n  continuation\n- next\n")).toBe("- bullet continuation\n- next\n");
});

test("keeps separate list items separate and does not swallow headings", () => {
  expect(reflowMarkdown("1. a\n2. b\n## Head\n")).toBe("1. a\n2. b\n## Head\n");
});

test("joins consecutive blockquote lines", () => {
  expect(reflowMarkdown("> one\n> two\n\nplain\n")).toBe("> one two\n\nplain\n");
});

test("does not fuse a paragraph into a following list", () => {
  expect(reflowMarkdown("text\n1. item\n")).toBe("text\n1. item\n");
});
