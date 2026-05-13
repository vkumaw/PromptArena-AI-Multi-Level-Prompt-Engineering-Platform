export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
}

export interface CodingProblem {
  problem_id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  language: 'Python';
  expected_output: string;
  tags: string[];
  test_cases: { input: string; expectedOutput: string }[];
}

export interface Level1Request {
  userId: string;
  problemId: string;
  promptText: string;
  language: string;
  attempts: number;
}

export interface Level1Response {
  structureScore: number;
  successProbability: number;
  reliabilityScore: number;
  effectivenessScore: number;
  testCasesPassed: number;
  totalTestCases: number;
  generatedCode: string;
  testCaseResults: TestCaseResult[];
  suggestion: string;
  /** 0–100: pure test pass rate (shown so users see how code vs prompt weight reliability). */
  testPassRate?: number;
  /** 0–100: prompt-quality score (same basis as Level 2). */
  promptScore?: number;
  /** Actionable hints to improve the prompt. */
  feedback?: string[];
}

export interface PromptVersion {
  version: number;
  promptText: string;
  structureScore: number;
  timestamp: string;
}

export interface PromptComparison {
  before: string;
  after: string;
  /** Reliability delta vs previous attempt (percentage points); null on first attempt */
  improvementPercent: number | null;
}

export interface Level2Request {
  userId: string;
  problemId: string;
  promptText: string;
  previousVersions: PromptVersion[];
  problemContext?: Pick<
    CodingProblem,
    'title' | 'description' | 'expected_output' | 'tags'
  >;
}

/** Timeline entry: score = combined reliability % (0–100) */
export interface Level2EvolutionEntry {
  version: number;
  score: number;
  promptScore?: number | null;
  timestamp: string;
}

export interface Level2Response {
  newVersion: PromptVersion;
  evolutionHistory: Level2EvolutionEntry[];
  reliabilityScore: number;
  promptScore?: number;
  testScore?: number;
  efficiencyIndex: number | null;
  attempts?: number;
  structureScore?: number;
  effectivenessScore?: number;
  testCasesPassed?: number;
  totalTestCases?: number;
  ethicalScore?: number;
  hallucinationDetected?: boolean;
  testCaseResults?: TestCaseResult[];
  problemRelevanceScore?: number;
  relevanceNotes?: string[];
  /** Prompt improvement / baseline lines from the Level 2 feedback engine. */
  feedback: string[];
  comparison: PromptComparison | null;
  aiOutput?: string;
}

export interface Level3Request {
  userId: string;
  scenarioId: string;
  promptText: string;
  problemId?: string;
  mode?: 'ethical' | 'coding';
  generatedCode?: string;
}

export interface Level3Response {
  ethicalIntegrityScore?: number;
  hallucinationDetected?: boolean;
  reliabilityAdjustment?: number;
  rationale: string;
}
export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
}

export interface AnalyticsPoint {
  date: string;
  score: number;
}

export interface CategoryScore {
  category: string;
  score: number;
}

export interface AnalyticsResponse {
  totalPrompts: number;
  successRate: number;
  averageScore: number;
  improvement: number;
  scoreHistory: AnalyticsPoint[];
  categoryBreakdown: CategoryScore[];
}

export interface ApiClient {
  fetchProblems(): Promise<CodingProblem[]>;
  submitLevel1Prompt(payload: Level1Request): Promise<Level1Response>;
  submitLevel2Prompt(payload: Level2Request): Promise<Level2Response>;
  submitLevel3Scenario(payload: Level3Request): Promise<Level3Response>;
  fetchLeaderboard(): Promise<LeaderboardEntry[]>;
  fetchAnalytics(): Promise<AnalyticsResponse>;
}
