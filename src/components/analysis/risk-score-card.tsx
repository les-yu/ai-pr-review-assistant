import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { RiskScore } from "@/types/analysis";

const levelColors: Record<string, string> = {
  low: "text-green-600",
  medium: "text-yellow-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

export function RiskScoreCard({ riskScore }: { riskScore: RiskScore }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Risk Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">{riskScore.overall}</span>
          <span className="text-muted-foreground">/ 100</span>
          <span
            className={`ml-auto text-sm font-semibold uppercase ${levelColors[riskScore.level] ?? ""}`}
          >
            {riskScore.level}
          </span>
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-3 text-sm">
          {Object.entries(riskScore.breakdown).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="capitalize text-muted-foreground">{key}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
