import { describe, it, expect } from "vitest";
import { SqlInjectionRule } from "../sql-injection.rule";
import type { CodeChunk } from "@/ai/context/context.types";

const rule = new SqlInjectionRule();

function makeChunk(content: string): CodeChunk {
  return {
    id: "test:0", filePath: "src/db.ts", content,
    startLine: 1, endLine: 20, type: "diff", language: "typescript", priority: 0,
  };
}

describe("SqlInjectionRule", () => {
  it("detects template literal SQL injection", () => {
    const findings = rule.apply(makeChunk(
      '+const query = `SELECT * FROM users WHERE id = ${userId}`'
    ));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("CRITICAL");
  });

  it("detects string concatenation SQL injection", () => {
    const findings = rule.apply(makeChunk(
      '+const query = "SELECT * FROM " + table + " WHERE id = " + id'
    ));
    expect(findings).toHaveLength(1);
  });

  it("detects INSERT injection", () => {
    const findings = rule.apply(makeChunk(
      '+db.exec(`INSERT INTO logs (msg) VALUES (${message})`)'
    ));
    expect(findings).toHaveLength(1);
  });

  it("does NOT flag parameterized queries with ?", () => {
    const findings = rule.apply(makeChunk(
      '+db.query("SELECT * FROM users WHERE id = ?", [userId])'
    ));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag parameterized queries with $1", () => {
    const findings = rule.apply(makeChunk(
      '+db.query("SELECT * FROM users WHERE id = $1", [userId])'
    ));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag Prisma tagged templates", () => {
    const findings = rule.apply(makeChunk(
      "+const result = await prisma.$queryRaw`SELECT * FROM users`"
    ));
    expect(findings).toHaveLength(0);
  });

  it("does NOT flag non-SQL string interpolation", () => {
    const findings = rule.apply(makeChunk(
      '+const msg = `Hello ${name}, welcome!`'
    ));
    expect(findings).toHaveLength(0);
  });
});
