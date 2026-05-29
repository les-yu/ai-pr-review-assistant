import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileGroup } from "./file-group";
import type { ReviewCommentData } from "@/types/analysis";

const severityOrder: Record<string, number> = {
  CRITICAL: 0,
  ERROR: 1,
  WARNING: 2,
  INFO: 3,
};

function groupByFile(
  comments: ReviewCommentData[]
): Map<string, ReviewCommentData[]> {
  const grouped = new Map<string, ReviewCommentData[]>();
  for (const comment of comments) {
    const existing = grouped.get(comment.filePath) ?? [];
    existing.push(comment);
    grouped.set(comment.filePath, existing);
  }
  return grouped;
}

function sortByWorstSeverity(
  a: [string, ReviewCommentData[]],
  b: [string, ReviewCommentData[]]
): number {
  const getWorst = (comments: ReviewCommentData[]) =>
    Math.min(...comments.map((c) => severityOrder[c.severity] ?? 99));
  return getWorst(a[1]) - getWorst(b[1]);
}

export function CommentList({
  comments,
}: {
  comments: ReviewCommentData[];
}) {
  if (comments.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No issues found.
        </CardContent>
      </Card>
    );
  }

  const grouped = Array.from(groupByFile(comments).entries()).sort(
    sortByWorstSeverity
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Issues ({comments.length} across {grouped.length}{" "}
          {grouped.length === 1 ? "file" : "files"})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {grouped.map(([filePath, fileComments], i) => (
            <FileGroup
              key={filePath}
              filePath={filePath}
              comments={fileComments}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
