import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReviewCommentData } from "@/types/analysis";

const severityVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  CRITICAL: "destructive",
  ERROR: "destructive",
  WARNING: "default",
  INFO: "secondary",
};

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Issues ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {comments.map((comment, i) => (
            <div
              key={`${comment.filePath}:${comment.lineStart}:${i}`}
              className="rounded-md border p-3 text-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={severityVariant[comment.severity] ?? "outline"}>
                  {comment.severity}
                </Badge>
                <span className="text-muted-foreground">{comment.category}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {comment.source}
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground mb-1">
                {comment.filePath}
                {comment.lineStart != null && `:${comment.lineStart}`}
              </p>
              <p>{comment.message}</p>
              {comment.suggestion && (
                <p className="mt-1 text-muted-foreground text-xs">
                  Suggestion: {comment.suggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
