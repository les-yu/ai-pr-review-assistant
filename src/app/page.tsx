"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  const [prUrl, setPrUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!prUrl.includes("github.com") || !prUrl.includes("/pull/")) {
      setError("请输入有效的 GitHub PR 链接");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl }),
      });

      const data = await response.json();
      if (data.success) {
        router.push(`/analyze/${data.data.analysisId}`);
      } else {
        setError(data.error ?? "分析失败");
      }
    } catch {
      setError("启动分析失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            AI PR 代码审查助手
          </CardTitle>
          <CardDescription>
            粘贴 GitHub Pull Request 链接，获取 AI 驱动的代码审查
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              type="url"
              placeholder="https://github.com/owner/repo/pull/123"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "正在启动分析..." : "开始分析"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
