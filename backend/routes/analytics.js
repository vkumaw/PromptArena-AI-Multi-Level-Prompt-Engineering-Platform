import express from "express";
import UserData from "../models/userData.js";

const router = express.Router();

function avg(nums) {
  const valid = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function formatHistoryDate(ts) {
  if (!ts) return "Unknown";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

router.get("/", async (req, res) => {
  try {
    const userId = (req.query.userId || "guest-user").toString();

    const rows = await UserData.find({ userId }).sort({ timestamp: 1 });

    const totalPrompts = rows.length;

    const scores = rows.map((r) => r.effectivenessScore ?? 0);
    const averageScore = avg(scores);

    const successRate =
      totalPrompts > 0
        ? Math.round(
            (rows.filter((r) => (r.effectivenessScore ?? 0) >= 70).length /
              totalPrompts) *
              100
          )
        : 0;

    let improvement = 0;
    if (rows.length >= 2) {
      const first = rows[0].effectivenessScore ?? 0;
      const last = rows[rows.length - 1].effectivenessScore ?? 0;
      improvement = Math.round(last - first);
    }

    const historySlice = rows.slice(-30);
    const scoreHistory = historySlice.map((row) => ({
      date: formatHistoryDate(row.timestamp),
      score: row.effectivenessScore ?? 0,
    }));

    const promptQualityValues = rows.flatMap((r) =>
      [r.promptScore, r.structureScore, r.effectivenessScore].filter(
        (n) => typeof n === "number"
      )
    );

    const reliabilityScores = rows
      .map((r) => r.reliabilityScore)
      .filter((n) => typeof n === "number");

    const ethicsScores = rows
      .map((r) => r.ethicalScore)
      .filter((n) => typeof n === "number");

    const categoryBreakdown = [
      {
        category: "Prompt Quality",
        score:
          promptQualityValues.length > 0
            ? avg(promptQualityValues)
            : averageScore,
      },
      {
        category: "Reliability",
        score:
          reliabilityScores.length > 0 ? avg(reliabilityScores) : averageScore,
      },
      {
        category: "Ethics",
        score: ethicsScores.length > 0 ? avg(ethicsScores) : averageScore,
      },
    ];

    res.json({
      totalPrompts,
      successRate,
      averageScore,
      improvement,
      scoreHistory,
      categoryBreakdown,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch analytics data",
    });
  }
});

export default router;
