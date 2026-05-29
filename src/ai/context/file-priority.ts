import type { ChangedFile } from "@/types/github";
import type { FilePriority } from "./context.types";

interface PriorityRule {
  pattern: RegExp;
  score: number;
  reason: string;
}

const PRIORITY_RULES: PriorityRule[] = [
  // Security-sensitive (high score)
  { pattern: /auth|security|password|secret|token|credential|crypt|hash|session/i, score: 10, reason: "security-sensitive" },
  { pattern: /\.sql$|migration/i, score: 8, reason: "database/migration" },
  { pattern: /middleware|interceptor|guard|policy/i, score: 7, reason: "access-control" },
  { pattern: /config|env|setting/i, score: 5, reason: "configuration" },

  // Core business logic (medium score)
  { pattern: /service|controller|handler|resolver/i, score: 4, reason: "business-logic" },
  { pattern: /model|schema|entity|dto/i, score: 3, reason: "data-model" },
  { pattern: /route|router|api/i, score: 3, reason: "api-routing" },

  // Low priority
  { pattern: /test|spec|__test__|__spec__|\.test\.|\.spec\./i, score: -5, reason: "test-file" },
  { pattern: /\.md$|\.txt$|\.json$|\.ya?ml$/i, score: -3, reason: "config/docs" },
  { pattern: /readme|changelog|license/i, score: -5, reason: "docs" },
  { pattern: /fixture|mock|stub|fake/i, score: -4, reason: "test-fixture" },
  { pattern: /style|css|scss|less|tailwind/i, score: -2, reason: "styling" },
  { pattern: /generated|auto|\.gen\./i, score: -6, reason: "generated-code" },
];

/**
 * Calculate priority score for a file based on its path and changes.
 */
export function calculateFilePriority(file: ChangedFile): {
  score: number;
  level: FilePriority;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // Apply path-based rules
  for (const rule of PRIORITY_RULES) {
    if (rule.pattern.test(file.filename)) {
      score += rule.score;
      reasons.push(rule.reason);
    }
  }

  // Change size bonus: large changes need more scrutiny
  if (file.changes > 200) {
    score += 3;
    reasons.push("large-change");
  } else if (file.changes > 50) {
    score += 1;
    reasons.push("medium-change");
  }

  // New files need attention
  if (file.status === "added") {
    score += 2;
    reasons.push("new-file");
  }

  // Deleted files are less risky
  if (file.status === "removed") {
    score -= 2;
    reasons.push("deleted-file");
  }

  // Clamp score
  score = Math.max(0, Math.min(20, score));

  const level: FilePriority =
    score >= 10 ? "critical" :
    score >= 6 ? "high" :
    score >= 3 ? "medium" : "low";

  return { score, level, reasons };
}

/**
 * Sort files by priority (highest first).
 */
export function sortByPriority(files: ChangedFile[]): ChangedFile[] {
  return [...files].sort((a, b) => {
    const scoreA = calculateFilePriority(a).score;
    const scoreB = calculateFilePriority(b).score;
    return scoreB - scoreA;
  });
}
