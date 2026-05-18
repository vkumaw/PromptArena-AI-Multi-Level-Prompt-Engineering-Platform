import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { CodingProblem, Level1Response } from '../services/contracts';
import { setLevelCompleted } from '../utils/progress';
import { fetchLevel1History, generateCodeFromAI } from "../services/aiService";
import { level1Problems } from "../data/problems";

function buildSuggestion(
  structureScore: number,
  feedbackList: string[],
  promptLower: string
): string {
  if (feedbackList.length > 0) {
    return 'Review the feedback below and revise your prompt.';
  }
  if (structureScore < 4) {
    return 'Specify language, input/output and constraints.';
  }
  if (structureScore < 7) {
    const mentionsEdges = /edge|negative|zero|null|constraint|invalid|boundary/.test(
      promptLower
    );
    return mentionsEdges
      ? 'You hinted at edge cases; spell out return type, inputs, and any algorithm details (e.g. check divisors up to √n) to raise your structure score.'
      : 'Try adding edge cases and expected behavior.';
  }
  return 'Well-structured prompt!';
}

function formatLevel1Response(
  raw: Record<string, unknown>,
  promptText: string
): Level1Response {
  const feedbackList = Array.isArray(raw.feedback)
    ? (raw.feedback as string[])
    : [];
  const reliabilityFromApi =
    typeof raw.reliabilityScore === 'number'
      ? raw.reliabilityScore
      : typeof raw.reliability === 'number'
        ? raw.reliability
        : 0;
  const effectivenessFromApi =
    typeof raw.effectivenessScore === 'number'
      ? raw.effectivenessScore
      : typeof raw.effectiveness === 'number'
        ? raw.effectiveness
        : 0;
  const structureScore =
    typeof raw.structureScore === 'number' ? raw.structureScore : 0;
  const promptLower = promptText.trim().toLowerCase();

  return {
    structureScore,
    successProbability:
      typeof raw.successProbability === 'number'
        ? raw.successProbability
        : typeof raw.predictedSuccess === 'number'
          ? raw.predictedSuccess
          : 0,
    generatedCode: typeof raw.generatedCode === 'string' ? raw.generatedCode : '',
    reliabilityScore: reliabilityFromApi,
    effectivenessScore: effectivenessFromApi,
    testCasesPassed:
      typeof raw.testCasesPassed === 'number'
        ? raw.testCasesPassed
        : typeof raw.passed === 'number'
          ? raw.passed
          : 0,
    totalTestCases:
      typeof raw.totalTestCases === 'number'
        ? raw.totalTestCases
        : typeof raw.total === 'number'
          ? raw.total
          : 0,
    testCaseResults: Array.isArray(raw.testCaseResults)
      ? (raw.testCaseResults as Level1Response['testCaseResults'])
      : [],
    testPassRate:
      typeof raw.testPassRate === 'number' ? raw.testPassRate : undefined,
    promptScore:
      typeof raw.promptScore === 'number' ? raw.promptScore : undefined,
    feedback: feedbackList,
    suggestion: buildSuggestion(structureScore, feedbackList, promptLower),
  };
}

export function Level1Page() {
  const [problems, setProblems] = useState<CodingProblem[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState('');
  
  const [result, setResult] = useState<Level1Response | null>(null);
  const [persistedView, setPersistedView] = useState<Level1Response | null>(null);
  const [attemptCompletedMap, setAttemptCompletedMap] = useState<
    Record<string, boolean>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [isProblemsLoading, setIsProblemsLoading] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [lowScoreAttempts, setLowScoreAttempts] = useState(0);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const loadProblems = async () => {
      try {
        setProblems(level1Problems);
        setSelectedProblemId(level1Problems[0]?.problem_id || '');
      } catch {
        setError('Unable to load problems.');
      } finally {
        setIsProblemsLoading(false);
      }
    };
    void loadProblems();
  }, []);

  const loadHistoryForProblem = useCallback(async (problemId: string) => {
    if (!problemId) return false;
    const token = localStorage.getItem('token');
    if (!token) return false;

    setIsHistoryLoading(true);
    try {
      const data = await fetchLevel1History(problemId, token);
      if (data.attempted && data.savedResult) {
        const saved = data.savedResult as Record<string, unknown>;
        const savedPrompt =
          typeof saved.prompt === 'string' ? saved.prompt : '';
        const formatted = formatLevel1Response(saved, savedPrompt);
        setPersistedView(formatted);
        setPrompt(savedPrompt);
        setAttemptCompletedMap((prev) => ({ ...prev, [problemId]: true }));
        return true;
      }
      setPersistedView(null);
      setAttemptCompletedMap((prev) => ({ ...prev, [problemId]: false }));
      return false;
    } catch {
      return false;
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedProblemId) return;
    setResult(null);
    setError('');
    void loadHistoryForProblem(selectedProblemId);
  }, [selectedProblemId, loadHistoryForProblem]);

  const selectedProblem = useMemo(
    () => problems.find((problem) => problem.problem_id === selectedProblemId) || null,
    [problems, selectedProblemId]
  );

  const isAttemptCompleted = Boolean(attemptCompletedMap[selectedProblemId]);
  const view = result ?? persistedView;

  const handleSubmit = async () => {
    if (!prompt.trim() || !selectedProblem) return;

    if (isAttemptCompleted) {
      await loadHistoryForProblem(selectedProblemId);
      setError('');
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Please login again to continue.");
      }

      const response = await generateCodeFromAI(prompt, selectedProblem, token);
      const raw = response as Record<string, unknown>;

      if (raw.alreadyAttempted && raw.savedResult) {
        const saved = raw.savedResult as Record<string, unknown>;
        const savedPrompt =
          typeof saved.prompt === 'string' ? saved.prompt : prompt;
        const formatted = formatLevel1Response(saved, savedPrompt);
        setPersistedView(formatted);
        setPrompt(savedPrompt);
        setResult(null);
        setAttemptCompletedMap((prev) => ({
          ...prev,
          [selectedProblemId]: true,
        }));
        return;
      }

      const formattedResponse = formatLevel1Response(raw, prompt);

      setResult(formattedResponse);
      setPersistedView(null);
      setAttemptCompletedMap((prev) => ({
        ...prev,
        [selectedProblemId]: true,
      }));

      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);

      setLowScoreAttempts((count) =>
        formattedResponse.structureScore < 4 ? count + 1 : 0
      );

      if (formattedResponse.structureScore >= 8) {
        setLevelCompleted(1);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to evaluate prompt. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectProblem = (problemId: string) => {
    setSelectedProblemId(problemId);
    setResult(null);
    setError('');
    if (!attemptCompletedMap[problemId]) {
      setPrompt('');
      setPersistedView(null);
    }
    setAttempts(0);
    setLowScoreAttempts(0);
  };

  const safeTestCases = selectedProblem?.test_cases ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="px-3 py-1 bg-blue-500/20 text-blue-500 rounded-lg text-sm font-medium">
              Level 1
            </div>
            <div
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                selectedProblem?.difficulty === 'Easy'
                  ? 'bg-green-500/20 text-green-500'
                  : selectedProblem?.difficulty === 'Medium'
                  ? 'bg-yellow-500/20 text-yellow-500'
                  : 'bg-red-500/20 text-red-500'
              }`}
            >
              {selectedProblem?.difficulty || 'N/A'}
            </div>
            {isAttemptCompleted && (
              <div className="px-3 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-sm font-medium">
                Attempt already completed
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {selectedProblem?.title || 'Select a problem'}
          </h1>
          <p className="text-muted-foreground">
            Craft an effective prompt to solve this challenge
          </p>
        </div>

        <div className="mb-6 bg-card border border-border rounded-xl p-5">
          <label className="block text-sm font-medium text-foreground mb-2">Select Problem</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {problems.map((problem) => (
    <div
      key={problem.problem_id}
      onClick={() => handleSelectProblem(problem.problem_id)}
      className={`cursor-pointer p-4 rounded-xl border transition-all
        ${
          selectedProblemId === problem.problem_id
            ? "border-violet-500 bg-violet-500/10"
            : "border-border bg-card hover:border-violet-400"
        }`}
    >
      <div className="flex justify-between items-center mb-2">
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
          {false && selectedProblem && (
  <div className="mt-3 text-sm text-muted-foreground">
    <p className="text-foreground mb-1">
      Expected Output: {selectedProblem?.expected_output}
    </p>
    <details className="bg-accent/40 border border-border rounded-lg p-3">
      <summary className="cursor-pointer text-foreground font-medium">
        View Test Cases
      </summary>
      <ul className="mt-2 space-y-1">
        {safeTestCases.map((testCase, index) => (
          <li key={index}>
            Input: <span className="text-foreground">{testCase.input}</span> {'->'} Expected:{' '}
            <span className="text-foreground">{testCase.expectedOutput}</span>
          </li>
        ))}
      </ul>
    </details>
  </div>
)}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Problem Statement */}
          <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
            <h2 className="text-xl font-semibold mb-4">Problem Statement</h2>
            <div className="prose prose-sm max-w-none text-foreground/80 whitespace-pre-line leading-relaxed">
              {selectedProblem?.description ||
                (isProblemsLoading
                  ? 'Loading problem...'
                  : 'Select a problem to view its statement.')}
            </div>
          </div>

          {/* Right Panel - Output */}
          <div className="bg-card border border-border rounded-xl p-6 text-card-foreground">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Output</h2>
              {view && (
                <div className="flex items-center gap-2">
                  {view.reliabilityScore >= 80 ? (
                    <CheckCircle className="size-5 text-green-500" />
                  ) : (
                    <XCircle className="size-5 text-yellow-500" />
                  )}
                  <span className="font-semibold text-lg text-foreground">
                    Reliability: {view.reliabilityScore}%
                  </span>
                </div>
              )}
            </div>

            {isLoading || isHistoryLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="size-12 text-violet-500 animate-spin mb-4" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Processing your prompt...' : 'Loading saved attempt...'}
                </p>
              </div>
            ) : error ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
                {error}
              </div>
            ) : view ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-accent/50 rounded-lg p-3">
                    Prompt Structure Score: <span className="font-semibold">{view.structureScore}/10</span>
                  </div>
                  <div className="bg-accent/50 rounded-lg p-3">
                    Predicted Success: <span className="font-semibold">{view.successProbability}%</span>
                  </div>
                  <div className="bg-accent/50 rounded-lg p-3">
                    Reliability Score: <span className="font-semibold">{view.reliabilityScore}%</span>
                  </div>
                  <div className="bg-accent/50 rounded-lg p-3">
                    Effectiveness Score: <span className="font-semibold">{view.effectivenessScore}%</span>
                  </div>
                  <div className="bg-accent/50 rounded-lg p-3 sm:col-span-2">
                    Test Cases Passed:{' '}
                    <span className="font-semibold">
                      {view.testCasesPassed}/{view.totalTestCases}
                    </span>
                    {typeof view.testPassRate === 'number' && (
                      <span className="block mt-1 text-muted-foreground">
                        Code test pass rate: {view.testPassRate}% (reliability = 82% tests + 18% predicted success from prompt quality)
                      </span>
                    )}
                  </div>
                </div>

                {view.testCaseResults && view.testCaseResults.length > 0 && (
                  <details className="bg-accent/40 border border-border rounded-lg p-3">
                    <summary className="cursor-pointer text-foreground font-medium text-sm">
                      Test case details ({view.testCasesPassed}/{view.totalTestCases} passed)
                    </summary>
                    <ul className="mt-2 space-y-2 text-sm text-muted-foreground max-h-48 overflow-y-auto">
                      {view.testCaseResults.map((tc, i) => (
                        <li
                          key={i}
                          className={
                            tc.passed
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          Input: {tc.input} → expected {tc.expectedOutput}, got{' '}
                          {tc.actualOutput} ({tc.passed ? 'pass' : 'fail'})
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {view.feedback && view.feedback.length > 0 && view.suggestion && (
                  <p className="text-sm text-muted-foreground">{view.suggestion}</p>
                )}

                {view.feedback && view.feedback.length > 0 && (
                  <div className="bg-violet-500/10 border border-violet-500/25 rounded-lg p-4">
                    <p className="text-sm font-semibold text-foreground mb-2">How to improve your prompt</p>
                    <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                      {view.feedback.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {view.generatedCode ? (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-950 overflow-hidden max-h-64">
                    <pre className="p-4 font-mono text-sm text-green-400 whitespace-pre-wrap leading-relaxed overflow-auto max-h-64">
                      {view.generatedCode}
                    </pre>
                  </div>
                ) : null}

                {(!view.feedback || view.feedback.length === 0) && view.suggestion && (
                  <p className="text-sm text-muted-foreground">{view.suggestion}</p>
                )}

                {(attempts >= 3 || lowScoreAttempts >= 2) && !isAttemptCompleted && (
                  <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4 text-sm">
                    <p className="font-semibold text-foreground mb-2">Prompt Template Builder</p>
                    <p className="text-muted-foreground">Language: ___ | Input: ___ | Output: ___ | Constraints: ___</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                Submit a prompt to see the output
              </div>
            )}
          </div>
        </div>

        {/* Prompt Input Section */}
        <div className="mt-6 bg-card border border-border rounded-xl p-6 text-card-foreground">
          <label htmlFor="prompt" className="block text-lg font-semibold mb-3">
            Your Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            readOnly={isAttemptCompleted}
            placeholder="Write your prompt here... Be clear, specific, and provide context."
            className="w-full h-40 bg-accent border border-border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none disabled:opacity-80 read-only:opacity-90"
          />

          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <p className="text-sm text-muted-foreground">
              {prompt.length} characters
            </p>
            <button
              onClick={handleSubmit}
              disabled={
                isLoading ||
                isHistoryLoading ||
                isAttemptCompleted ||
                !prompt.trim()
              }
              className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg hover:shadow-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="size-5" />
                  Submit Prompt
                </>
              )}
            </button>
          </div>
          {isAttemptCompleted && (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
              Attempt already completed — one submission per problem.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
