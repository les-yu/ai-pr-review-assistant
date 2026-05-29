export interface PullRequestInfo {
  owner: string;
  repo: string;
  prNumber: number;
  title: string;
  description: string | null;
  author: string;
  state: string;
  baseBranch: string;
  headBranch: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangedFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed";
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  previousFilename?: string;
}

export interface DiffChunk {
  filename: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNumber: number;
  oldLineNumber?: number;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface PRData {
  info: PullRequestInfo;
  files: ChangedFile[];
  commits: CommitInfo[];
  diff: string;
}
