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
import { mockAnalytics, mockLeaderboard } from '../utils/mockData';
import { problems20 } from '../data/problems';
import {
  evaluatePrompt,
  generateFeedback,
  trackPromptEvolution,
} from '../utils';

const API_MODE = (import.meta.env.VITE_API_MODE || 'mock').toLowerCase();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

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
    const evalResult = evaluatePrompt(payload.promptText, 0);
    const structureScore = clamp(evalResult.structureScore, 1, 10);
    const successProbability = clamp(evalResult.successProbability, 10, 100);
    const totalTestCases = 5;
    const testCasesPassed = clamp(
      Math.round((successProbability / 100) * totalTestCases),
      1,
      totalTestCases
    );
    const reliabilityScore = Math.round((testCasesPassed / totalTestCases) * 100);
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
    const evalResult = evaluatePrompt(payload.promptText, baseReliability);
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
    const text = payload.promptText.toLowerCase();
    const unsafePattern = /hack|exploit|malware|ransomware code|bypass/;
    const safePattern = /explain|prevention|protection|safety|awareness/;
    const hallucinationDetected =
      !!payload.generatedCode && /undefined|syntaxerror|exception|todo/i.test(payload.generatedCode);

    const ethicalIntegrityScore =
      payload.mode === 'coding'
        ? 80
        : unsafePattern.test(text)
        ? 20
        : safePattern.test(text)
        ? 95
        : 70;

    return {
      ethicalIntegrityScore,
      hallucinationDetected,
      reliabilityAdjustment: hallucinationDetected ? -20 : 5,
      rationale: hallucinationDetected
        ? 'Potential hallucination detected due to invalid or inconsistent generated code.'
        : ethicalIntegrityScore > 90
        ? 'Prompt is safety-oriented and aligned with responsible AI usage.'
        : 'Prompt is partially safe but can be improved by emphasizing prevention and ethical framing.',
    };
  },

  async fetchLeaderboard(): Promise<LeaderboardEntry[]> {
    await wait(300);
    return mockLeaderboard.map((entry) => ({ ...entry }));
  },

  async fetchAnalytics(): Promise<AnalyticsResponse> {
    await wait(300);
    return {
      totalPrompts: mockAnalytics.totalPrompts,
      successRate: mockAnalytics.successRate,
      averageScore: mockAnalytics.averageScore,
      improvement: mockAnalytics.improvement,
      scoreHistory: [...mockAnalytics.scoreHistory],
      categoryBreakdown: [...mockAnalytics.categoryBreakdown],
    };
  },
};

const postJson = async <TResponse>(
  path: string,
  payload: unknown
): Promise<TResponse> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
};

const httpApi: ApiClient = {
  async fetchProblems() {
    const response = await fetch(`${API_BASE_URL}/problems`);
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
    const response = await fetch(`${API_BASE_URL}/leaderboard`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return (await response.json()) as LeaderboardEntry[];
  },
  async fetchAnalytics() {
    const response = await fetch(`${API_BASE_URL}/analytics`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    return (await response.json()) as AnalyticsResponse;
  },
};

export const apiClient: ApiClient = API_MODE === 'http' ? httpApi : mockApi;
