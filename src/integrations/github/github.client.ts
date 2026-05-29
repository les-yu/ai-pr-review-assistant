import { createLogger } from "@/infrastructure/logger/logger";
import { env } from "@/infrastructure/config/env";
import type {
  PRData,
  PullRequestInfo,
  ChangedFile,
  CommitInfo,
} from "@/types/github";
import type {
  GitHubPRResponse,
  GitHubFileResponse,
  GitHubCommitResponse,
  RateLimitInfo,
} from "./github.types";
import {
  GitHubApiError,
  RateLimitExceededError,
  GitHubAuthError,
} from "./github.types";
import { parsePRUrl } from "./github.parser";

const log = createLogger("github.client");

const GITHUB_API = "https://api.github.com";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ai-pr-review-assistant",
  };
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }
  return headers;
}

function parseRateLimitHeaders(headers: Headers): RateLimitInfo {
  return {
    limit: parseInt(headers.get("X-RateLimit-Limit") ?? "60", 10),
    remaining: parseInt(headers.get("X-RateLimit-Remaining") ?? "60", 10),
    reset: parseInt(headers.get("X-RateLimit-Reset") ?? "0", 10),
    used: parseInt(headers.get("X-RateLimit-Used") ?? "0", 10),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchGitHub<T>(
  endpoint: string,
  options: { accept?: string; maxRetries?: number } = {}
): Promise<T> {
  const { accept, maxRetries = DEFAULT_MAX_RETRIES } = options;
  const url = `${GITHUB_API}${endpoint}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const headers = getHeaders();
    if (accept) {
      headers.Accept = accept;
    }

    log.debug({ url, attempt }, "GitHub API request");

    const response = await fetch(url, { headers });
    const rateLimitInfo = parseRateLimitHeaders(response.headers);

    // Log rate limit status on every request
    if (rateLimitInfo.remaining < 10) {
      log.warn(
        {
          remaining: rateLimitInfo.remaining,
          limit: rateLimitInfo.limit,
          reset: new Date(rateLimitInfo.reset * 1000).toISOString(),
        },
        "GitHub API rate limit running low"
      );
    }

    // Success
    if (response.ok) {
      return response.json() as Promise<T>;
    }

    // Rate limit exceeded - wait and retry
    if (response.status === 403 && rateLimitInfo.remaining === 0) {
      const resetAt = new Date(rateLimitInfo.reset * 1000);
      const waitMs = Math.max(resetAt.getTime() - Date.now(), 1000);

      if (attempt < maxRetries) {
        log.warn(
          { waitMs, resetAt: resetAt.toISOString(), attempt },
          "Rate limited, waiting before retry"
        );
        await sleep(Math.min(waitMs, 60_000)); // Cap at 60s
        continue;
      }

      throw new RateLimitExceededError(resetAt, endpoint);
    }

    // Auth error - don't retry
    if (response.status === 401) {
      throw new GitHubAuthError(endpoint);
    }

    // 404 - don't retry
    if (response.status === 404) {
      throw new GitHubApiError(
        `Resource not found: ${endpoint}`,
        404,
        endpoint,
        rateLimitInfo
      );
    }

    // Server errors (5xx) - retry with backoff
    if (response.status >= 500 && attempt < maxRetries) {
      const delay = DEFAULT_RETRY_DELAY_MS * Math.pow(2, attempt);
      log.warn(
        { status: response.status, attempt, delay },
        "Server error, retrying with backoff"
      );
      await sleep(delay);
      continue;
    }

    // Other errors - throw immediately
    throw new GitHubApiError(
      `GitHub API error: ${response.status} ${response.statusText}`,
      response.status,
      endpoint,
      rateLimitInfo
    );
  }

  throw new GitHubApiError(
    `GitHub API request failed after ${maxRetries + 1} attempts`,
    0,
    endpoint
  );
}

// Overload for diff endpoint which returns text
async function fetchGitHubText(endpoint: string): Promise<string> {
  const url = `${GITHUB_API}${endpoint}`;
  const headers = {
    ...getHeaders(),
    Accept: "application/vnd.github.v3.diff",
  };

  log.debug({ url }, "GitHub API diff request");

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const rateLimitInfo = parseRateLimitHeaders(response.headers);
    throw new GitHubApiError(
      `Failed to fetch diff: ${response.status}`,
      response.status,
      endpoint,
      rateLimitInfo
    );
  }

  return response.text();
}

export async function fetchPRInfo(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PullRequestInfo> {
  log.info({ owner, repo, prNumber }, "Fetching PR info");

  const data = await fetchGitHub<GitHubPRResponse>(
    `/repos/${owner}/${repo}/pulls/${prNumber}`
  );

  return {
    owner,
    repo,
    prNumber: data.number,
    title: data.title,
    description: data.body,
    author: data.user.login,
    state: data.state,
    baseBranch: data.base.ref,
    headBranch: data.head.ref,
    url: data.html_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number
): Promise<ChangedFile[]> {
  log.info({ owner, repo, prNumber }, "Fetching PR files");

  const allFiles: GitHubFileResponse[] = [];
  let page = 1;
  const perPage = 100;

  // Paginate through all files
  while (true) {
    const data = await fetchGitHub<GitHubFileResponse[]>(
      `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`
    );

    allFiles.push(...data);

    if (data.length < perPage) break;
    page++;

    if (page > 10) {
      log.warn(
        { fileCount: allFiles.length },
        "Reached pagination limit (1000 files)"
      );
      break;
    }
  }

  log.info({ fileCount: allFiles.length }, "Fetched PR files");

  return allFiles.map((file) => ({
    filename: file.filename,
    status: file.status as ChangedFile["status"],
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: file.patch ?? "",
    previousFilename: file.previous_filename,
  }));
}

export async function fetchPRCommits(
  owner: string,
  repo: string,
  prNumber: number
): Promise<CommitInfo[]> {
  log.info({ owner, repo, prNumber }, "Fetching PR commits");

  const data = await fetchGitHub<GitHubCommitResponse[]>(
    `/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=100`
  );

  return data.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.commit.author.name,
    date: commit.commit.author.date,
  }));
}

export async function fetchPRDiff(
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  log.info({ owner, repo, prNumber }, "Fetching PR diff");

  return fetchGitHubText(`/repos/${owner}/${repo}/pulls/${prNumber}`);
}

export async function fetchFullPRData(prUrl: string): Promise<PRData> {
  const { owner, repo, prNumber } = parsePRUrl(prUrl);

  log.info({ owner, repo, prNumber, prUrl }, "Fetching full PR data");

  const [info, files, commits, diff] = await Promise.all([
    fetchPRInfo(owner, repo, prNumber),
    fetchPRFiles(owner, repo, prNumber),
    fetchPRCommits(owner, repo, prNumber),
    fetchPRDiff(owner, repo, prNumber),
  ]);

  log.info(
    {
      owner,
      repo,
      prNumber,
      fileCount: files.length,
      commitCount: commits.length,
      diffLength: diff.length,
    },
    "Full PR data fetched"
  );

  return { info, files, commits, diff };
}
