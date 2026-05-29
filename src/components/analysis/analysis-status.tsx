import { Badge } from "@/components/ui/badge";
import type { AnalysisStatusType } from "@/types/analysis";

const statusConfig: Record<
  AnalysisStatusType,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pending", variant: "secondary" },
  ANALYZING: { label: "Analyzing", variant: "default" },
  COMPLETED: { label: "Completed", variant: "outline" },
  FAILED: { label: "Failed", variant: "destructive" },
};

export function AnalysisStatus({ status }: { status: AnalysisStatusType }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
