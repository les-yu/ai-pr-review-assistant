import { createLogger } from "@/infrastructure/logger/logger";
import { env } from "@/infrastructure/config/env";
import type { PRData, PullRequestInfo, ChangedFile, CommitInfo } from "@/types/github";
import type {
  GitHubPRResponse,
  GitHubFileResponse,
  GitHubCommitResponse,
} from "./github.types";
import { parsePRUrl } from "./github.parser";

const log = createLogger("github.client");

const GITHUB_API = "https://api.github.com";

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ai-pr-review-assistant",
  };
  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function fetchGitHub<T>(endpoint: string): Promise<T> {
  const url = `${GITHUB_API}${endpoint}`;
  log.debug({ url }, "Fetching GitHub API");

  const response = await fetch(url, { headers: getHeaders() });

  if (response.status === 403) {
    const rateLimitReset = response.headers.get("X-RateLimit-Reset");
    throw new Error(
      `GitHub API rate limit exceeded. Resets at: ${rateLimitReset}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

export async function fetchPRInfo(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PullRequestInfo> {
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
  const data = await fetchGitHub<GitHubFileResponse[]>(
    `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`
  );

  return data.map((file) => ({
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
  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = await fetch(url, {
    headers: {
      ...getHeaders(),
      Accept: "application/vnd.github.v3.diff",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PR diff: ${response.status}`);
  }

  return response.text();
}

export async function fetchFullPRData(prUrl: string): Promise<PRData> {
  const { owner, repo, prNumber } = parsePRUrl(prUrl);

  log.info({ owner, repo, prNumber }, "Fetching full PR data");

  const [info, files, commits, diff] = await Promise.all([
    fetchPRInfo(owner, repo, prNumber),
    fetchPRFiles(owner, repo, prNumber),
    fetchPRCommits(owner, repo, prNumber),
    fetchPRDiff(owner, repo, prNumber),
  ]);

  return { info, files, commits, diff };
}
