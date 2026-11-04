// test/zip.test.ts
import { expect, test } from "bun:test";
import { createZip, crc32, type ZipEntry } from "../scripts/lib/zip";

// Parse the archive back with a reader that trusts nothing but the spec, so the
// writer is checked against the format rather than against itself.
function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("no end-of-central-directory record");
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error(`bad central header at ${at}`);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const path = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    const size = view.getUint32(localOffset + 22, true);
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true);
    entries.push({ path, data: bytes.subarray(dataStart, dataStart + size) });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const text = (s: string) => new TextEncoder().encode(s);

test("round-trips paths and content, nested directories included", () => {
  const input: ZipEntry[] = [
    { path: "writing-good-tests.md", data: text("one\n") },
    { path: "references/nested/deep.md", data: text("two\n") },
    { path: "scripts/empty.sh", data: new Uint8Array(0) },
  ];
  const zip = createZip(input);
  const back = readZip(zip);
  expect(back.map((e) => e.path)).toEqual(input.map((e) => e.path));
  expect(new TextDecoder().decode(back[1]!.data)).toBe("two\n");
  expect(back[2]!.data.length).toBe(0);
});

test("records the CRC the reader expects", () => {
  const zip = createZip([{ path: "a.txt", data: text("hello") }]);
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  // local header: crc at offset 14, sizes at 18/22
  expect(view.getUint32(14, true)).toBe(crc32(text("hello")));
  expect(view.getUint32(18, true)).toBe(5);
  expect(crc32(text("hello"))).toBe(0x3610a686);
});

test("is byte-stable, so a reseed does not churn the archive", () => {
  const entries: ZipEntry[] = [{ path: "a/b.md", data: text("x") }];
  expect(Array.from(createZip(entries))).toEqual(Array.from(createZip(entries)));
});
