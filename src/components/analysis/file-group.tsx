import { SeverityBadge } from "./severity-badge";
import type { ReviewCommentData } from "@/types/analysis";

const severityOrder: Record<string, number> = {
  CRITICAL: 0,
  ERROR: 1,
  WARNING: 2,
  INFO: 3,
};

function worstSeverity(comments: ReviewCommentData[]): string {
  let worst = "INFO";
  for (const c of comments) {
    if ((severityOrder[c.severity] ?? 99) < (severityOrder[worst] ?? 99)) {
      worst = c.severity;
    }
  }
  return worst;
}

export function FileGroup({
  filePath,
  comments,
  defaultOpen = false,
}: {
  filePath: string;
  comments: ReviewCommentData[];
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border">
      <summary className="flex cursor-pointer items-center gap-3 p-3 text-sm font-medium hover:bg-muted/50 select-none">
        <span className="text-muted-foreground transition-transform group-open:rotate-90">
          ▶
        </span>
        <span className="font-mono text-xs flex-1 truncate">{filePath}</span>
        <span className="text-xs text-muted-foreground">
          {comments.length} 个问题
        </span>
        <SeverityBadge severity={worstSeverity(comments)} />
      </summary>
      <div className="border-t">
        {comments.map((comment, i) => (
          <div
            key={`${comment.lineStart}:${comment.ruleId}:${i}`}
            className="flex gap-3 border-b p-3 text-sm last:border-b-0"
          >
            <div className="flex flex-col items-center gap-1 pt-0.5">
              <SeverityBadge severity={comment.severity} />
              <span className="text-xs text-muted-foreground">
                {comment.source}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">
                  {comment.category}
                </span>
                {comment.lineStart != null && (
                  <span className="text-xs text-muted-foreground">
                    :{comment.lineStart}
                  </span>
                )}
              </div>
              <p>{comment.message}</p>
              {comment.suggestion && (
                <p className="mt-1 text-muted-foreground text-xs">
                  建议：{comment.suggestion}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
