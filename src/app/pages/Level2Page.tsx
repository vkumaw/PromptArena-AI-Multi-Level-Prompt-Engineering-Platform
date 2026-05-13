import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { RefreshCw, Sparkles } from 'lucide-react';
import { authService } from '../utils/auth';
import type {
  CodingProblem,
  Level2EvolutionEntry,
  Level2Response,
  PromptComparison,
  PromptVersion,
} from '../services/contracts';
import { setLevelCompleted } from '../utils/progress';
import { level2Problems } from "../data/problems";
import { apiPath } from '../utils/apiBase';

interface Level2HistoryRecord {
  version: number;
  prompt: string;
  reliabilityScore: number;
  promptScore: number | null;
  testCasesPassed: number;
  totalTestCases: number;
  testScore: number;
  structureScore: number;
  aiOutput: string;
  timestamp: string;
}

interface Level2HistoryApiResponse {
  attempts: number;
  records: Level2HistoryRecord[];
  evolutionHistory: Level2EvolutionEntry[];
  comparison: PromptComparison | null;
  efficiencyIndex: number | null;
  feedback?: string[];
  latest: {
    reliabilityScore: number;
    promptScore?: number;
    testScore: number;
    testCasesPassed: number;
    totalTestCases: number;
    aiOutput: string;
    newVersion: PromptVersion;
  } | null;
}

function mapHistoryToPersistedView(
  data: Level2HistoryApiResponse
): Level2Response | null {
  if (!data.latest || !data.records.length) return null;
  const { latest } = data;
  return {
    reliabilityScore: latest.reliabilityScore,
    promptScore: latest.promptScore,
    testScore: latest.testScore,
    testCasesPassed: latest.testCasesPassed,
    totalTestCases: latest.totalTestCases,
    aiOutput: latest.aiOutput,
    evolutionHistory: data.evolutionHistory,
    comparison: data.comparison,
    efficiencyIndex: data.efficiencyIndex,
    attempts: data.attempts,
    newVersion: latest.newVersion,
    feedback: data.feedback ?? [],
  };
}

export function Level2Page() {
  const [problems, setProblems] = useState<CodingProblem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [result, setResult] = useState<Level2Response | null>(null);
  const [persistedView, setPersistedView] = useState<Level2Response | null>(
    null
  );
  const [historyRecords, setHistoryRecords] = useState<Level2HistoryRecord[]>(
    []
  );
  const [attemptMap, setAttemptMap] = useState<Record<string, number>>({});

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProblems = async () => {
      try {
        setProblems(level2Problems);
        setSelectedProblemId(level2Problems[0]?.problem_id || '');
      } catch {
        setError('Unable to load problems.');
      }
    };
    void loadProblems();
  }, []);

  const loadHistoryForProblem = useCallback(async (problemId: string) => {
    if (!problemId) return false;
    const currentUser = authService.getCurrentUser();
    const uid = currentUser?.id || 'guest-user';
    try {
      const res = await fetch(
        apiPath(
          `/level2/history?userId=${encodeURIComponent(uid)}&problemId=${encodeURIComponent(problemId)}`
        )
      );
      const data = (await res.json()) as Level2HistoryApiResponse & {
        error?: string;
      };
      if (!res.ok) return false;
      setHistoryRecords(data.records || []);
      setAttemptMap((prev) => ({
        ...prev,
        [problemId]: data.attempts || 0,
      }));
      setPersistedView(mapHistoryToPersistedView(data));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!selectedProblemId) return;
    void loadHistoryForProblem(selectedProblemId);
  }, [selectedProblemId, loadHistoryForProblem]);

  const selectedProblem = useMemo(
    () => problems.find((problem) => problem.problem_id === selectedProblemId) || null,
    [problems, selectedProblemId]
  );

  const currentAttempts = attemptMap[selectedProblemId] || 0;

  const view = result ?? persistedView;

  const handleOptimize = async () => {
    if (!customPrompt.trim() || !selectedProblem) return;
    if (currentAttempts >= 3) {
      await loadHistoryForProblem(selectedProblemId);
      setError('');
      return;
    }

    setIsOptimizing(true);
    setError('');

    try {
      const currentUser = authService.getCurrentUser();

      const res = await fetch(apiPath('/level2'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser?.id || 'guest-user',
          prompt: customPrompt,
          problem: selectedProblem,
        }),
      });

      const data = (await res.json()) as Level2Response & { error?: string };

      if (!res.ok) {
        if (
          res.status === 400 &&
          typeof data.error === 'string' &&
          data.error.toLowerCase().includes('maximum 3 attempts')
        ) {
          setAttemptMap((prev) => ({
            ...prev,
            [selectedProblemId]: 3,
          }));
          await loadHistoryForProblem(selectedProblemId);
          setResult(null);
        }
        setError(data.error || 'Request failed');
        return;
      }

      setResult(data);

      if (typeof data.attempts === 'number') {
        setAttemptMap((prev) => ({
          ...prev,
          [selectedProblemId]: data.attempts!,
        }));
      } else {
        setAttemptMap((prev) => ({
          ...prev,
          [selectedProblemId]: (prev[selectedProblemId] || 0) + 1,
        }));
      }

      const synced = await loadHistoryForProblem(selectedProblemId);
      if (synced) setResult(null);

      if (data.reliabilityScore >= 80) {
        setLevelCompleted(2);
      }
    } catch (err: unknown) {
      console.error(err);
      setError('Something went wrong');
    } finally {
      setIsOptimizing(false);
    }
  };

  const attempts = view?.attempts ?? currentAttempts;
  const showEfficiencyPanel = Boolean(view && attempts >= 1);
  const showComparisonPanel =
    view?.comparison &&
    (view.reliabilityScore === 100 || (view.attempts ?? currentAttempts) >= 3);

  const lastSubmittedPrompt =
    view?.newVersion?.promptText?.trim() || customPrompt.trim();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="px-3 py-1 bg-violet-500/20 text-violet-500 rounded-lg text-sm font-medium inline-block mb-3">
            Level 2
          </div>
          <h1 className="text-3xl font-bold mb-2">Prompt Optimization</h1>
          <p className="text-muted-foreground">
            Learn how to refine prompts for better AI responses
          </p>
        </div>

        <div className="mb-6 bg-card border border-border rounded-xl p-5">
          <label className="block text-sm font-medium text-foreground mb-2">Select Problem</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {problems.map((problem) => (
    <div
      key={problem.problem_id}
      onClick={() => {
        setSelectedProblemId(problem.problem_id);
        setResult(null);
        setPersistedView(null);
        setHistoryRecords([]);
        setCustomPrompt('');
        setError('');
      }}
      className={`cursor-pointer p-6 rounded-xl border transition-all
        ${
          selectedProblemId === problem.problem_id
            ? "border-violet-500 bg-violet-500/10"
            : "border-border bg-card hover:border-violet-400 hover:scale-[1.02]"
        }`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-xl font-bold text-foreground">
          {problem.problem_id}
        </h3>

        <span
          className={`text-xs px-2 py-1 rounded ${
            problem.difficulty === "Easy"
              ? "bg-green-500/20 text-green-500"
              : problem.difficulty === "Medium"
              ? "bg-yellow-500/20 text-yellow-500"
              : "bg-red-500/20 text-red-500"
          }`}
        >
          {problem.difficulty}
        </span>
      </div>

      <p className="text-xl font-bold text-foreground">
        {problem.title}
      </p>
    </div>
  ))}
</div>
          {selectedProblem && (
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedProblem.description}
            </p>
          )}
        </div>

        {/* Try It Yourself */}
        <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
          <h2 className="text-xl font-semibold mb-4">Try It Yourself</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="custom" className="block font-medium mb-2">
                  Your Prompt
                </label>
                <textarea
                  id="custom"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Enter a basic prompt you'd like to optimize..."
                  className="w-full h-32 bg-accent border border-border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              <button
                onClick={handleOptimize}
                disabled={
                  isOptimizing || !customPrompt.trim() || currentAttempts >= 3
                }
                className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isOptimizing ? (
                  <>
                    <RefreshCw className="size-5 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-5" />
                    Optimize Prompt
                  </>
                )}
              </button>

              {currentAttempts >= 3 && (
                <p className="text-sm text-muted-foreground">
                  Attempt limit (3) reached for this problem. Your past prompts,
                  scores, and generated code stay visible below for review.
                </p>
              )}

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              {view && (
                <div className="mt-2 space-y-4">
                  <label className="block font-medium">
                    Summary (latest attempt)
                  </label>
                  {selectedProblem && (
                    <p className="text-sm text-muted-foreground">
                      Problem:{' '}
                      <span className="text-foreground">
                        {selectedProblem.problem_id} - {selectedProblem.title}
                      </span>
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Last prompt:{' '}
                    <span className="text-foreground">
                      {lastSubmittedPrompt.slice(0, 200)}
                      {lastSubmittedPrompt.length > 200 ? '...' : ''}
                    </span>
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="bg-accent/50 border border-border rounded-lg p-3">
                      Version:{' '}
                      <span className="font-semibold">
                        v{view.newVersion?.version ?? attempts}
                      </span>
                    </div>
                    <div className="bg-accent/50 border border-border rounded-lg p-3">
                      Reliability:{' '}
                      <span className="font-semibold">
                        {view.reliabilityScore ?? 0}%
                      </span>
                    </div>
                    {typeof view.promptScore === 'number' && (
                      <div className="bg-accent/50 border border-border rounded-lg p-3">
                        Prompt quality:{' '}
                        <span className="font-semibold">
                          {view.promptScore}%
                        </span>
                      </div>
                    )}
                    {typeof view.testScore === 'number' && (
                      <div className="bg-accent/50 border border-border rounded-lg p-3">
                        Test case score:{' '}
                        <span className="font-semibold">
                          {view.testScore}%
                        </span>
                      </div>
                    )}
                    {typeof view.testCasesPassed === 'number' &&
                      typeof view.totalTestCases === 'number' && (
                        <div className="bg-accent/50 border border-border rounded-lg p-3 sm:col-span-2">
                          Tests passed:{' '}
                          <span className="font-semibold">
                            {view.testCasesPassed} / {view.totalTestCases}
                          </span>
                        </div>
                      )}
                    {showEfficiencyPanel && (
                      <div className="bg-accent/50 border border-border rounded-lg p-4 sm:col-span-2 space-y-2 text-sm">
                        <p className="font-semibold text-foreground">
                          Efficiency Index
                        </p>
                        <p className="text-muted-foreground">
                          Formula: Efficiency = Accuracy / Attempts (Accuracy is
                          your reliability score, 0–100).
                        </p>
                        <ul className="text-muted-foreground space-y-1 list-none pl-0">
                          <li>
                            Accuracy:{' '}
                            <span className="font-semibold text-foreground">
                              {view.reliabilityScore ?? 0}
                            </span>
                          </li>
                          <li>
                            Attempts:{' '}
                            <span className="font-semibold text-foreground">
                              {attempts}
                            </span>
                          </li>
                          <li>
                            Efficiency:{' '}
                            <span className="font-semibold text-foreground">
                              {view.efficiencyIndex != null
                                ? `${view.efficiencyIndex}%`
                                : '—'}
                            </span>
                            {view.efficiencyIndex != null &&
                              view.reliabilityScore != null && (
                                <span className="text-muted-foreground">
                                  {' '}
                                  ({view.reliabilityScore} / {attempts} ={' '}
                                  {view.efficiencyIndex}%)
                                </span>
                              )}
                          </li>
                        </ul>
                        <p className="text-xs text-muted-foreground">
                          Higher efficiency means you reached a given accuracy
                          with fewer attempts (better prompt engineering
                          discipline).
                        </p>
                      </div>
                    )}
                  </div>

                  {(typeof view.problemRelevanceScore === 'number' ||
                    (view.relevanceNotes?.length ?? 0) > 0) && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-sm">
                      <p className="font-semibold text-foreground mb-1">
                        Problem Relevance Score:{' '}
                        {view.problemRelevanceScore ?? 0}%
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        {(view.relevanceNotes || []).map((note, index) => (
                          <li key={index}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {view.feedback && view.feedback.length > 0 && (
                    <div className="bg-card border border-border rounded-lg p-4">
                      <p className="font-semibold mb-2">
                        Prompt Improvement Feedback Engine
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        System analyzes your prompt versus prior attempts and
                        outcomes.
                      </p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {view.feedback.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {view.evolutionHistory &&
                    view.evolutionHistory.length > 0 && (
                      <div className="bg-card border border-border rounded-lg p-4">
                        <p className="font-semibold mb-2">
                          Prompt Evolution Timeline
                        </p>
                        <div className="space-y-2">
                          {view.evolutionHistory.map((entry) => (
                            <div
                              key={entry.version}
                              className="text-sm bg-accent/40 rounded p-2 flex flex-wrap items-center justify-between gap-2"
                            >
                              <span>
                                Version {entry.version} → {entry.score}%
                                {typeof entry.promptScore === 'number'
                                  ? ` (prompt ${entry.promptScore}%)`
                                  : ''}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {entry.timestamp
                                  ? new Date(entry.timestamp).toLocaleString()
                                  : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {showComparisonPanel && view.comparison && (
                    <div className="bg-accent/50 border border-border rounded-lg p-4 whitespace-pre-wrap text-sm">
                      <p className="font-semibold mb-2 text-foreground">
                        Prompt Comparison
                      </p>
                      {view.comparison.improvementPercent != null && (
                        <p className="text-muted-foreground mb-2">
                          {view.comparison.improvementPercent >= 0
                            ? 'Improved by '
                            : 'Change: '}
                          <span
                            className={`font-semibold ${
                              (view.comparison.improvementPercent ?? 0) >= 0
                                ? 'text-green-500'
                                : 'text-amber-500'
                            }`}
                          >
                            {view.comparison.improvementPercent >= 0 ? '+' : ''}
                            {view.comparison.improvementPercent}%
                          </span>{' '}
                          <span className="text-muted-foreground">
                            vs previous attempt (reliability)
                          </span>
                        </p>
                      )}
                      <p className="mb-1">
                        <span className="font-medium">Before:</span>{' '}
                        {view.comparison.before}
                      </p>
                      <p>
                        <span className="font-medium">After:</span>{' '}
                        {view.comparison.after}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {historyRecords.length > 0 && (
                <div className="mt-4 space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    All attempts (read-only)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use this log to compare prompts and scores across runs.
                  </p>
                  <div className="space-y-3 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
                    {historyRecords.map((r) => (
                      <div
                        key={r.version}
                        className="rounded-lg border border-border bg-card/80 p-3 text-sm space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">
                            Attempt {r.version}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Prompt:{' '}
                          </span>
                          <span className="whitespace-pre-wrap">{r.prompt}</span>
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded bg-accent/60 px-2 py-1">
                            Reliability {r.reliabilityScore}%
                          </span>
                          {typeof r.promptScore === 'number' && (
                            <span className="rounded bg-accent/60 px-2 py-1">
                              Prompt quality {r.promptScore}%
                            </span>
                          )}
                          <span className="rounded bg-accent/60 px-2 py-1">
                            Tests {r.testCasesPassed}/{r.totalTestCases} (
                            {r.testScore}%)
                          </span>
                        </div>
                        {r.aiOutput ? (
                          <details className="group">
                            <summary className="cursor-pointer text-violet-400 text-xs font-medium">
                              AI generated code (attempt {r.version})
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto rounded border border-zinc-700 bg-zinc-950 p-2 font-mono text-xs text-green-400 whitespace-pre-wrap">
                              {r.aiOutput}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 min-h-[200px]">
              {view?.aiOutput ? (
                <div className="md:sticky md:top-24 rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-lg overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
                  <div className="px-4 py-3 border-b border-zinc-800 text-sm font-semibold tracking-tight">
                    AI Generated Code (latest attempt)
                  </div>
                  <pre className="text-sm font-mono p-4 overflow-auto flex-1 text-green-400 whitespace-pre-wrap leading-relaxed">
                    {view.aiOutput}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
