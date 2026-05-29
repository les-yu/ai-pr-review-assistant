import { describe, it, expect } from "vitest";
import { parsePatch, chunkFile, detectLanguage } from "../chunker";
import type { ChangedFile } from "@/types/github";

function makeFile(overrides: Partial<ChangedFile> = {}): ChangedFile {
  return {
    filename: "src/example.ts",
    status: "modified",
    additions: 10,
    deletions: 5,
    changes: 15,
    patch: "",
    ...overrides,
  };
}

// ─── parsePatch ─────────────────────────────────────────────

describe("parsePatch", () => {
  it("parses a standard two-hunk patch", () => {
    const patch = `@@ -10,7 +10,8 @@ function foo() {
   const a = 1;
-  const b = 2;
+  const b = 3;
+  const c = 4;
   return a + b;
 }

@@ -25,4 +26,5 @@ function bar() {
   const x = 1;
+  const y = 2;
   return x;
 }`;

    const hunks = parsePatch(patch);
    expect(hunks).toHaveLength(2);

    expect(hunks[0].oldStart).toBe(10);
    expect(hunks[0].newStart).toBe(10);
    expect(hunks[0].lines.length).toBeGreaterThan(0);

    expect(hunks[1].oldStart).toBe(25);
    expect(hunks[1].lines.some((l) => l.type === "add")).toBe(true);
  });

  it("returns empty array for empty patch", () => {
    expect(parsePatch("")).toEqual([]);
    expect(parsePatch("  \n  ")).toEqual([]);
  });

  it("handles patch with no hunk headers (metadata only)", () => {
    const patch = "diff --git a/file.ts b/file.ts\nindex abc..def 100644";
    expect(parsePatch(patch)).toEqual([]);
  });

  it("parses a newly added file (all lines are additions)", () => {
    const patch = `@@ -0,0 +1,4 @@
+export function hello() {
+  console.log("hello");
+  return true;
+}`;

    const hunks = parsePatch(patch);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oldStart).toBe(0);
    expect(hunks[0].newStart).toBe(1);
    expect(hunks[0].lines.every((l) => l.type === "add")).toBe(true);
    expect(hunks[0].lines).toHaveLength(4);
  });

  it("parses a deleted file (all lines are removals)", () => {
    const patch = `@@ -1,4 +0,0 @@
-export function goodbye() {
-  console.log("goodbye");
-  return false;
-}`;

    const hunks = parsePatch(patch);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.every((l) => l.type === "remove")).toBe(true);
  });

  it("parses a renamed file with modifications", () => {
    const patch = `@@ -5,3 +5,4 @@
 const x = 1;
-const y = 2;
+const y = 3;
+const z = 4;
 const w = 5;`;

    const hunks = parsePatch(patch);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.filter((l) => l.type === "add")).toHaveLength(2);
    expect(hunks[0].lines.filter((l) => l.type === "remove")).toHaveLength(1);
    expect(hunks[0].lines.filter((l) => l.type === "context")).toHaveLength(2);
  });

  it("parses single-line hunk (count omitted = 1)", () => {
    const patch = `@@ -5 +5,2 @@
 old line
+new line`;

    const hunks = parsePatch(patch);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].oldStart).toBe(5);
    expect(hunks[0].newStart).toBe(5);
  });

  it("handles hunk header with function context", () => {
    const patch = `@@ -10,5 +10,6 @@ function myFunction() {
   const a = 1;
+  const b = 2;
   return a;
 }`;

    const hunks = parsePatch(patch);
    expect(hunks[0].header).toContain("function myFunction()");
  });

  it("handles conflict markers as unknown lines", () => {
    const patch = `@@ -1,5 +1,7 @@
 line1
+added line
<<<<<<< HEAD
 conflict ours
=======
 conflict theirs
>>>>>>> branch
 line2`;

    const hunks = parsePatch(patch);
    expect(hunks).toHaveLength(1);
    // Should not crash, conflict markers are treated as context/ignored
    expect(hunks[0].lines.length).toBeGreaterThan(0);
  });

  it("handles patch with only context lines (no changes)", () => {
    const patch = `@@ -1,3 +1,3 @@
 line1
 line2
 line3`;

    const hunks = parsePatch(patch);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].lines.every((l) => l.type === "context")).toBe(true);
  });
});

// ─── chunkFile ──────────────────────────────────────────────

describe("chunkFile", () => {
  it("produces chunks from a valid file", () => {
    const file = makeFile({
      patch: `@@ -1,3 +1,4 @@
 function test() {
-  return 1;
+  return 2;
+  // added comment
 }`,
    });

    const chunks = chunkFile(file);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].filePath).toBe("src/example.ts");
    expect(chunks[0].type).toBe("diff");
    expect(chunks[0].content).toContain("+");
    expect(chunks[0].content).toContain("-");
  });

  it("returns empty array for file with empty patch", () => {
    const file = makeFile({ patch: "" });
    expect(chunkFile(file)).toEqual([]);
  });

  it("returns empty array for binary-like file with no hunk", () => {
    const file = makeFile({
      patch: "Binary files a/img.png and b/img.png differ",
    });
    expect(chunkFile(file)).toEqual([]);
  });

  it("splits multi-hunk file into multiple chunks", () => {
    const file = makeFile({
      patch: `@@ -1,3 +1,4 @@
 a
+ b
 c

@@ -10,3 +11,4 @@
 x
+ y
 z`,
    });

    const chunks = chunkFile(file);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].id).toContain("hunk:0");
    expect(chunks[1].id).toContain("hunk:1");
  });

  it("respects surroundingLines parameter", () => {
    const contextLines = Array.from({ length: 20 }, (_, i) => ` line${i}`).join("\n");
    const file = makeFile({
      patch: `@@ -1,20 +1,21 @@
${contextLines}
+ new line
 more context`,
    });

    const chunksDefault = chunkFile(file, 10);
    const chunksSmall = chunkFile(file, 3);

    // With smaller surrounding, content should be shorter
    expect(chunksSmall[0].content.length).toBeLessThanOrEqual(
      chunksDefault[0].content.length
    );
  });

  it("detects language from filename", () => {
    const tsFile = makeFile({ filename: "src/app.ts", patch: "@@ -1 +1 @@\n-a\n+b" });
    const pyFile = makeFile({ filename: "script.py", patch: "@@ -1 +1 @@\n-a\n+b" });
    const goFile = makeFile({ filename: "main.go", patch: "@@ -1 +1 @@\n-a\n+b" });

    expect(chunkFile(tsFile)[0].language).toBe("typescript");
    expect(chunkFile(pyFile)[0].language).toBe("python");
    expect(chunkFile(goFile)[0].language).toBe("go");
  });
});

// ─── detectLanguage ─────────────────────────────────────────

describe("detectLanguage", () => {
  const cases: [string, string][] = [
    ["file.ts", "typescript"],
    ["file.tsx", "typescript"],
    ["file.js", "javascript"],
    ["file.jsx", "javascript"],
    ["file.py", "python"],
    ["file.go", "go"],
    ["file.rs", "rust"],
    ["file.java", "java"],
    ["file.rb", "ruby"],
    ["file.php", "php"],
    ["file.cs", "csharp"],
    ["file.cpp", "cpp"],
    ["file.c", "c"],
    ["file.swift", "swift"],
    ["file.kt", "kotlin"],
    ["file.sql", "sql"],
    ["file.sh", "shell"],
    ["file.yml", "yaml"],
    ["file.yaml", "yaml"],
    ["file.json", "json"],
    ["file.md", "markdown"],
    ["file.html", "html"],
    ["file.css", "css"],
    ["path/to/Dockerfile", "docker"],
    ["file.unknown", "text"],
    ["file", "text"],
  ];

  it.each(cases)("detects %s as %s", (filename, expected) => {
    expect(detectLanguage(filename)).toBe(expected);
  });
});
