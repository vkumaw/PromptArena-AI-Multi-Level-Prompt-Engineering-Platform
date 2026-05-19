import {
  type AnalyticsResponse,
  type ApiClient,
  type CodingProblem,
  type LeaderboardEntry,
  type Level1Request,
  type Level1Response,
  type Level2Request,
  type Level2Response,
  type Level3Request,
  type Level3Response,
  type PromptVersion,
} from './contracts';
import { problems20 } from '../data/problems';
import { generateFeedback, trackPromptEvolution } from '../utils';
import { evaluatePrompt } from '../utils/scoring.js';

/** Sync mock evaluator from scoring.js (not the async evaluatePrompt in utils/index.js). */
interface MockPromptEvalResult {
  structureScore: number;
  successProbability: number;
  effectiveness: number;
}
import { level3CodingProblems } from '../../../shared/level3CodingProblems.js';
import {
  analyzeAiResponseSnippet,
  scoreReasonExplanation,
  type AiSnippetAnalysis,
  type ReasonExplanationScore,
} from '../../../shared/level3CodingAnalyze.js';
import type { Level3HistoryRecord } from './contracts';
import { parseLeaderboardPayload } from '../utils/parseLeaderboard';

/** Minimal problem fields used by Level 3 mock scoring */
interface Level3ProblemMeta {
  problemId: string;
  title: string;
  groundTruthHallucination: boolean;
  expectedReasonKeywords: string[];
  antiPatterns: string[];
}

const API_MODE = (import.meta.env.VITE_API_MODE || 'mock').toLowerCase();

/** Mock-only: Level 3 coding attempts per userId+problemId */
const mockLevel3Attempts = new Map<string, Level3HistoryRecord[]>();

function mockLevel3Key(userId: string, problemId: string) {
  return `${userId}::${problemId}`;
}

/** Same URL rules as Level 1/2: apiPath when base is set, else Vite proxy `/api/*`. */
function resolveHttpApiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;

  const base = (import.meta.env.VITE_API_BASE_URL || '').trim();

  if (base) {
    return `${base}${p}`;
  }

  return `/api${p}`;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
function applyReflectionCompositeAdjustment(
  baseComposite: number,
  userHallucinationAnswerCorrect: boolean | null
): number {
  let score = baseComposite;

  if (userHallucinationAnswerCorrect === true) {
    score += 20;
  } else if (userHallucinationAnswerCorrect === false) {
    score -= 25;
  }

  return clamp(Math.round(score), 0, 100);
}
const buildGeneratedCode = (problemId: string) => {
  if (problemId === '1') {
    return `def respond_to_customer_complaint(message: str) -> str:
    return (
        "I am sorry for the delay. I understand your frustration. "
        "I have escalated your order to priority support and will update you within 24 hours."
    )`;
  }
  if (problemId === '2') {
    return `def explain_code_snippet(snippet: str) -> str:
    return "The code first filters values greater than 5, then doubles each remaining value."`;
  }
  return `def extract_contact_data(text: str) -> dict:
    return {"name": "John Smith", "email": "john@techcorp.com", "phone": "555-0123", "company": "TechCorp"}`;
};

const mockApi: ApiClient = {
  async fetchProblems(): Promise<CodingProblem[]> {
    await wait(250);
    return problems20.map((problem) => ({ ...problem }));
  },

  async submitLevel1Prompt(payload: Level1Request): Promise<Level1Response> {
    await wait(900);
    const evalResult: MockPromptEvalResult = evaluatePrompt(
      payload.promptText,
      0
    );
    const structureScore = clamp(evalResult.structureScore, 1, 10);
    const successProbability = clamp(evalResult.successProbability, 10, 100);
    const totalTestCases = 5;
    const mockTestPassRate = Math.round(
      (structureScore / 10) * (successProbability / 100) * 100
    );
    const testCasesPassed = clamp(
      Math.round((mockTestPassRate / 100) * totalTestCases),
      0,
      totalTestCases
    );
    const promptScoreApprox = structureScore * 10;
    const reliabilityScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(mockTestPassRate * 0.82 + promptScoreApprox * 0.18)
      )
    );
    const effectivenessScore = clamp(Math.round(evalResult.effectiveness), 0, 100);

    return {
      structureScore,
      successProbability,
      reliabilityScore,
      effectivenessScore,
      testCasesPassed,
      totalTestCases,
      generatedCode: buildGeneratedCode(payload.problemId),
      testCaseResults: [
        { input: '2', expectedOutput: 'True', actualOutput: 'True', passed: true },
        { input: '3', expectedOutput: 'True', actualOutput: 'True', passed: true },
        { input: '4', expectedOutput: 'False', actualOutput: 'False', passed: true },
        { input: '-1', expectedOutput: 'False', actualOutput: 'False', passed: testCasesPassed >= 4 },
        { input: '0', expectedOutput: 'False', actualOutput: testCasesPassed === 5 ? 'False' : 'Error', passed: testCasesPassed === 5 },
      ],
      suggestion:
        structureScore < 6
          ? 'Specify language, expected input/output, and edge cases to improve reliability.'
          : 'Great prompt structure. Add constraints like complexity limits for even better consistency.',
    };
  },

  async submitLevel2Prompt(payload: Level2Request): Promise<Level2Response> {
    await wait(800);
    const baseReliability = 0;
    const evalResult: MockPromptEvalResult = evaluatePrompt(
      payload.promptText,
      baseReliability
    );
    const structureScore = clamp(evalResult.structureScore, 1, 10);
    const normalizedHistory = payload.previousVersions.map((entry) => ({
      version: entry.version,
      prompt: entry.promptText,
      score: entry.structureScore,
      timestamp: entry.timestamp,
    }));
    const evolved = trackPromptEvolution(
      normalizedHistory,
      payload.promptText,
      structureScore
    );
    const newEntry = evolved[evolved.length - 1];
    const newVersion: PromptVersion = {
      version: newEntry.version,
      promptText: newEntry.prompt,
      structureScore: newEntry.score,
      timestamp: newEntry.timestamp,
    };
    const promptScore = clamp(structureScore * 10, 0, 100);
    const testScore = 55;
    const reliabilityScore = Math.round(promptScore * 0.6 + testScore * 0.4);
    const evolutionHistory = evolved.map((entry) => ({
      version: entry.version,
      score: reliabilityScore,
      promptScore,
      timestamp: entry.timestamp,
    }));
    const attempts = Math.max(evolutionHistory.length, 1);
    const efficiencyIndex = Math.round(reliabilityScore / attempts);
    const firstPrompt = evolved[0]?.prompt || payload.promptText;
    const firstScore = evolved[0]?.score || structureScore;
    const improvementPercent =
      payload.previousVersions.length >= 1
        ? Math.round(reliabilityScore - clamp(30 + firstScore * 5, 0, 100))
        : null;

    const prevText =
      payload.previousVersions.length > 0
        ? payload.previousVersions[payload.previousVersions.length - 1]
            .promptText
        : '';
    let feedback: string[];
    if (prevText && prevText !== payload.promptText) {
      const deltas = generateFeedback(prevText, payload.promptText);
      feedback = ['Improvement detected:', ...deltas];
      if (feedback.length === 1) {
        feedback.push(
          '+ Refine further: align wording with tests, return values, and edge cases.'
        );
      }
    } else {
      feedback = [
        'Prompt analysis (baseline):',
        '• Continue: add language, function signature, I/O, and edge cases on your next attempt.',
      ];
    }

    const contextText = `${payload.problemContext?.title || ''} ${payload.problemContext?.description || ''} ${(payload.problemContext?.tags || []).join(' ')}`.toLowerCase();
    const promptTerms = payload.promptText.toLowerCase().split(/\W+/).filter(Boolean);
    const matches = promptTerms.filter((term) => term.length > 3 && contextText.includes(term));
    const problemRelevanceScore = clamp(Math.round((matches.length / Math.max(promptTerms.length, 1)) * 100), 0, 100);
    const relevanceNotes = [
      `Matched ${matches.length} key prompt terms with selected problem context.`,
      `Expected output target: ${payload.problemContext?.expected_output || 'Not specified'}.`,
    ];

    return {
      newVersion,
      evolutionHistory,
      reliabilityScore,
      promptScore,
      testScore,
      efficiencyIndex,
      attempts,
      problemRelevanceScore,
      relevanceNotes,
      feedback,
      aiOutput: '# Mock mode — no live model\npass\n',
      comparison:
        reliabilityScore === 100 || attempts >= 3
          ? {
              before: firstPrompt,
              after: payload.promptText,
              improvementPercent,
            }
          : null,
    };
  },
  

  async submitLevel3Scenario(payload: Level3Request): Promise<Level3Response> {
    await wait(700);

    if (payload.mode !== 'coding') {
      const text = (payload.promptText ?? '').toLowerCase();
      const unsafePattern = /hack|exploit|malware|ransomware code|bypass/;
      const safePattern = /explain|prevention|protection|safety|awareness/;
      const ethicalIntegrityScore = unsafePattern.test(text)
        ? 20
        : safePattern.test(text)
          ? 95
          : 70;

      return {
        ethicalIntegrityScore,
        rationale:
          ethicalIntegrityScore > 90
            ? 'Prompt is safety-oriented and aligned with responsible AI usage.'
            : ethicalIntegrityScore > 40
              ? 'Prompt is partially safe but can be improved by emphasizing prevention and ethical framing.'
              : 'Response may need clearer refusal of harmful instructions.',
      };
    }

    const pid = payload.problemId || payload.scenarioId;
    const problem = level3CodingProblems.find(
      (p) => p.problemId === pid
    ) as Level3ProblemMeta | undefined;
    if (!problem) {
      throw new Error('Unknown Level 3 coding problem id.');
    }

    const snippet = (payload.aiResponseText ?? '').trim();
    if (!snippet) {
      throw new Error('Paste the AI response (Step 2) for analysis.');
    }

    const analysis: AiSnippetAnalysis = analyzeAiResponseSnippet(snippet);
    const explanationSource =
      typeof payload.reasonExplanation === 'string' &&
      payload.reasonExplanation.trim()
        ? payload.reasonExplanation
        : (payload.promptText ?? '');
    const reasonScoring: ReasonExplanationScore = scoreReasonExplanation(
      explanationSource,
      problem
    );

    const gt = !!problem.groundTruthHallucination;
    const userBelief =
      typeof payload.believesHallucination === 'boolean'
        ? payload.believesHallucination
        : null;

    const userHallucinationAnswerCorrect =
      userBelief === null ? null : userBelief === gt;

    const uid = payload.userId || 'guest-user';
    const key = mockLevel3Key(uid, pid);
    const prior = mockLevel3Attempts.get(key) ?? [];
    if (prior.length >= 1) {
      throw new Error('Maximum 1 attempts reached for this coding problem.');
    }

    const adjustedComposite = applyReflectionCompositeAdjustment(
      analysis.compositeScore,
      userHallucinationAnswerCorrect
    );

    const rationale = [
      `Ground truth for "${problem.title}": ${gt ? 'Yes — treat as hallucinating / unreliable.' : 'No — not labeled as hallucination for this drill.'}`,
      `Automated scan: ${analysis.intrinsicHallucination ? 'Issues found (deps / logic).' : 'No strong hallucination signals.'}`,
      userBelief === null
        ? 'Answer Yes/No on hallucination to compare with the answer key.'
        : userHallucinationAnswerCorrect
          ? 'Your Yes/No matches the exercise ground truth.'
          : 'Your Yes/No differs from this exercise ground truth.',
      `Explanation rubric: ${reasonScoring.reasonQualityLabel} (${reasonScoring.reasonQualityScore}/100).`,
    ].join(' ');

    const attempts = prior.length + 1;
    const record: Level3HistoryRecord = {
      attempt: attempts,
      compositeScore: adjustedComposite,
      reasonQualityScore: reasonScoring.reasonQualityScore,
      believesHallucination: userBelief,
      reliabilityScore: analysis.reliabilityScore,
      outputQualityScore: analysis.outputQualityScore,
securityRating: analysis.securityRating,
      userPrompt: payload.userPrompt ?? '',
      aiResponseText: snippet,
      timestamp: new Date().toISOString(),
      matchedKeywords: reasonScoring.matchedKeywords,
    };
    mockLevel3Attempts.set(key, [...prior, record]);

    return {
      hallucinationDetected: analysis.intrinsicHallucination,
      intrinsicHallucination: analysis.intrinsicHallucination,
      groundTruthHallucination: gt,
      userHallucinationAnswerCorrect,
      believesHallucination: userBelief,
      reasonQualityScore: reasonScoring.reasonQualityScore,
      reasonQualityLabel: reasonScoring.reasonQualityLabel,
      matchedKeywords: reasonScoring.matchedKeywords,
      hitAntiPatterns: reasonScoring.hitAntiPatterns,
      reliabilityScore: analysis.reliabilityScore,
      outputQualityScore: analysis.outputQualityScore,
      securityRating: analysis.securityRating,
      compositeScore: adjustedComposite,
      rationale,
      userPromptReceived: payload.userPrompt ?? '',
      attempts,
    };
  },

  async fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    return httpApi.fetchLeaderboard();
  },

  async fetchAnalytics(_userId: string): Promise<AnalyticsResponse> {
    await wait(300);
    return {
      totalPrompts: 0,
      successRate: 0,
      averageScore: 0,
      improvement: 0,
      scoreHistory: [],
      categoryBreakdown: [
        { category: 'Prompt Quality', score: 0 },
        { category: 'Reliability', score: 0 },
        { category: 'Ethics', score: 0 },
      ],
    };
  },
};

/** Mock Level 3 history (used when VITE_API_MODE=mock). */
export function getMockLevel3History(
  userId: string,
  problemId: string
): { attempts: number; records: Level3HistoryRecord[] } {
  const records = mockLevel3Attempts.get(mockLevel3Key(userId, problemId)) ?? [];
  return { attempts: records.length, records };
}

export async function fetchLevel3History(
  problemId: string,
  token: string
): Promise<{
  attempts: number;
  records: Level3HistoryRecord[];
}> {
  const response = await fetch(
    resolveHttpApiUrl(`/level3/history?problemId=${problemId}`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    let message = `Failed to load Level 3 history (${response.status})`;

    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // ignore json parse failure
    }

    throw new Error(message);
  }

  return (await response.json()) as {
    attempts: number;
    records: Level3HistoryRecord[];
  };
}
const postJson = async <TResponse>(
  path: string,
  payload: unknown
): Promise<TResponse> => {
  let response: Response;
  try {
    response = await fetch(resolveHttpApiUrl(path), {
      method: 'POST',
      headers: {
  'Content-Type': 'application/json',
  ...(localStorage.getItem('token')
    ? {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      }
    : {}),
},
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      'Cannot reach the API server. Run: cd backend && npm run dev (port 3000), then reload.'
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `API request failed: ${response.status}`;
    throw new Error(msg);
  }

  return (await response.json()) as TResponse;
};

const httpApi: ApiClient = {
  async fetchProblems() {
    const response = await fetch(resolveHttpApiUrl('/problems'));
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return (await response.json()) as CodingProblem[];
  },
  submitLevel1Prompt(payload) {
    return postJson<Level1Response>('/level1', payload);
  },
  submitLevel2Prompt(payload) {
    return postJson<Level2Response>('/level2', payload);
  },
  submitLevel3Scenario(payload) {
    return postJson<Level3Response>('/level3', payload);
  },
  async fetchLeaderboard() {
    const response = await fetch(resolveHttpApiUrl('/leaderboard'));
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    const data = (await response.json()) as unknown;
    return parseLeaderboardPayload(data);
  },
  async fetchAnalytics(userId: string) {
    const q = new URLSearchParams({ userId });
    const response = await fetch(
      resolveHttpApiUrl(`/analytics?${q.toString()}`)
    );
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return (await response.json()) as AnalyticsResponse;
  },
};

export const apiClient: ApiClient = API_MODE === 'http' ? httpApi : mockApi;
