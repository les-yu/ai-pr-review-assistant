import { Badge } from "@/components/ui/badge";
import type { AnalysisStatusType } from "@/types/analysis";

const statusConfig: Record<
  AnalysisStatusType,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "等待中", variant: "secondary" },
  ANALYZING: { label: "分析中", variant: "default" },
  COMPLETED: { label: "已完成", variant: "outline" },
  FAILED: { label: "失败", variant: "destructive" },
};

export function AnalysisStatus({ status }: { status: AnalysisStatusType }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
