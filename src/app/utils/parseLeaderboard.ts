import type { LeaderboardEntry } from '../services/contracts';

const WEIGHT_L1 = 0.35;
const WEIGHT_L2 = 0.4;
const WEIGHT_L3 = 0.25;

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mean(nums: number[]): number | null {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function round(n: number): number {
  return Math.round(n);
}

function normalizeUserId(raw: unknown): string {
  if (raw == null || raw === '') return 'guest-user';
  return String(raw).trim();
}

function reliability(row: Record<string, unknown>): number {
  return num(row.reliabilityScore ?? row.reliability);
}

function effectiveness(row: Record<string, unknown>): number {
  return num(row.effectivenessScore ?? row.effectiveness);
}

function testPerformance(row: Record<string, unknown>): number {
  const stored = num(row.testPassRate, NaN);
  if (Number.isFinite(stored)) return stored;
  const total = num(row.totalTestCases, 0);
  if (total <= 0) return 0;
  return (num(row.testCasesPassed, 0) / total) * 100;
}

function classifyRow(row: Record<string, unknown>): 'l1' | 'l2' | 'l3' {
  if (row.level === 1) return 'l1';
  if (row.level === 3) return 'l3';
  return 'l2';
}

function problemKey(row: Record<string, unknown>): string {
  const pid = row.problemId;
  if (pid == null || pid === '') return '__unknown_problem__';
  return String(pid);
}

/** Fallback display when User collection username is unavailable (never drop the row). */
function fallbackDisplayName(userId: string): string {
  if (userId === 'guest-user') return 'Guest';
  if (userId.length === 24) return `User_${userId.slice(-6)}`;
  if (userId.length > 0 && userId.length <= 8) return `Player_${userId}`;
  return `User_${userId.slice(-6)}`;
}

function isAggregatedRow(row: Record<string, unknown>): boolean {
  return (
    typeof row.rank === 'number' ||
    (typeof row.rank === 'string' &&
      row.rank !== '' &&
      Number.isFinite(Number(row.rank)))
  );
}

function isRawAttemptRow(row: Record<string, unknown>): boolean {
  return (
    row.userId != null &&
    !isAggregatedRow(row) &&
    (row.effectivenessScore != null ||
      row.effectiveness != null ||
      row.reliabilityScore != null ||
      row.reliability != null ||
      row.prompt != null ||
      row._id != null)
  );
}

/** Client-side aggregation when API returns raw UserData (e.g. stale backend process). */
export function aggregateRawAttempts(
  rows: Record<string, unknown>[]
): LeaderboardEntry[] {
  const byUser = new Map<
    string,
    {
      userId: string;
      l1: Record<string, unknown>[];
      l2: Record<string, unknown>[];
      l3: Record<string, unknown>[];
    }
  >();

  for (const row of rows) {
    const userId = normalizeUserId(row.userId);
    if (!byUser.has(userId)) {
      byUser.set(userId, { userId, l1: [], l2: [], l3: [] });
    }
    const bucket = byUser.get(userId)!;
    const kind = classifyRow(row);
    if (kind === 'l1') bucket.l1.push(row);
    else if (kind === 'l3') bucket.l3.push(row);
    else bucket.l2.push(row);
  }

  const l2Groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    if (classifyRow(row) !== 'l2') continue;
    const key = `${normalizeUserId(row.userId)}::${problemKey(row)}`;
    if (!l2Groups.has(key)) l2Groups.set(key, []);
    l2Groups.get(key)!.push(row);
  }

  const entries: LeaderboardEntry[] = [];

  for (const { userId, l1, l2, l3 } of byUser.values()) {
    const l1Scores = l1.map(
      (row) =>
        (effectiveness(row) + reliability(row) + testPerformance(row)) / 3
    );
    const avgLevel1Score = mean(l1Scores);

    const l2ProblemScores: number[] = [];
    for (const [key, problemRows] of l2Groups) {
      if (!key.startsWith(`${userId}::`)) continue;
      const sorted = [...problemRows].sort(
        (a, b) =>
          new Date(String(a.timestamp ?? 0)).getTime() -
          new Date(String(b.timestamp ?? 0)).getTime()
      );
      const last = sorted[sorted.length - 1];
      const attempts = sorted.length;
      const rel = reliability(last);
      const eff = effectiveness(last);
      const efficiencyIndex = attempts > 0 ? rel / attempts : 0;
      l2ProblemScores.push((eff + rel + efficiencyIndex) / 3);
    }
    const avgLevel2Score = mean(l2ProblemScores);

    const l3Scores = l3.map((row) => {
      const composite = effectiveness(row);
      const reasoning = num(row.ethicalScore);
      const pid = String(row.problemId ?? '');
      if (pid.startsWith('ethical-')) {
        return (composite + composite + reasoning) / 3;
      }
      return (composite + reliability(row) + reasoning) / 3;
    });
    const avgLevel3Score = mean(l3Scores);

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

    entries.push({
      rank: 0,
      userId,
      username: fallbackDisplayName(userId),
      score: round(overallScore),
    });
  }

  entries.sort((a, b) => b.score - a.score);
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function parseLeaderboardPayload(data: unknown): LeaderboardEntry[] {
  if (!Array.isArray(data) || data.length === 0) {
    console.log('[leaderboard] parse: empty payload');
    return [];
  }

  const rows = data.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === 'object'
  );

  console.log('[leaderboard] parse: received rows', rows.length);

  if (rows.length === 0) return [];

  if (isAggregatedRow(rows[0])) {
    const parsed = rows
      .map((row): LeaderboardEntry | null => {
        const rank = Number(row.rank);
        if (!Number.isFinite(rank)) return null;

        const userId =
          row.userId != null ? normalizeUserId(row.userId) : undefined;
        const username =
          typeof row.username === 'string' && row.username.trim()
            ? row.username.trim()
            : userId
              ? fallbackDisplayName(userId)
              : 'Unknown User';

        return {
          rank,
          username,
          score: round(num(row.score ?? row.overallScore, 0)),
          userId,
          percentile:
            typeof row.percentile === 'number' ? row.percentile : undefined,
        };
      })
      .filter((row): row is LeaderboardEntry => row !== null)
      .sort((a, b) => a.rank - b.rank);

    console.log('[leaderboard] parse: aggregated entries', parsed.length);
    return parsed;
  }

  if (isRawAttemptRow(rows[0])) {
    console.warn(
      '[leaderboard] parse: raw UserData detected — aggregating on client (restart backend for real usernames)'
    );
    const aggregated = aggregateRawAttempts(rows);
    console.log('[leaderboard] parse: client-aggregated entries', aggregated.length);
    return aggregated;
  }

  console.warn('[leaderboard] parse: unrecognized payload shape');
  return [];
}
