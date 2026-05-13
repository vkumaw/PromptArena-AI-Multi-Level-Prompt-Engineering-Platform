/**
 * Level 2: deterministic prompt improvement / baseline feedback (no LLM).
 * @param {object} opts
 * @param {string} opts.currentPrompt
 * @param {string | null | undefined} opts.previousPrompt
 * @param {{ title?: string; description?: string } | null | undefined} opts.problem
 * @param {{ prevReliability?: number; currentReliability?: number; prevTestPass?: number; currentTestPass?: number }} [opts.metrics]
 * @returns {string[]}
 */
export function buildLevel2ImprovementFeedback({
  currentPrompt,
  previousPrompt,
  problem,
  metrics = {},
} = {}) {
  const cur = currentPrompt || "";
  const prev = previousPrompt || "";
  const pl = cur.toLowerCase();
  const prevL = prev.toLowerCase();

  const {
    prevReliability,
    currentReliability,
    prevTestPass,
    currentTestPass,
  } = metrics;

  const out = [];

  if (prev && prev !== cur) {
    out.push("Improvement detected:");
    if (!/python|java|c\+\+/i.test(prev) && /python|java|c\+\+/i.test(cur)) {
      out.push("+ Specified programming language");
    }
    if (
      !/function|def|method/i.test(prevL) &&
      /function|def|method/i.test(pl)
    ) {
      out.push("+ Defined function behavior");
    }
    if (
      !/\b(code|program|routine)\b/i.test(prevL) &&
      /\b(code|program|routine)\b/i.test(pl)
    ) {
      out.push("+ Clarified what to build (code/program)");
    }
    if (
      !/input|output|return|returns|parameter|argument|expected/i.test(
        prevL
      ) &&
      /input|output|return|returns|parameter|argument|expected/i.test(pl)
    ) {
      out.push("+ Added input/output or return expectations");
    }
    if (
      !/edge case|constraint|invalid|boundary|negative|null|zero|empty|corner/i.test(
        prevL
      ) &&
      /edge case|constraint|invalid|boundary|negative|null|zero|empty|corner/i.test(
        pl
      )
    ) {
      out.push("+ Added constraints or edge-case handling");
    }
    if (cur.trim().length > prev.trim().length + 15) {
      out.push("+ Improved prompt clarity and detail");
    }
    const domainHint = problemDomainAdded(prevL, pl, problem);
    if (domainHint) out.push(domainHint);

    if (
      typeof prevReliability === "number" &&
      typeof currentReliability === "number" &&
      currentReliability > prevReliability
    ) {
      out.push(
        `+ Reliability score increased (${prevReliability}% → ${currentReliability}%)`
      );
    }
    if (
      typeof prevTestPass === "number" &&
      typeof currentTestPass === "number" &&
      currentTestPass > prevTestPass
    ) {
      out.push(
        `+ More tests passed (${Math.round(prevTestPass)}% → ${Math.round(currentTestPass)}% pass rate)`
      );
    }
  } else {
    out.push("Prompt analysis (baseline):");
    if (/python|java|c\+\+/i.test(cur)) {
      out.push("• Programming language is indicated.");
    }
    if (/function|def|method/i.test(pl)) {
      out.push("• Function or method behavior is described.");
    }
    if (/input|output|return|returns|parameter|argument|expected/i.test(pl)) {
      out.push("• Input/output or return expectations are present.");
    }
    if (
      /edge case|constraint|invalid|boundary|negative|null|zero|empty|corner/i.test(
        pl
      )
    ) {
      out.push("• Constraints or edge cases are mentioned.");
    }
    if (cur.trim().length > 80) {
      out.push("• Prompt has substantive length for the model to work with.");
    }
    const domainHint = problemDomainAdded("", pl, problem);
    if (domainHint) {
      out.push(domainHint.replace(/^\+ /, "• "));
    }
    if (out.length === 1) {
      out.push(
        "• Continue: add language, function signature, I/O, and edge cases on your next attempt."
      );
    }
  }

  const deduped = dedupeKeepOrder(out);
  if (
    deduped.length === 1 &&
    deduped[0] === "Improvement detected:"
  ) {
    deduped.push(
      "+ Refine further: align wording with tests, return values, and edge cases."
    );
  }
  return deduped;
}

function problemDomainAdded(prevL, pl, problem) {
  const desc = (problem?.description || "").toLowerCase();
  const title = (problem?.title || "").toLowerCase();
  const blob = `${title} ${desc}`;
  const stems =
    /\b(prime|factorial|palindrome|fibonacci|anagram|array|list|string|dict|sort|search|reverse|binary|json)\b/gi;
  let m;
  const terms = new Set();
  while ((m = stems.exec(blob)) !== null) {
    const t = m[1].toLowerCase();
    if (t.length > 3) terms.add(t);
  }
  for (const t of terms) {
    if (pl.includes(t) && !prevL.includes(t)) {
      return `+ Tied prompt to problem domain ("${t}")`;
    }
  }
  return null;
}

function dedupeKeepOrder(items) {
  const seen = new Set();
  const res = [];
  for (const s of items) {
    if (!s || seen.has(s)) continue;
    seen.add(s);
    res.push(s);
  }
  return res;
}
