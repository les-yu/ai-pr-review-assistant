import { createLogger } from "@/infrastructure/logger/logger";
import type { ParsedPRUrl } from "./github.types";

const log = createLogger("github.parser");

// Matches: https://github.com/owner/repo/pull/123
// Also handles trailing slashes, query params, and hash fragments
const PR_URL_PATTERN =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#]|$)/;

export function parsePRUrl(url: string): ParsedPRUrl {
  const trimmed = url.trim();
  const match = trimmed.match(PR_URL_PATTERN);

  if (!match) {
    log.error({ url: trimmed }, "Invalid PR URL format");
    throw new Error(
      `Invalid GitHub PR URL: "${trimmed}". Expected format: https://github.com/{owner}/{repo}/pull/{number}`
    );
  }

  const parsed: ParsedPRUrl = {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10),
  };

  log.debug({ parsed }, "Parsed PR URL");
  return parsed;
}

export function isValidPRUrl(url: string): boolean {
  try {
    parsePRUrl(url);
    return true;
  } catch {
    return false;
  }
}
