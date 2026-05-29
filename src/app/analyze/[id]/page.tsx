"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnalysisStatus } from "@/components/analysis/analysis-status";
import { RiskScoreCard } from "@/components/analysis/risk-score-card";
import { CommentList } from "@/components/analysis/comment-list";
import { SeverityBadge } from "@/components/analysis/severity-badge";
import type { AnalysisResult, AnalysisStatusType } from "@/types/analysis";

export default function AnalyzePage() {
  const params = useParams();
  const id = params.id as string;

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let active = true;
    let interval: ReturnType<typeof setInterval>;

    async function fetchResult() {
      try {
        const res = await fetch(`/api/result/${id}`);
        const data = await res.json();

        if (!active) return;

        if (data.success) {
          setResult(data.data);
          const status = data.data.status as AnalysisStatusType;
          if (status === "COMPLETED" || status === "FAILED") {
            clearInterval(interval);
            setLoading(false);
          }
        } else {
          setError(data.error ?? "Failed to fetch result");
          clearInterval(interval);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError("Failed to fetch result");
          clearInterval(interval);
          setLoading(false);
        }
      }
    }

    fetchResult();
    interval = setInterval(fetchResult, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{error}</p>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Back to Home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !result) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">
              {result?.status === "ANALYZING"
                ? "Analysis in progress..."
                : "Waiting for analysis to start..."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result.status === "FAILED") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Analysis Failed</CardTitle>
              <AnalysisStatus status="FAILED" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive">
              {result.errorMessage ?? "An unknown error occurred"}
            </p>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Back to Home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Analysis Result</h1>
          <div className="flex items-center gap-3">
            <AnalysisStatus status={result.status} />
            <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
              New Analysis
            </Link>
          </div>
        </div>

        {result.summary && (
          <Card>
            <CardContent className="py-4">
              <p>{result.summary}</p>
            </CardContent>
          </Card>
        )}

        {result.comments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Severity:</span>
            {(["CRITICAL", "ERROR", "WARNING", "INFO"] as const).map(
              (sev) => {
                const count = result.comments.filter(
                  (c) => c.severity === sev
                ).length;
                if (count === 0) return null;
                return (
                  <span key={sev} className="flex items-center gap-1">
                    <SeverityBadge severity={sev} />
                    <span className="text-muted-foreground">&times;{count}</span>
                  </span>
                );
              }
            )}
          </div>
        )}

        {result.riskScore && <RiskScoreCard riskScore={result.riskScore} />}

        <CommentList comments={result.comments} />
      </div>
    </div>
  );
}
