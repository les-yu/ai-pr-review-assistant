import { describe, it, expect } from "vitest";
import { calculateFilePriority, sortByPriority } from "../file-priority";
import type { ChangedFile } from "@/types/github";

function makeFile(overrides: Partial<ChangedFile> = {}): ChangedFile {
  return {
    filename: "src/example.ts",
    status: "modified",
    additions: 5,
    deletions: 3,
    changes: 8,
    patch: "",
    ...overrides,
  };
}

// ─── calculateFilePriority ──────────────────────────────────

describe("calculateFilePriority", () => {
  describe("security-sensitive files", () => {
    it("scores auth files as critical", () => {
      const result = calculateFilePriority(makeFile({ filename: "src/auth/login.ts" }));
      expect(result.level).toBe("critical");
      expect(result.reasons).toContain("security-sensitive");
    });

    it("scores password-related files high", () => {
      const result = calculateFilePriority(makeFile({ filename: "src/utils/password-reset.ts" }));
      expect(result.score).toBeGreaterThanOrEqual(10);
    });

    it("scores token files high", () => {
      const result = calculateFilePriority(makeFile({ filename: "src/middleware/token-verify.ts" }));
      expect(result.score).toBeGreaterThanOrEqual(10);
    });

    it("scores migration files high", () => {
      const result = calculateFilePriority(makeFile({ filename: "prisma/migrations/001_init.sql" }));
      expect(result.score).toBeGreaterThanOrEqual(8);
      expect(result.reasons).toContain("database/migration");
    });

    it("scores middleware files high or critical", () => {
      const result = calculateFilePriority(makeFile({ filename: "src/middleware/auth.ts" }));
      expect(["high", "critical"]).toContain(result.level);
    });
  });

  describe("low priority files", () => {
    it("scores test files as low", () => {
      const result = calculateFilePriority(makeFile({ filename: "src/utils/helper.test.ts" }));
      expect(result.level).toBe("low");
      expect(result.reasons).toContain("test-file");
    });

    it("scores spec files as low", () => {
      const result = calculateFilePriority(makeFile({ filename: "src/components/Button.spec.tsx" }));
      expect(result.level).toBe("low");
    });

    it("scores markdown files as low", () => {
      const result = calculateFilePriority(makeFile({ filename: "README.md" }));
      expect(result.level).toBe("low");
      expect(result.reasons).toContain("config/docs");
    });

    it("scores generated code very low", () => {
      const result = calculateFilePriority(makeFile({ filename: "src/generated/types.gen.ts" }));
      expect(result.score).toBeLessThanOrEqual(2);
      expect(result.reasons).toContain("generated-code");
    });

    it("scores fixture files low", () => {
      const result = calculateFilePriority(makeFile({ filename: "tests/fixtures/user-data.ts" }));
      expect(result.level).toBe("low");
      expect(result.reasons).toContain("test-fixture");
    });
  });

  describe("change size adjustments", () => {
    it("adds bonus for large changes (>200 lines)", () => {
      const small = calculateFilePriority(makeFile({ changes: 10 }));
      const large = calculateFilePriority(makeFile({ changes: 250 }));
      expect(large.score).toBeGreaterThanOrEqual(small.score + 3);
      expect(large.reasons).toContain("large-change");
    });

    it("adds small bonus for medium changes (>50 lines)", () => {
      const small = calculateFilePriority(makeFile({ changes: 10 }));
      const medium = calculateFilePriority(makeFile({ changes: 80 }));
      expect(medium.score).toBeGreaterThanOrEqual(small.score + 1);
      expect(medium.reasons).toContain("medium-change");
    });
  });

  describe("status adjustments", () => {
    it("adds score for new files", () => {
      const modified = calculateFilePriority(makeFile({ status: "modified" }));
      const added = calculateFilePriority(makeFile({ status: "added" }));
      expect(added.score).toBe(modified.score + 2);
      expect(added.reasons).toContain("new-file");
    });

    it("subtracts score for deleted files", () => {
      // Use a file with some base score so subtraction is visible
      const modified = calculateFilePriority(makeFile({ filename: "src/service/user.ts", status: "modified" }));
      const removed = calculateFilePriority(makeFile({ filename: "src/service/user.ts", status: "removed" }));
      expect(removed.score).toBe(modified.score - 2);
      expect(removed.reasons).toContain("deleted-file");
    });
  });

  describe("boundary cases", () => {
    it("handles empty filename gracefully", () => {
      const result = calculateFilePriority(makeFile({ filename: "" }));
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.level).toBeDefined();
    });

    it("handles deeply nested paths", () => {
      const result = calculateFilePriority(
        makeFile({ filename: "a/b/c/d/e/f/auth/service.ts" })
      );
      expect(result.reasons).toContain("security-sensitive");
    });

    it("never returns negative score", () => {
      const result = calculateFilePriority(
        makeFile({ filename: "README.md", status: "removed", changes: 1 })
      );
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it("never returns score above 20", () => {
      const result = calculateFilePriority(
        makeFile({
          filename: "src/auth/security/password-token.ts",
          status: "added",
          changes: 500,
        })
      );
      expect(result.score).toBeLessThanOrEqual(20);
    });

    it("handles case-insensitive matching", () => {
      const lower = calculateFilePriority(makeFile({ filename: "src/auth.ts" }));
      const upper = calculateFilePriority(makeFile({ filename: "src/AUTH.ts" }));
      expect(lower.score).toBe(upper.score);
    });
  });
});

// ─── sortByPriority ─────────────────────────────────────────

describe("sortByPriority", () => {
  it("sorts security files before test files", () => {
    const files = [
      makeFile({ filename: "test.spec.ts" }),
      makeFile({ filename: "src/auth/login.ts" }),
      makeFile({ filename: "README.md" }),
    ];

    const sorted = sortByPriority(files);
    expect(sorted[0].filename).toBe("src/auth/login.ts");
  });

  it("preserves original array (immutable)", () => {
    const files = [makeFile({ filename: "b.ts" }), makeFile({ filename: "a.ts" })];
    const sorted = sortByPriority(files);
    expect(sorted).not.toBe(files);
    expect(files[0].filename).toBe("b.ts");
  });

  it("handles empty array", () => {
    expect(sortByPriority([])).toEqual([]);
  });

  it("handles single file", () => {
    const files = [makeFile()];
    expect(sortByPriority(files)).toHaveLength(1);
  });
});
