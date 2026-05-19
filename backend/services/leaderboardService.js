import mongoose from "mongoose";
import UserData from "../models/userData.js";
import User from "../models/User.js";
import { level3CodingProblems } from "../../shared/level3CodingProblems.js";

const WEIGHT_L1 = 0.35;
const WEIGHT_L2 = 0.4;
const WEIGHT_L3 = 0.25;

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

function round(n) {
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

function testPerformance(row) {
  const stored = num(row.testPassRate, NaN);
  if (!Number.isNaN(stored)) return stored;
  const total = num(row.totalTestCases, 0);
  if (total <= 0) return 0;
  return (num(row.testCasesPassed, 0) / total) * 100;
}

function level1AttemptScore(row) {
  const tests = testPerformance(row);
  return (effectiveness(row) + reliability(row) + tests) / 3;
}

function level2ProblemScore(lastRow, attemptCount) {
  const eff = effectiveness(lastRow);
  const rel = reliability(lastRow);
  const efficiencyIndex = attemptCount > 0 ? rel / attemptCount : 0;
  return (eff + rel + efficiencyIndex) / 3;
}

function isLevel3EthicalRow(row) {
  const pid = (row.problemId || "").toString();
  return pid.startsWith("ethical-");
}

function level3AttemptScore(row) {
  const composite = effectiveness(row);
  const reasoning = num(row.ethicalScore);

  if (isLevel3EthicalRow(row)) {
    const ethicalIntegrity = composite;
    return (ethicalIntegrity + ethicalIntegrity + reasoning) / 3;
  }

  const ethicalIntegrity = reliability(row) || reasoning;
  return (composite + ethicalIntegrity + reasoning) / 3;
}

function classifyRow(row) {
  if (row.level === 1) return "l1";
  if (row.level === 3) return "l3";
  return "l2";
}

function problemKey(row) {
  const pid = row.problemId;
  if (pid == null || pid === "") return "__unknown_problem__";
  return String(pid);
}

function groupLevel2ByUserProblem(rows) {
  const map = new Map();
  for (const row of rows) {
    const uid = normalizeUserId(row.userId);
    const key = `${uid}::${problemKey(row)}`;
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

  return total > 0 ? round((correct / total) * 100) : null;
}

/**
 * Load all users into a map: normalizedId -> display name.
 */
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
  const resolved = usernameById.get(userId);
  if (resolved) return resolved;
  if (userId === "guest-user") return "Guest";
  if (mongoose.Types.ObjectId.isValid(userId) && userId.length === 24) {
    return `User_${userId.slice(-6)}`;
  }
  if (userId.length > 0 && userId.length <= 8) {
    return `Player_${userId}`;
  }
  return `User_${String(userId).slice(-6)}`;
}

/**
 * Build ranked leaderboard entries from MongoDB UserData + User collections.
 */
export async function buildLeaderboard() {
  const rows = await UserData.find().lean();
  console.log("[leaderboard] fetched attempts:", rows.length);

  if (rows.length > 0) {
    const sample = rows[0];
    console.log("[leaderboard] sample attempt:", {
      userId: sample.userId,
      normalizedUserId: normalizeUserId(sample.userId),
      effectivenessScore: sample.effectivenessScore,
      reliabilityScore: sample.reliabilityScore,
      level: sample.level,
    });
  }

  const byUser = new Map();

  for (const row of rows) {
    const userId = normalizeUserId(row.userId);
    if (!byUser.has(userId)) {
      byUser.set(userId, { userId, l1: [], l2: [], l3: [] });
    }
    const bucket = byUser.get(userId);
    const kind = classifyRow(row);
    if (kind === "l1") bucket.l1.push(row);
    else if (kind === "l3") bucket.l3.push(row);
    else bucket.l2.push(row);
  }

  console.log(
    "[leaderboard] grouped userIds:",
    [...byUser.keys()]
  );

  const usernameById = await loadUserDirectory();
  console.log(
    "[leaderboard] user mapping loaded:",
    usernameById.size,
    "accounts",
    Object.fromEntries(usernameById)
  );

  const l2Groups = groupLevel2ByUserProblem(
    rows.filter((r) => classifyRow(r) === "l2")
  );

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

    const l3Scores = bucket.l3.map(level3AttemptScore);
    const avgLevel3Score = mean(l3Scores);

    const l3EthicalRows = bucket.l3.filter(isLevel3EthicalRow);
    const l3CodingRows = bucket.l3.filter((r) => !isLevel3EthicalRow(r));

    const ethicalScoreAverage =
      l3EthicalRows.length > 0
        ? round(mean(l3EthicalRows.map((r) => effectiveness(r))) ?? 0)
        : null;

    const hallucinationAccuracy = computeHallucinationAccuracy(l3CodingRows);

    let overallScore = 0;
    let weightSum = 0;

    if (avgLevel1Score != null) {
      overallScore += WEIGHT_L1 * avgLevel1Score;
      weightSum += WEIGHT_L1;
    }
    if (avgLevel2Score != null) {
      overallScore += WEIGHT_L2 * avgLevel2Score;
      weightSum += WEIGHT_L2;
    }
    if (avgLevel3Score != null) {
      overallScore += WEIGHT_L3 * avgLevel3Score;
      weightSum += WEIGHT_L3;
    }

    overallScore = weightSum > 0 ? overallScore / weightSum : 0;

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

    const uniqueProblems = new Set(
      [...bucket.l1, ...bucket.l2, ...bucket.l3].map((r) => problemKey(r))
    );

    const username = displayUsername(userId, usernameById);
    const matchedInUserCollection = usernameById.has(userId);

    if (matchedInUserCollection) {
      console.log("[leaderboard] matched username:", { userId, username });
    } else {
      console.log("[leaderboard] unmatched userId — using fallback name:", {
        userId,
        username,
      });
    }

    const entry = {
      userId,
      username,
      score: round(overallScore),
      overallScore: round(overallScore),
      avgLevel1Score: avgLevel1Score != null ? round(avgLevel1Score) : null,
      avgLevel2Score: avgLevel2Score != null ? round(avgLevel2Score) : null,
      avgLevel3Score: avgLevel3Score != null ? round(avgLevel3Score) : null,
      totalProblemsSolved: uniqueProblems.size,
      totalAttempts: bucket.l1.length + bucket.l2.length + bucket.l3.length,
      avgReliability: round(mean(allReliability) ?? 0),
      avgEffectiveness: round(mean(allEffectiveness) ?? 0),
      avgEfficiency: round(mean(l2Efficiencies) ?? 0),
      hallucinationAccuracy,
      ethicalScoreAverage,
      _sortEfficiency: mean(l2Efficiencies) ?? 0,
    };

    entries.push(entry);
    console.log("[leaderboard] user score:", {
      userId,
      username: entry.username,
      overallScore: entry.overallScore,
      attempts: entry.totalAttempts,
    });
  }

  entries.sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    if (b._sortEfficiency !== a._sortEfficiency) {
      return b._sortEfficiency - a._sortEfficiency;
    }
    return b.totalProblemsSolved - a.totalProblemsSolved;
  });

  const totalUsers = entries.length;

  return entries.map((entry, index) => {
    const rank = index + 1;
    const percentile =
      totalUsers > 1
        ? round(((totalUsers - rank) / (totalUsers - 1)) * 100)
        : totalUsers === 1
          ? 100
          : 0;

    const { _sortEfficiency, ...rest } = entry;
    return {
      rank,
      username: rest.username,
      score: rest.score,
      userId: rest.userId,
      percentile,
      overallScore: rest.overallScore,
      avgLevel1Score: rest.avgLevel1Score,
      avgLevel2Score: rest.avgLevel2Score,
      avgLevel3Score: rest.avgLevel3Score,
      totalProblemsSolved: rest.totalProblemsSolved,
      totalAttempts: rest.totalAttempts,
      avgReliability: rest.avgReliability,
      avgEffectiveness: rest.avgEffectiveness,
      avgEfficiency: rest.avgEfficiency,
      hallucinationAccuracy: rest.hallucinationAccuracy,
      ethicalScoreAverage: rest.ethicalScoreAverage,
    };
  });
}
