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
  /** Set when resubmitting a problem that already has a saved attempt. */
  alreadyAttempted?: boolean;
  savedResult?: Omit<Level1Response, 'alreadyAttempted' | 'savedResult'>;
}

export interface Level1HistoryResponse {
  attempted: boolean;
  savedResult: Level1Response | null;
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

export interface Level3CodingProblem {
  problemId: string;
  title: string;
  summary: string;
  sampleUserPrompt: string;
  sampleAiResponse: string;
  groundTruthHallucination: boolean;
  expectedReasonKeywords: string[];
  antiPatterns: string[];
}

export interface Level3Request {
  userId: string;
  scenarioId: string;
  /** Legacy / ethical free-text; also fallback when reasonExplanation is empty */
  promptText?: string;
  problemId?: string;
  mode?: 'ethical' | 'coding';
  generatedCode?: string;
  /** Step 1 — prompt the user sent to the coding assistant */
  userPrompt?: string;
  /** Step 2 — AI-generated code or answer to analyze */
  aiResponseText?: string;
  /** Reflection: does the learner believe the AI output hallucinates? */
  believesHallucination?: boolean;
  /** Reflection: short justification */
  reasonExplanation?: string;
}

export interface Level3HistoryRecord {
  attempt: number;
  compositeScore: number;
  reasonQualityScore: number;
  believesHallucination: boolean | null;
  reliabilityScore: number;
  outputQualityScore: number;
  securityRating: number;
  userPrompt: string;
  aiResponseText: string;
  timestamp: string;
  matchedKeywords: string[];
}

export interface Level3HistoryResponse {
  attempts: number;
  records: Level3HistoryRecord[];
}

export interface Level3Response {
  attempts?: number;
  ethicalIntegrityScore?: number;
  /** Intrinsic scan of pasted AI output */
  hallucinationDetected?: boolean;
  intrinsicHallucination?: boolean;
  /** Authoritative label for the selected exercise snippet */
  groundTruthHallucination?: boolean;
  /** Whether learner Yes/No matches ground truth (null if not submitted) */
  userHallucinationAnswerCorrect?: boolean | null;
  believesHallucination?: boolean | null;
  reasonQualityScore?: number;
  reasonQualityLabel?: 'correct' | 'partial' | 'incorrect';
  matchedKeywords?: string[];
  hitAntiPatterns?: string[];
  reliabilityScore?: number;
  outputQualityScore?: number;
  securityRating?: number;
  compositeScore?: number;
  rationale: string;
  userPromptReceived?: string;
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
  fetchAnalytics(userId: string): Promise<AnalyticsResponse>;
}
