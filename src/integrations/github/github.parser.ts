import { createLogger } from "@/infrastructure/logger/logger";

const log = createLogger("github.parser");

export interface ParsedPRUrl {
  owner: string;
  repo: string;
  prNumber: number;
}

const PR_URL_PATTERN =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

export function parsePRUrl(url: string): ParsedPRUrl {
  const match = url.match(PR_URL_PATTERN);
  if (!match) {
    log.error({ url }, "Invalid PR URL format");
    throw new Error(
      `Invalid GitHub PR URL: ${url}. Expected format: https://github.com/{owner}/{repo}/pull/{number}`
    );
  }

  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10),
  };
}
