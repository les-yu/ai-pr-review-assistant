import { cn } from "@/lib/utils";
import type { CommentSeverity } from "@/generated/prisma/client";

const severityStyles: Record<string, string> = {
  CRITICAL: "bg-red-600 text-white",
  ERROR: "bg-orange-500 text-white",
  WARNING: "bg-yellow-400 text-black",
  INFO: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
};

const severityLabels: Record<string, string> = {
  CRITICAL: "严重",
  ERROR: "错误",
  WARNING: "警告",
  INFO: "提示",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: CommentSeverity | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        severityStyles[severity] ?? "bg-gray-200 text-gray-700",
        className
      )}
    >
      {severityLabels[severity] ?? severity}
    </span>
  );
}
