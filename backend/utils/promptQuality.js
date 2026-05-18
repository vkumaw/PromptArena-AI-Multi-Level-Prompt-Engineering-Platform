/**
 * Level 2 / Level 1 prompt quality (0–100): weighted checks.
 * @param {string} prompt
 * @param {{ language?: string; title?: string; description?: string } | null} [problem]
 * @param {{ level1?: boolean }} [opts] Pass `{ level1: true }` only from Level 1 — keeps Level 2 behaviour unchanged.
 */
export function computePromptScore(prompt, problem, opts) {
  const p = (prompt || "").toLowerCase();
  let score = 0;

  const langNamed = /python|java|c\+\+|javascript|typescript|go|rust/i.test(p);
  if (langNamed) score += 20;

  const inferredLang = inferLanguageFromProblem(prompt, problem);
  if (!langNamed && inferredLang) score += 16;

  if (/function|def|method/.test(p)) score += 20;
  if (/\b(code|program|routine)\b/.test(p)) score += 14;
  if (/input|output|return|returns|parameter|argument|expected/.test(p))
    score += 20;
  if (
    /edge case|edge cases|empty|negative|null|zero|constraint|invalid|boundary|corner/i.test(
      p
    )
  )
    score += 20;
  if ((prompt || "").length > 20) score += 18;

  const domain = mentionsProblemDomain(prompt, problem);
  if (domain && !langNamed) score += 8;

  score = Math.min(100, score);

  if (opts?.level1) {
    const raw = (prompt || "").trim();
    const words = raw.split(/\s+/).filter(Boolean);
    const hasRichSpec =
      /python|java|function|def|method|return|returns|input|output|edge|negative|zero|constraint|integer|boolean|otherwise|handle\s+edge|takes\s+an/i.test(
        p
      );
    if (words.length <= 6 && !hasRichSpec) {
      score = Math.min(score, 32);
    }
    if (words.length <= 4 && !langNamed && !/function|def/.test(p)) {
      score = Math.min(score, 28);
    }
  }

  return score;
}

function inferLanguageFromProblem(prompt, problem) {
  const lang = (problem?.language || "").toLowerCase();
  if (!lang.includes("python")) return false;
  const pl = (prompt || "").toLowerCase();
  if (/python/.test(pl)) return true;
  return /\b(code|program|script|snippet|def|function)\b/.test(pl) || mentionsProblemDomain(prompt, problem);
}

function mentionsProblemDomain(prompt, problem) {
  const pl = (prompt || "").toLowerCase();
  if (!pl) return false;
  const title = (problem?.title || "").toLowerCase();
  const desc = (problem?.description || "").toLowerCase();
  const stems =
    /\b(prime|factorial|palindrome|fibonacci|anagram|prefix|parentheses|binary|search|sort|merge|rotate|vowel|reverse|json|cache|ladder|frequent|leetcode|array|list|string|dict)\b/i;
  if (stems.test(pl)) return true;
  const stop = new Set([
    "write",
    "python",
    "function",
    "returns",
    "that",
    "the",
    "and",
    "with",
    "from",
    "this",
    "given",
    "your",
    "code",
    "program",
    "handle",
    "cases",
    "like",
    "numbers",
    "number",
  ]);
  const words = [...title.split(/\W+/), ...desc.split(/\W+/)]
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 4 && !stop.has(w));
  for (const w of new Set(words)) {
    if (w && pl.includes(w)) return true;
  }
  return false;
}

/** Gap-based hints for the current prompt (deduped). */
export function buildSmartFeedbackGaps(prompt, problem) {
  const p = prompt || "";
  const pl = p.toLowerCase();
  const out = [];

  const langOk =
    /python|java|c\+\+/i.test(p) || inferLanguageFromProblem(prompt, problem);
  if (!langOk) {
    out.push("Specify programming language (e.g. Python), or align your wording with the task so the model knows the stack.");
  }

  const sigOk =
    /function|def|method/i.test(pl) || /\b(code|program|routine)\b/i.test(pl);
  if (!sigOk) {
    out.push(
      "Name the function or describe what to build (e.g. “function is_prime(n) returning bool”)."
    );
  }

  const desc = (problem?.description || "").toLowerCase();
  const primeStyleTask =
    /prime/i.test(desc) &&
    /prime/i.test(pl) &&
    /negative|edge|even|odd|less|greater|divide|sqrt|loop|factor|composite/i.test(
      pl
    );
  const ioOk =
    /input|output|return|returns|parameter|argument|expected|boolean|bool|true|false/i.test(
      pl
    ) ||
    primeStyleTask;
  if (!ioOk) {
    out.push(
      "State expected input type/range and return format (e.g. boolean for prime check, handling n ≤ 1)."
    );
  }

  const edgeOk =
    /edge case|edge cases|empty|negative|null|zero|constraint|invalid|boundary|corner|less than|n\s*[≤<]=?\s*1/i.test(
      pl
    );
  if (!edgeOk) {
    out.push(
      "Call out edge cases (e.g. n ≤ 1, negatives, even numbers) and constraints the solution must satisfy."
    );
  }

  return dedupeFeedback(out);
}

function dedupeFeedback(items) {
  return [...new Set(items.filter(Boolean))];
}

export function normalizePromptForCompare(text) {
  return (text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function problemReferenceText(problem) {
  return [
    problem?.description,
    problem?.problemStatement,
    problem?.statement,
    problem?.title,
    problem?.expected_output,
    problem?.expectedOutput,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Normalize problem fields used for similarity (handles partial API payloads). */
export function resolveProblemForSimilarity(problem) {
  if (!problem) return problem;
  const description =
    problem.description ||
    problem.problemStatement ||
    problem.statement ||
    "";
  if (description === problem.description) return problem;
  return { ...problem, description };
}

function tokenSet(a) {
  return new Set(
    a
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2)
  );
}

function tokenSetOverlap(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) {
    if (B.has(w)) inter++;
  }
  return inter / Math.max(A.size, B.size);
}

function jaccardTokenSimilarity(a, b) {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) {
    if (B.has(w)) inter++;
  }
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function similarityAgainstReference(p, ref) {
  if (!p || !ref || ref.length < 12) return 0;
  if (p === ref) return 1;

  let sim = Math.max(tokenSetOverlap(p, ref), jaccardTokenSimilarity(p, ref));

  const longer = p.length >= ref.length ? p : ref;
  const shorter = p.length >= ref.length ? ref : p;
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.82) {
    sim = Math.max(sim, 0.86 + 0.14 * (shorter.length / longer.length));
  }

  const lenRatio = Math.min(p.length, ref.length) / Math.max(p.length, ref.length);
  if (lenRatio >= 0.9 && sim >= 0.72) {
    sim = Math.max(sim, 0.9);
  }

  return Math.min(1, sim);
}

/**
 * 0–1 similarity between user prompt and official problem text (description, title, combined ref).
 */
export function computeProblemSimilarity(prompt, problem) {
  const p = normalizePromptForCompare(prompt);
  if (!p) return 0;

  const refs = [
    problem?.description,
    problemReferenceText(problem),
    problem?.title,
  ]
    .filter(Boolean)
    .map(normalizePromptForCompare);

  let maxSim = 0;
  for (const ref of refs) {
    maxSim = Math.max(maxSim, similarityAgainstReference(p, ref));
  }
  return maxSim;
}

/** Prompt-engineering signals that should not count when already present in the problem statement. */
const ENGINEERING_SIGNALS = [
  { test: /edge\s*cases?|boundary\s*cases?|corner\s*cases?/i },
  { test: /constraints?|invariant|must\s+not|should\s+not|only\s+accept/i },
  { test: /optimi|complexity|o\s*\(|time\s+complex|space\s+complex|efficient/i },
  { test: /error\s+handl|raise\s+\w+|try\s*:|except\s+/i },
  { test: /examples?|unit\s+tests?|test\s+cases?|assert\s+|for\s+example/i },
  {
    test: /input\s+(type|format|range)|output\s+(type|format)|parameter\s+type|return\s+type|returns?\s+(a\s+)?bool/i,
  },
  { test: /\bdef\s+[a-z_]\w*\s*\(|\bfunction\s+[a-z_]\w*\s*\(/i },
  {
    test: /negative|n\s*[<≤]=|less\s+than\s+2|zero|null|empty\s+(list|array|string)|non[- ]?prime/i,
  },
  { test: /sqrt|square\s+root|trial\s+divis|divisors?\s+up\s+to|modulo/i },
];

const PROMPT_COMPARE_STOP = new Set([
  "write",
  "python",
  "function",
  "returns",
  "that",
  "the",
  "and",
  "with",
  "from",
  "this",
  "given",
  "your",
  "code",
  "program",
  "handle",
  "cases",
  "like",
  "numbers",
  "number",
  "otherwise",
  "true",
  "false",
]);

function fractionPromptTokensBeyondProblem(prompt, problem) {
  const ref = normalizePromptForCompare(problemReferenceText(problem));
  const refWords = new Set(ref.split(/\s+/));
  const promptWords = normalizePromptForCompare(prompt)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !PROMPT_COMPARE_STOP.has(w));
  if (promptWords.length === 0) return 0;
  const extra = promptWords.filter((w) => !refWords.has(w));
  return extra.length / promptWords.length;
}

/**
 * True when the prompt adds specification beyond the official problem text.
 */
export function hasUserAddedEngineering(prompt, problem) {
  const ref = normalizePromptForCompare(problemReferenceText(problem));
  const pl = prompt || "";
  if (!ref) return false;

  for (const { test } of ENGINEERING_SIGNALS) {
    if (test.test(pl) && !test.test(ref)) return true;
  }

  if (fractionPromptTokensBeyondProblem(pl, problem) >= 0.2) return true;

  return false;
}

/**
 * Level 1: penalize high-similarity prompts unless the user added real engineering detail.
 * @returns {{ promptScore: number, similarity: number, highSimilarity: boolean, isCopyPaste: boolean, addedEngineering: boolean }}
 */
const LEVEL1_HIGH_SIMILARITY = 0.8;

export function applyLevel1PromptQualityAdjustments(promptScore, prompt, problem) {
  const resolved = resolveProblemForSimilarity(problem);
  const similarity = computeProblemSimilarity(prompt, resolved);
  const addedEngineering = hasUserAddedEngineering(prompt, resolved);
  const highSimilarity = similarity >= LEVEL1_HIGH_SIMILARITY;
  const isCopyPaste = highSimilarity && !addedEngineering;

  let score = promptScore;

  if (similarity >= 0.9 && !addedEngineering) {
    score = Math.min(score, 40);
  } else if (similarity >= 0.85 && !addedEngineering) {
    score = Math.min(score, 45);
  } else if (highSimilarity && !addedEngineering) {
    score = Math.min(score, 50);
  } else if (highSimilarity && addedEngineering) {
    score = Math.min(score, 72);
  }

  return {
    promptScore: score,
    similarity,
    highSimilarity,
    isCopyPaste,
    addedEngineering,
  };
}

/**
 * Hard cap on structure score (1–10) AFTER normal scoring when prompt ≈ problem statement.
 * Example: raw 8/10 at 92% similarity → min(8, 5) = 5/10.
 */
export function capLevel1StructureScore(rawStructureScore, quality) {
  const raw = Number.isFinite(rawStructureScore) ? rawStructureScore : 0;
  const sim = quality?.similarity ?? 0;
  const added = quality?.addedEngineering ?? false;

  if (sim < LEVEL1_HIGH_SIMILARITY) return raw;

  if (!added) {
    if (sim >= 0.9) return Math.min(raw, 4);
    return Math.min(raw, 5);
  }

  if (sim >= 0.88) return Math.min(raw, 8);
  return raw;
}

/**
 * True when the user prompt is essentially the official problem text (no added engineering).
 */
export function isLikelyProblemCopyPaste(prompt, problem) {
  const p = normalizePromptForCompare(prompt);
  const ref = normalizePromptForCompare(problemReferenceText(problem));
  if (!p || !ref || ref.length < 20) return false;
  if (computeProblemSimilarity(prompt, problem) >= LEVEL1_HIGH_SIMILARITY) {
    return !hasUserAddedEngineering(prompt, problem);
  }
  if (p === ref) return true;
  const longer = p.length >= ref.length ? p : ref;
  const shorter = p.length >= ref.length ? ref : p;
  if (longer.includes(shorter) && shorter.length >= longer.length * 0.88) {
    return !hasUserAddedEngineering(prompt, problem);
  }
  const overlap = tokenSetOverlap(p, ref);
  return (
    overlap >= 0.82 &&
    Math.abs(p.length - ref.length) / Math.max(ref.length, 1) < 0.12 &&
    !hasUserAddedEngineering(prompt, problem)
  );
}

/**
 * Level 1 learning feedback: gaps + copy-paste warning + problem-aware nudge.
 */
export function buildLevel1Feedback(
  prompt,
  problem,
  { isCopyPaste, highSimilarity, testPassRate } = {}
) {
  const gaps = buildSmartFeedbackGaps(prompt, problem);
  const out = [];
  if (isCopyPaste || highSimilarity) {
    out.push(
      "Your prompt closely matches the original problem statement. Add constraints, edge cases, formatting rules, or optimization requirements to improve your prompt-engineering score."
    );
  }
  out.push(...gaps);
  if (
    problem?.expected_output &&
    !/(expected|output format|return|boolean|true|false|prime)/i.test(
      prompt || ""
    )
  ) {
    out.push(
      `Tie your prompt to the expected result shape (this problem expects: ${problem.expected_output}).`
    );
  }
  if (typeof testPassRate === "number" && testPassRate < 100) {
    out.push(
      "Some tests failed: ask for a complete algorithm (e.g. trial division up to √n for primes), exact function name the grader calls, and explicit return type so generated code is runnable."
    );
  }
  return dedupeFeedback(out);
}
