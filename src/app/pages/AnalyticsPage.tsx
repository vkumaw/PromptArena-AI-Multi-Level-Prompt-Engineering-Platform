import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import {
  TrendingUp,
  Target,
  Award,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

import { apiClient } from "../services/api";
import type { AnalyticsResponse } from "../services/contracts";
import { authService } from "../utils/auth";

export function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const user = authService.getCurrentUser();
        const userId = user?.id ?? "guest-user";
        const data = await apiClient.fetchAnalytics(userId);
        setAnalytics(data);
      } catch (error) {
        console.error("Failed to load analytics:", error);
        setLoadError("Unable to load analytics. Try again later.");
        setAnalytics(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadAnalytics();
  }, []);

  const totalPrompts = analytics?.totalPrompts ?? 0;
  const successRate = analytics?.successRate ?? 0;
  const averageScore = analytics?.averageScore ?? 0;
  const improvement = analytics?.improvement ?? 0;
  const improvementLabel =
    improvement > 0 ? `+${improvement}` : `${improvement}`;

  const scoreHistory = analytics?.scoreHistory ?? [];
  const categoryBreakdown = analytics?.categoryBreakdown ?? [
    { category: "Prompt Quality", score: 0 },
    { category: "Reliability", score: 0 },
    { category: "Ethics", score: 0 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        
        <div className="mb-8">
          

          <h1 className="text-3xl font-bold text-white mb-2">
  Performance Analytics
</h1>

          <p className="text-muted-foreground">
            Analyze prompt quality, reliability, and overall performance trends
          </p>
          {loadError ? (
            <p className="text-sm text-red-500 mt-2">{loadError}</p>
          ) : null}
          {!isLoading && totalPrompts === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">
              No submissions yet. Complete Level 1–3 exercises to see your stats
              here.
            </p>
          ) : null}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {/* Total Prompts */}
          <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-blue-500/20">
                <BarChart3 className="size-5 text-blue-500" />
              </div>
              <span className="text-sm text-muted-foreground">
                All Time
              </span>
            </div>

            <div className="text-4xl font-bold mb-1">
              {totalPrompts}
            </div>

            <div className="text-sm text-muted-foreground">
              Total Prompts Submitted
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Target className="size-5 text-green-500" />
              </div>
              <span className="text-sm text-muted-foreground">
                This Month
              </span>
            </div>

            <div className="text-4xl font-bold mb-1">
              {successRate}%
            </div>

            <div className="text-sm text-muted-foreground">
              Success Rate
            </div>
          </div>

          {/* Average Score */}
          <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-violet-500/20">
                <Award className="size-5 text-violet-500" />
              </div>
              <span className="text-sm text-muted-foreground">
                Average
              </span>
            </div>

            <div className="text-4xl font-bold mb-1">
              {averageScore}/100
            </div>

            <div className="text-sm text-muted-foreground">
              Average Score
            </div>
          </div>

          {/* Improvement */}
          <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-orange-500/20">
                <TrendingUp className="size-5 text-orange-500" />
              </div>
              <span className="text-sm text-muted-foreground">
                vs Last Month
              </span>
            </div>

            <div className="text-4xl font-bold mb-1">
              {improvementLabel}%
            </div>

            <div className="text-sm text-muted-foreground">
              Improvement
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Score Over Time */}
          <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
            <h2 className="text-xl font-semibold mb-6">
              Score Over Time
            </h2>

            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={
                  scoreHistory.length > 0
                    ? scoreHistory
                    : [{ date: "No data", score: 0 }]
                }
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />

                <XAxis
                  dataKey="date"
                  stroke="#cbd5f5"
                  fontSize={12}
                />

                <YAxis
                  stroke="#cbd5f5"
                  fontSize={12}
                  domain={[0, 100]}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ fill: "#8b5cf6", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
            <h2 className="text-xl font-semibold mb-6">
              Category Breakdown
            </h2>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryBreakdown} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />

                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="#ffffff"
                  tick={{ fill: "#ffffff", fontSize: 12 }}
                />

                <YAxis
                  dataKey="category"
                  type="category"
                  width={120}
                  tick={{ fill: "#ffffff", fontSize: 14 }}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: "#ffffff",
                  }}
                  labelStyle={{
                    color: "#ffffff",
                    fontWeight: "bold",
                  }}
                  itemStyle={{
                    color: "#ffffff",
                  }}
                />

                <Bar
                  dataKey="score"
                  fill="#8b5cf6"
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Skill Assessment */}
        <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
          <h2 className="text-xl font-semibold mb-6">
            Skill Assessment
          </h2>

          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={categoryBreakdown}>
              <PolarGrid />

              <PolarAngleAxis
                dataKey="category"
                tick={{ fill: "#ffffff", fontSize: 14 }}
              />

              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: "#ffffff" }}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />

              <Radar
                name="Skill Score"
                dataKey="score"
                stroke="#a78bfa"
                fill="#8b5cf6"
                fillOpacity={0.6}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}