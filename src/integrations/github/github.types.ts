export interface ParsedPRUrl {
  owner: string;
  repo: string;
  prNumber: number;
}

export interface GitHubPRResponse {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: { login: string };
  base: { ref: string };
  head: { ref: string };
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubFileResponse {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
}

export interface GitHubClientConfig {
  token: string;
  baseUrl?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  used: number;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
    public readonly rateLimitInfo?: RateLimitInfo
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class RateLimitExceededError extends GitHubApiError {
  constructor(
    public readonly resetAt: Date,
    endpoint: string
  ) {
    super(
      `GitHub API rate limit exceeded. Resets at ${resetAt.toISOString()}`,
      403,
      endpoint
    );
    this.name = "RateLimitExceededError";
  }
}

export class GitHubAuthError extends GitHubApiError {
  constructor(endpoint: string) {
    super("GitHub authentication failed. Check your GITHUB_TOKEN.", 401, endpoint);
    this.name = "GitHubAuthError";
  }
}
