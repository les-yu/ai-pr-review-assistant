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
}
