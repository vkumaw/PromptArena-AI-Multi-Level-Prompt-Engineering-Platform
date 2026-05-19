import mongoose from "mongoose";
import UserData from "../models/userData.js";
import { buildLeaderboard } from "../services/leaderboardService.js";

function isAggregatedEntry(row) {
  return (
    row &&
    typeof row === "object" &&
    typeof row.rank === "number" &&
    Number.isFinite(row.rank) &&
    typeof row.score === "number" &&
    Number.isFinite(row.score)
  );
}

function isRawUserDataDoc(row) {
  return (
    row &&
    typeof row === "object" &&
    row._id != null &&
    row.rank === undefined &&
    (row.prompt != null || row.generatedCode != null)
  );
}

function ensureAggregatedShape(row) {
  const username =
    typeof row.username === "string" && row.username.trim()
      ? row.username.trim()
      : row.userId
        ? `User_${String(row.userId).slice(-6)}`
        : "Unknown User";
  return { ...row, username };
}

/**
 * GET /api/leaderboard — always returns aggregated { rank, username, score, ... }.
 * Never returns raw UserData attempt documents.
 */
export async function getLeaderboard(req, res) {
  try {
    const totalAttempts = await UserData.countDocuments();
    const level1Count = await UserData.countDocuments({ level: 1 });
    const level3Count = await UserData.countDocuments({ level: 3 });
    const level2Count = totalAttempts - level1Count - level3Count;

    console.log("[leaderboard] GET /api/leaderboard — v2 aggregated handler");
    console.log("[leaderboard] collection counts:", {
      db: mongoose.connection.name,
      totalAttempts,
      level1Count,
      level2Count,
      level3Count,
    });

    const entries = await buildLeaderboard();
    console.log("[leaderboard] buildLeaderboard result count:", entries.length);
    if (entries[0]) {
      console.log("[leaderboard] sample entry:", {
        rank: entries[0].rank,
        username: entries[0].username,
        score: entries[0].score,
        userId: entries[0].userId,
      });
    }

    const payload = entries.filter(isAggregatedEntry).map(ensureAggregatedShape);

    if (payload.some(isRawUserDataDoc)) {
      console.error("[leaderboard] BLOCKED: raw UserData shape in payload");
      return res.status(500).json({
        error: "Leaderboard aggregation misconfigured",
      });
    }

    if (payload.length !== entries.length) {
      console.warn(
        "[leaderboard] dropped invalid rows:",
        entries.length - payload.length
      );
    }

    if (totalAttempts > 0 && payload.length === 0) {
      console.error(
        "[leaderboard] WARNING: attempts in DB but aggregated payload is empty"
      );
    }

    console.log("[leaderboard] final response length:", payload.length);
    res.json(payload);
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ error: err.message });
  }
}
