import mongoose from "mongoose";
import UserData from "../models/userData.js";
import User from "../models/User.js";
import { level3CodingProblems } from "../../shared/level3CodingProblems.js";

const WEIGHT_L1 = 0.35;
const WEIGHT_L2 = 0.4;
const WEIGHT_L3 = 0.25;

/** Minimum distinct valid problems to appear on the public leaderboard */
const MIN_VALID_PROBLEMS = 1;

const LEADERBOARD_FIELDS =
  "userId problemId level effectivenessScore reliabilityScore ethicalScore testPassRate testCasesPassed totalTestCases timestamp hallucinationDetected";

const groundTruthByProblemId = new Map(
  level3CodingProblems.map((p) => [p.problemId, !!p.groundTruthHallucination])
);

function num(value, fallback = 0) {
  const n = Number(value);
  return typeof n === "number" && !Number.isNaN(n) ? n : fallback;
}

function reliability(row) {
  return num(row.reliabilityScore ?? row.reliability);
}

function effectiveness(row) {
  return num(row.effectivenessScore ?? row.effectiveness);
}

function mean(nums) {
  const valid = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function roundDisplay(n) {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.round(n);
}

/** Normalize userId from String, ObjectId, or nested BSON shapes. */
export function normalizeUserId(raw) {
  if (raw == null || raw === "") return "guest-user";
  if (typeof raw === "string") return raw.trim();
  if (raw instanceof mongoose.Types.ObjectId) return raw.toString();
  if (typeof raw === "object" && raw.$oid) return String(raw.$oid);
  if (typeof raw === "object" && typeof raw.toString === "function") {
    const s = raw.toString();
    if (s && s !== "[object Object]") return s;
  }
  return String(raw).trim();
}

/** Only registered accounts (User collection) are ranked; excludes guest and orphan ids. */
function isRankableUserId(userId, registeredUserIds) {
  if (!userId || userId === "guest-user") return false;
  return registeredUserIds.has(userId);
}

/**
 * Valid problem id for grouping and breadth metrics.
 * Returns null when missing or blank (not collapsed into one fake problem).
 */
function problemKey(row) {
  const pid = row.problemId;
  if (pid == null || pid === "") return null;
  const s = String(pid).trim();
  if (!s) return null;
  return s;
}

/**
 * Level 1: use stored effectiveness only (already blends prompt quality + reliability).
 * Avoids double-counting test pass rate and reliability separately.
 */
function level1AttemptScore(row) {
  return effectiveness(row);
}

function level2ProblemScore(lastRow, attemptCount) {
  const eff = effectiveness(lastRow);
  const rel = reliability(lastRow);
  const efficiencyIndex = attemptCount > 0 ? rel / attemptCount : 0;
  return eff * 0.4 + rel * 0.4 + efficiencyIndex * 0.2;
}

function isLevel3EthicalRow(row) {
  const pid = (row.problemId || "").toString();
  return pid.startsWith("ethical-");
}

function level3EthicalAttemptScore(row) {
  const integrity = effectiveness(row);
  const reasoning = num(row.ethicalScore);
  return integrity * 0.7 + reasoning * 0.3;
}

function level3CodingAttemptScore(row) {
  const composite = effectiveness(row);
  const reasoning = num(row.ethicalScore);
  return composite * 0.65 + reasoning * 0.35;
}

function level3AttemptScore(row) {
  if (isLevel3EthicalRow(row)) return level3EthicalAttemptScore(row);
  return level3CodingAttemptScore(row);
}

function blendLevel3Average(attemptScores, hallucinationAccuracy) {
  const base = mean(attemptScores);
  if (base == null) return null;
  if (hallucinationAccuracy == null) return base;
  return base * 0.85 + hallucinationAccuracy * 0.15;
}

function classifyRow(row) {
  if (row.level === 1) return "l1";
  if (row.level === 3) return "l3";
  return "l2";
}

function groupLevel2ByUserProblem(rows) {
  const map = new Map();
  for (const row of rows) {
    const pid = problemKey(row);
    if (pid == null) continue;
    const uid = normalizeUserId(row.userId);
    const key = `${uid}::${pid}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function computeHallucinationAccuracy(l3CodingRows) {
  let total = 0;
  let correct = 0;

  for (const row of l3CodingRows) {
    if (isLevel3EthicalRow(row)) continue;
    const pid = (row.problemId || "").toString();
    if (!groundTruthByProblemId.has(pid)) continue;
    if (typeof row.hallucinationDetected !== "boolean") continue;

    const gt = groundTruthByProblemId.get(pid);
    total += 1;
    if (row.hallucinationDetected === gt) correct += 1;
  }

  return total > 0 ? roundDisplay((correct / total) * 100) : null;
}

function computeWeightedOverall(avgL1, avgL2, avgL3) {
  let overall = 0;
  let weightSum = 0;
  let levelsCompleted = 0;

  if (avgL1 != null) {
    overall += WEIGHT_L1 * avgL1;
    weightSum += WEIGHT_L1;
    levelsCompleted += 1;
  }
  if (avgL2 != null) {
    overall += WEIGHT_L2 * avgL2;
    weightSum += WEIGHT_L2;
    levelsCompleted += 1;
  }
  if (avgL3 != null) {
    overall += WEIGHT_L3 * avgL3;
    weightSum += WEIGHT_L3;
    levelsCompleted += 1;
  }

  return {
    overallScore: weightSum > 0 ? overall / weightSum : 0,
    levelsCompleted,
    weightSum,
  };
}

async function loadUserDirectory() {
  const usernameById = new Map();
  const users = await User.find({}).select("username").lean();

  for (const user of users) {
    const id = normalizeUserId(user._id);
    const name =
      (typeof user.username === "string" && user.username.trim()) || null;
    if (name) usernameById.set(id, name);
  }

  return usernameById;
}

function displayUsername(userId, usernameById) {
  return usernameById.get(userId) || `User_${userId.slice(-6)}`;
}

function compareEntries(a, b) {
  if (b._overallScoreRaw !== a._overallScoreRaw) {
    return b._overallScoreRaw - a._overallScoreRaw;
  }
  if (b._avgReliabilityRaw !== a._avgReliabilityRaw) {
    return b._avgReliabilityRaw - a._avgReliabilityRaw;
  }
  if (b._sortEfficiency !== a._sortEfficiency) {
    return b._sortEfficiency - a._sortEfficiency;
  }
  if (b.totalProblemsSolved !== a.totalProblemsSolved) {
    return b.totalProblemsSolved - a.totalProblemsSolved;
  }
  if (b.levelsCompleted !== a.levelsCompleted) {
    return b.levelsCompleted - a.levelsCompleted;
  }
  if (b.totalAttempts !== a.totalAttempts) {
    return a.totalAttempts - b.totalAttempts;
  }
  return String(a.userId).localeCompare(String(b.userId));
}

/**
 * Build ranked leaderboard entries from MongoDB UserData + User collections.
 */
export async function buildLeaderboard() {
  const [rows, usernameById] = await Promise.all([
    UserData.find().select(LEADERBOARD_FIELDS).lean(),
    loadUserDirectory(),
  ]);

  const registeredUserIds = new Set(usernameById.keys());

  const byUser = new Map();
  let skippedUnranked = 0;

  for (const row of rows) {
    const userId = normalizeUserId(row.userId);
    if (!isRankableUserId(userId, registeredUserIds)) {
      skippedUnranked += 1;
      continue;
    }
    if (!byUser.has(userId)) {
      byUser.set(userId, { userId, l1: [], l2: [], l3: [] });
    }
    const bucket = byUser.get(userId);
    const kind = classifyRow(row);
    if (kind === "l1") bucket.l1.push(row);
    else if (kind === "l3") bucket.l3.push(row);
    else bucket.l2.push(row);
  }

  const l2Rows = rows.filter(
    (r) =>
      isRankableUserId(normalizeUserId(r.userId), registeredUserIds) &&
      classifyRow(r) === "l2"
  );
  const l2Groups = groupLevel2ByUserProblem(l2Rows);

  const entries = [];

  for (const [userId, bucket] of byUser) {
    const l1Scores = bucket.l1.map(level1AttemptScore);
    const avgLevel1Score = mean(l1Scores);

    const l2ProblemScores = [];
    const l2Efficiencies = [];
    const l2Reliabilities = [];
    const l2Effectivenesses = [];

    for (const [key, problemRows] of l2Groups) {
      if (!key.startsWith(`${userId}::`)) continue;
      const sorted = [...problemRows].sort(
        (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
      );
      const last = sorted[sorted.length - 1];
      const attempts = sorted.length;
      l2ProblemScores.push(level2ProblemScore(last, attempts));
      l2Efficiencies.push(attempts > 0 ? reliability(last) / attempts : 0);
      l2Reliabilities.push(reliability(last));
      l2Effectivenesses.push(effectiveness(last));
    }

    const avgLevel2Score = mean(l2ProblemScores);

    const l3EthicalRows = bucket.l3.filter(isLevel3EthicalRow);
    const l3CodingRows = bucket.l3.filter((r) => !isLevel3EthicalRow(r));

    const l3Scores = bucket.l3.map(level3AttemptScore);
    const hallucinationAccuracy = computeHallucinationAccuracy(l3CodingRows);
    const avgLevel3Score = blendLevel3Average(l3Scores, hallucinationAccuracy);

    const ethicalScoreAverage =
      l3EthicalRows.length > 0
        ? roundDisplay(mean(l3EthicalRows.map((r) => effectiveness(r))) ?? 0)
        : null;

    const { overallScore, levelsCompleted } = computeWeightedOverall(
      avgLevel1Score,
      avgLevel2Score,
      avgLevel3Score
    );

    const allReliability = [
      ...bucket.l1.map((r) => reliability(r)),
      ...l2Reliabilities,
      ...bucket.l3.map((r) => reliability(r)),
    ];

    const allEffectiveness = [
      ...bucket.l1.map((r) => effectiveness(r)),
      ...l2Effectivenesses,
      ...bucket.l3.map((r) => effectiveness(r)),
    ];

    const uniqueProblems = new Set();
    for (const row of [...bucket.l1, ...bucket.l2, ...bucket.l3]) {
      const pk = problemKey(row);
      if (pk != null) uniqueProblems.add(pk);
    }

    const totalProblemsSolved = uniqueProblems.size;
    if (totalProblemsSolved < MIN_VALID_PROBLEMS) continue;

    const avgReliabilityRaw = mean(allReliability) ?? 0;
    const avgEfficiencyRaw = mean(l2Efficiencies) ?? 0;

    entries.push({
      userId,
      username: displayUsername(userId, usernameById),
      _overallScoreRaw: overallScore,
      _avgReliabilityRaw: avgReliabilityRaw,
      _sortEfficiency: avgEfficiencyRaw,
      levelsCompleted,
      avgLevel1Score: avgLevel1Score != null ? roundDisplay(avgLevel1Score) : null,
      avgLevel2Score: avgLevel2Score != null ? roundDisplay(avgLevel2Score) : null,
      avgLevel3Score: avgLevel3Score != null ? roundDisplay(avgLevel3Score) : null,
      totalProblemsSolved,
      totalAttempts: bucket.l1.length + bucket.l2.length + bucket.l3.length,
      avgReliability: roundDisplay(avgReliabilityRaw),
      avgEffectiveness: roundDisplay(mean(allEffectiveness) ?? 0),
      avgEfficiency: roundDisplay(avgEfficiencyRaw),
      hallucinationAccuracy,
      ethicalScoreAverage,
    });
  }

  entries.sort(compareEntries);

  const totalUsers = entries.length;

  console.log("[leaderboard] summary:", {
    attemptsScanned: rows.length,
    skippedUnrankedRows: skippedUnranked,
    registeredAccounts: registeredUserIds.size,
    rankedUsers: totalUsers,
  });

  return entries.map((entry, index) => {
    const rank = index + 1;
    const percentile =
      totalUsers > 1
        ? roundDisplay(((totalUsers - rank) / (totalUsers - 1)) * 100)
        : totalUsers === 1
          ? 100
          : 0;

    const displayScore = roundDisplay(entry._overallScoreRaw);

    return {
      rank,
      username: entry.username,
      score: displayScore,
      userId: entry.userId,
      percentile,
      overallScore: displayScore,
      overallScoreExact: Math.round(entry._overallScoreRaw * 100) / 100,
      avgLevel1Score: entry.avgLevel1Score,
      avgLevel2Score: entry.avgLevel2Score,
      avgLevel3Score: entry.avgLevel3Score,
      levelsCompleted: entry.levelsCompleted,
      totalProblemsSolved: entry.totalProblemsSolved,
      totalAttempts: entry.totalAttempts,
      avgReliability: entry.avgReliability,
      avgEffectiveness: entry.avgEffectiveness,
      avgEfficiency: entry.avgEfficiency,
      hallucinationAccuracy: entry.hallucinationAccuracy,
      ethicalScoreAverage: entry.ethicalScoreAverage,
    };
  });
}
