// scripts/lib/markdown-reflow.ts — one line per paragraph.
//
// The Notion markdown importer turns every source line into its own block, so a
// hard-wrapped paragraph arrives as N paragraphs (each rendered with a blank line
// after it) and a list item's continuation lines become nested <p> blocks in the
// published SKILL.md. Reflowing the body first — joining each paragraph, list item
// and blockquote onto a single line, leaving code fences, tables and headings
// alone — makes the round trip lossless. Line wrapping is the only thing lost.

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^#{1,6}\s/;
const LIST = /^\s*([-*+]|\d+[.)])\s/;
const TABLE = /^\s*\|/;
const QUOTE = /^\s*>/
const RULE = /^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/;

export function reflowMarkdown(input: string): string {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let fence: string | null = null;
  let current: { kind: "para" | "list" | "quote"; text: string } | null = null;

  const flush = () => {
    if (current) out.push(current.text);
    current = null;
  };

  for (const line of lines) {
    if (fence) {
      out.push(line);
      if (line.trimStart().startsWith(fence)) fence = null;
      continue;
    }
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      flush();
      fence = fenceMatch[1];
      out.push(line);
      continue;
    }
    if (line.trim() === "") {
      flush();
      out.push("");
      continue;
    }
    if (HEADING.test(line) || TABLE.test(line) || RULE.test(line)) {
      flush();
      out.push(line);
      continue;
    }
    if (LIST.test(line)) {
      flush();
      current = { kind: "list", text: line.trimEnd() };
      continue;
    }
    if (QUOTE.test(line)) {
      const body = line.replace(/^\s*>\s?/, "").trim();
      if (current?.kind === "quote") current.text = `${current.text} ${body}`;
      else {
        flush();
        current = { kind: "quote", text: `> ${body}` };
      }
      continue;
    }
    // Continuation of whatever is open, or the start of a new paragraph.
    const text = line.trim();
    if (current) current.text = `${current.text} ${text}`;
    else current = { kind: "para", text };
  }
  flush();

  // Collapse runs of blank lines and end with exactly one newline.
  const cleaned: string[] = [];
  for (const line of out) {
    if (line === "" && cleaned[cleaned.length - 1] === "") continue;
    cleaned.push(line);
  }
  while (cleaned.length > 0 && cleaned[cleaned.length - 1] === "") cleaned.pop();
  return cleaned.join("\n") + "\n";
}
