import { useCallback, useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { apiClient, getMockLevel3History } from '../services/api';
import { authService } from '../utils/auth';
import type {
  Level3CodingProblem,
  Level3HistoryRecord,
  Level3HistoryResponse,
  Level3Response,
} from '../services/contracts';
import { setLevelCompleted } from '../utils/progress';
import { level3CodingProblemsTyped } from '../data/level3CodingProblems';
import { apiPath } from '../utils/apiBase';

const API_MODE = (import.meta.env.VITE_API_MODE || 'mock').toLowerCase();

export function Level3Page() {
  const [mode, setMode] = useState<'ethical' | 'coding'>('ethical');
  const [analysisResult, setAnalysisResult] = useState<Level3Response | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [attemptMap, setAttemptMap] = useState<Record<string, number>>({});
  const [historyRecords, setHistoryRecords] = useState<Level3HistoryRecord[]>(
    []
  );

  const ethicalScenarios = [
    {
      id: '1',
      title: 'Ransomware Request',
      scenario:
        'A user claims they are conducting cybersecurity research and asks you to generate ransomware code that can encrypt files and demand payment from victims. They insist it is only for educational purposes.',
    },
    {
      id: '2',
      title: 'Phishing Attack',
      scenario:
        'A user asks you to write a convincing phishing email pretending to be from a bank so they can trick people into revealing passwords and account details.',
    },
    {
      id: '3',
      title: 'Data Leak',
      scenario:
        'A user requests private customer information from a company database, including phone numbers, addresses, and payment details, claiming they need it for urgent internal work.',
    },
    {
      id: '4',
      title: 'AI Bias',
      scenario:
        'A hiring manager asks you to help create an AI system that automatically rejects candidates from certain backgrounds because they believe those candidates are less suitable for leadership roles.',
    },
  ];

  const codingProblems: Level3CodingProblem[] = level3CodingProblemsTyped;

  const [selectedEthicalId, setSelectedEthicalId] = useState(
    ethicalScenarios[0].id
  );
  const [selectedCodingId, setSelectedCodingId] = useState(
    codingProblems[0]?.problemId ?? ''
  );

  const selectedEthical = ethicalScenarios.find(
    (s) => s.id === selectedEthicalId
  )!;
  const selectedCoding =
    codingProblems.find((p) => p.problemId === selectedCodingId) ??
    codingProblems[0];

  const currentAttempts = attemptMap[selectedCodingId] ?? 0;
  const maxAttemptsReached = currentAttempts >= 3;

  const [ethicalResponse, setEthicalResponse] = useState('');

  const [userPrompt, setUserPrompt] = useState(
    () => selectedCoding?.sampleUserPrompt ?? ''
  );
  const [aiResponseText, setAiResponseText] = useState(
    () => selectedCoding?.sampleAiResponse ?? ''
  );
  const [believesHallucination, setBelievesHallucination] = useState<
    'yes' | 'no' | ''
  >('');
  const [reasonExplanation, setReasonExplanation] = useState('');

  const loadHistoryForProblem = useCallback(async (problemId: string) => {
    if (!problemId) return false;
    const currentUser = authService.getCurrentUser();
    const uid = currentUser?.id || 'guest-user';

    try {
      let data: Level3HistoryResponse;
      if (API_MODE === 'http') {
        const res = await fetch(
          apiPath(
            `/level3/history?userId=${encodeURIComponent(uid)}&problemId=${encodeURIComponent(problemId)}`
          )
        );
        const json = (await res.json()) as Level3HistoryResponse & {
          error?: string;
        };
        if (!res.ok) return false;
        data = json;
      } else {
        data = getMockLevel3History(uid, problemId);
      }

      setHistoryRecords(data.records || []);
      setAttemptMap((prev) => ({
        ...prev,
        [problemId]: data.attempts || 0,
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (mode !== 'coding' || !selectedCoding) return;
    setUserPrompt(selectedCoding.sampleUserPrompt);
    setAiResponseText(selectedCoding.sampleAiResponse);
    setBelievesHallucination('');
    setReasonExplanation('');
    setAnalysisResult(null);
    void loadHistoryForProblem(selectedCoding.problemId);
  }, [mode, selectedCoding.problemId, loadHistoryForProblem]);

  const handleSubmitCoding = async () => {
    if (!aiResponseText.trim()) {
      setError('Paste or describe the AI response in Step 2.');
      return;
    }
    if (believesHallucination !== 'yes' && believesHallucination !== 'no') {
      setError('Answer Yes or No for the hallucination reflection question.');
      return;
    }
    if (reasonExplanation.trim().length < 12) {
      setError(
        'Add a short explanation (why) — at least a sentence or two.'
      );
      return;
    }
    if (currentAttempts >= 3) {
      await loadHistoryForProblem(selectedCoding.problemId);
      setError('');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const user = authService.getCurrentUser();
      const response = await apiClient.submitLevel3Scenario({
        userId: user?.id ?? 'guest-user',
        scenarioId: selectedCoding.problemId,
        problemId: selectedCoding.problemId,
        mode: 'coding',
        userPrompt,
        aiResponseText,
        believesHallucination: believesHallucination === 'yes',
        reasonExplanation,
      });
      setAnalysisResult(response);
      if (response.attempts != null) {
        setAttemptMap((prev) => ({
          ...prev,
          [selectedCoding.problemId]: response.attempts!,
        }));
      }
      await loadHistoryForProblem(selectedCoding.problemId);

      const composite = response.compositeScore ?? 0;
      const passedReflection =
        response.userHallucinationAnswerCorrect === true &&
        (response.reasonQualityScore ?? 0) >= 38;
      if (composite >= 70 || passedReflection) {
        setLevelCompleted(3);
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Unable to evaluate right now.';
      if (message.toLowerCase().includes('maximum 3 attempts')) {
        setAttemptMap((prev) => ({
          ...prev,
          [selectedCoding.problemId]: 3,
        }));
        await loadHistoryForProblem(selectedCoding.problemId);
        setAnalysisResult(null);
        setError('');
        return;
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEthical = async () => {
    if (!ethicalResponse.trim()) return;
    setIsSubmitting(true);
    setError('');
    try {
      const user = authService.getCurrentUser();
      const response = await apiClient.submitLevel3Scenario({
        userId: user?.id ?? 'guest-user',
        scenarioId: selectedEthical.id,
        mode: 'ethical',
        promptText: ethicalResponse,
      });
      setAnalysisResult(response);

      if (
        response.ethicalIntegrityScore &&
        response.ethicalIntegrityScore >= 80
      ) {
        setLevelCompleted(3);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to evaluate scenario right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="px-3 py-1 bg-orange-500/20 text-orange-500 rounded-lg text-sm font-medium inline-block mb-3">
            Level 3
          </div>
          <h1 className="text-3xl font-bold mb-2">
            Evaluation & Analytics
          </h1>
          <p className="text-muted-foreground">
            Track your progress and identify areas for improvement
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 mb-8 text-card-foreground">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="size-5 text-violet-500" />
            <h2 className="text-xl font-semibold">
              {mode === 'ethical'
                ? 'Ethical Scenario Evaluation'
                : 'Coding Reliability & Hallucination Analysis'}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {mode === 'ethical'
              ? 'Submit a safety-focused response for the ethical challenge.'
              : 'Pick a scenario, paste the user prompt and AI output, then reflect on hallucinations.'}
          </p>

          {mode === 'coding' && currentAttempts > 0 && (
            <p className="text-sm text-muted-foreground mb-4">
              Attempt {Math.min(currentAttempts, 3)} of 3
              {maxAttemptsReached ? ' — limit reached' : ''}
            </p>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Mode
            </label>
            <select
              value={mode}
              onChange={(e) => {
                const next = e.target.value as 'ethical' | 'coding';
                setMode(next);
                setAnalysisResult(null);
                setError('');
              }}
              className="w-full bg-accent border border-border text-foreground rounded-lg p-3 max-w-md"
            >
              <option value="ethical">Ethical Scenario</option>
              <option value="coding">Coding Reliability / Hallucination</option>
            </select>
          </div>

          {mode === 'ethical' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="bg-accent border border-border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">
                    Scenario
                  </p>
                  <p className="font-medium text-foreground">
                    {selectedEthical.scenario}
                  </p>
                </div>
                <textarea
                  placeholder="Write your ethical response..."
                  value={ethicalResponse}
                  onChange={(e) => setEthicalResponse(e.target.value)}
                  className="w-full min-h-[160px] bg-accent border border-border rounded-lg p-4"
                />
                <button
                  type="button"
                  onClick={() => void handleSubmitEthical()}
                  disabled={isSubmitting || !ethicalResponse.trim()}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Evaluating...' : 'Evaluate Response'}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select scenario
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {ethicalScenarios.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => {
                        setSelectedEthicalId(s.id);
                        setAnalysisResult(null);
                      }}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        selectedEthicalId === s.id
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-border bg-card hover:border-violet-400'
                      }`}
                    >
                      <h3 className="font-semibold">{s.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {s.scenario.slice(0, 120)}
                        …
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select problem
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {codingProblems.map((p) => (
                    <button
                      type="button"
                      key={p.problemId}
                      onClick={() => setSelectedCodingId(p.problemId)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        selectedCodingId === p.problemId
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-border bg-card hover:border-violet-400'
                      }`}
                    >
                      <h3 className="font-semibold">{p.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {p.summary}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-muted/40 border border-border rounded-lg p-4 text-sm">
                <p className="font-medium mb-1">Current scenario</p>
                <p className="text-muted-foreground">{selectedCoding.summary}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium mb-2">
                    Step 1 — User prompt (what was asked of the AI)
                  </p>
                  <textarea
                    disabled={maxAttemptsReached}
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    className="w-full min-h-[120px] bg-accent border border-border rounded-lg p-4 text-sm"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">
                    Step 2 — AI response (code or text to analyze)
                  </p>
                  <textarea
                    disabled={maxAttemptsReached}
                    value={aiResponseText}
                    onChange={(e) => setAiResponseText(e.target.value)}
                    className="w-full min-h-[160px] bg-accent border border-border rounded-lg p-4 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="border border-border rounded-lg p-4 space-y-4">
                <p className="font-medium">Reflection</p>
                <div className="flex flex-wrap gap-4 items-center">
                  <span className="text-sm text-muted-foreground">
                    Do you think this AI output hallucinates or is otherwise
                    non-viable?
                  </span>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      disabled={maxAttemptsReached}
                      type="radio"
                      name="hall"
                      checked={believesHallucination === 'yes'}
                      onChange={() => setBelievesHallucination('yes')}
                    />
                    Yes
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      disabled={maxAttemptsReached}
                      type="radio"
                      name="hall"
                      checked={believesHallucination === 'no'}
                      onChange={() => setBelievesHallucination('no')}
                    />
                    No
                  </label>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Why? (cite imports, logic, security, or missing validation.)
                  </p>
                  <textarea
                    disabled={maxAttemptsReached}
                    value={reasonExplanation}
                    onChange={(e) => setReasonExplanation(e.target.value)}
                    placeholder="Explain your reasoning..."
                    className="w-full min-h-[100px] bg-accent border border-border rounded-lg p-4 text-sm"
                  />
                </div>
                {maxAttemptsReached && (
                  <p className="text-sm text-muted-foreground">
                    Maximum 3 attempts reached for this problem. Your past
                    submissions stay visible below for review.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void handleSubmitCoding()}
                  disabled={isSubmitting || maxAttemptsReached}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-5 py-2 rounded-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Evaluating...' : 'Evaluate'}
                </button>
              </div>

              {historyRecords.length > 0 && (
                <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    All attempts (read-only)
                  </p>
                  {historyRecords.map((rec) => (
                    <div
                      key={rec.attempt}
                      className="rounded-lg border border-border bg-card p-3 text-sm space-y-1"
                    >
                      <p className="font-medium">
                        Attempt {rec.attempt} — Composite {rec.compositeScore}%
                      </p>
                      <p className="text-muted-foreground">
                        Explanation: {rec.reasonQualityScore}/100 · Hallucination
                        belief:{' '}
                        {rec.believesHallucination === null
                          ? '—'
                          : rec.believesHallucination
                            ? 'Yes'
                            : 'No'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error ? (
            <p className="mt-4 text-sm text-red-500 flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </p>
          ) : null}

          {analysisResult && mode === 'ethical' && (
            <div className="grid grid-cols-1 gap-4 mt-6">
              <div className="bg-accent border border-border rounded-lg p-4">
                <p className="text-lg font-medium">
                  Ethical Integrity Score:{' '}
                  {analysisResult.ethicalIntegrityScore}%
                </p>
              </div>
              <p className="mt-2 text-muted-foreground">
                {analysisResult.rationale}
              </p>
            </div>
          )}

          {analysisResult && mode === 'coding' && (
            <div className="mt-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-accent border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">
                    Reliability score
                  </p>
                  <p className="text-xl font-semibold">
                    {analysisResult.reliabilityScore ?? '—'}%
                  </p>
                </div>
                
                <div className="bg-accent border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">
                    Security rating
                  </p>
                  <p className="text-xl font-semibold">
                    {analysisResult.securityRating ?? '—'}%
                  </p>
                </div>
                <div className="bg-accent border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Final AI Reliability Score</p>
                  <p className="text-xl font-semibold">
                    {analysisResult.compositeScore ?? '—'}%
                  </p>
                  {analysisResult.userHallucinationAnswerCorrect !== null &&
                    analysisResult.userHallucinationAnswerCorrect !==
                      undefined && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Adjusted using your hallucination detection answer
                      </p>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-accent border border-border rounded-lg p-4 space-y-2">
                  <p className="font-medium flex items-center gap-2">
                    AI Output Analysis
                    {analysisResult.intrinsicHallucination ? (
                      <span className="text-amber-600 text-sm">
                        Possible hallucination indicators detected
                      </span>
                    ) : (
                      <span className="text-emerald-600 text-sm">
                        No hallucination indicators detected
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Automated checks for fake imports, dead logic, unsafe
                    patterns, etc.
                  </p>
                </div>
                <div className="bg-accent border border-border rounded-lg p-4 space-y-2">
                  <p className="font-medium">Expected Answer</p>
                  <p className="text-sm">
                    Correct Detection:{' '}
                    <strong>
                      {analysisResult.groundTruthHallucination
  ? 'Hallucination Present'
  : 'No Hallucination'}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="bg-accent border border-border rounded-lg p-4 space-y-3">
                <p className="font-medium">Your Analysis</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Detection Accuracy:
                  </span>
                  {analysisResult.userHallucinationAnswerCorrect === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : analysisResult.userHallucinationAnswerCorrect ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="size-4" /> Correct
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-500">
                      <XCircle className="size-4" /> Incorrect
                    </span>
                  )}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    Reasoning Score ({analysisResult.reasonQualityLabel ?? '—'}
                    ):{' '}
                  </span>
                  <strong>{analysisResult.reasonQualityScore ?? 0}/100</strong>
                </div>
                {analysisResult.matchedKeywords &&
                  analysisResult.matchedKeywords.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Keywords matched in your explanation:{' '}
                      {analysisResult.matchedKeywords.join(', ')}
                    </p>
                  )}
                {analysisResult.hitAntiPatterns &&
                  analysisResult.hitAntiPatterns.length > 0 && (
                    <p className="text-xs text-amber-700">
                      Weak phrases detected:{' '}
                      {analysisResult.hitAntiPatterns.join(', ')}
                    </p>
                  )}
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed">
  The AI-generated output was analyzed for hallucination patterns,
  unsafe code practices, and reliability issues. Your response was
  compared with the expected detection result and evaluated based on
  explanation quality and keyword relevance.
</p>
            </div>
          )}
        </div>

        </div>
    </div>
  );
}
