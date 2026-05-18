/**
 * Rule-based analysis of pasted "AI response" text for hallucination / reliability signals.
 * Shared by backend and frontend mock API.
 */

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function analyzeAiResponseSnippet(text) {
  const raw = text || "";
  const t = raw.toLowerCase();

  let reliabilityScore = 85;
  let outputQualityScore = 80;
  let securityRating = 85;
  let intrinsicHallucination = false;

  const bumpDown = (amt) => {
    reliabilityScore -= amt;
    outputQualityScore -= amt * 0.9;
  };

  if (
    /\bimport\s+fake\w*/i.test(raw) ||
    /\bfrom\s+fake\w*/i.test(raw) ||
    /\bimport\s+fakeai\b/i.test(raw) ||
    /\brequests_plus\b/i.test(raw) ||
    /\bfrom\s+phantom_/i.test(raw)
  ) {
    intrinsicHallucination = true;
    bumpDown(35);
  }

  if (
    /\bundefined_\w+\s*\(/.test(raw) ||
    /\bmystery_func\s*\(/.test(raw) ||
    /\bplaceholder_\w+\s*\(/.test(raw)
  ) {
    intrinsicHallucination = true;
    bumpDown(30);
  }

  if (
    /\bsyntaxerror\b/i.test(t) ||
    /\bindentationerror\b/i.test(t) ||
    /\binvalid syntax\b/i.test(t)
  ) {
    intrinsicHallucination = true;
    bumpDown(40);
  }

  if (
    /password\s*=\s*["'][^"']{3,}["']/i.test(raw) ||
    /admin123|secretkey|api_key\s*=\s*["']/i.test(raw)
  ) {
    securityRating -= 45;
    reliabilityScore -= 10;
    bumpDown(8);
  }

  if (/\breturn\b[^\n]+\n\s+if\b/.test(raw)) {
    intrinsicHallucination = true;
    bumpDown(28);
  }

  if (
    /\bauthenticate\b[\s\S]{0,120}\breturn\s+true\b/i.test(raw) &&
    /fakeai|verify\(/.test(raw)
  ) {
    outputQualityScore -= 15;
  }

  reliabilityScore = clamp(Math.round(reliabilityScore), 0, 100);
  outputQualityScore = clamp(Math.round(outputQualityScore), 0, 100);
  securityRating = clamp(Math.round(securityRating), 0, 100);

  const compositeScore = Math.round(
    reliabilityScore * 0.45 + outputQualityScore * 0.35 + securityRating * 0.2
  );

  return {
    intrinsicHallucination,
    reliabilityScore,
    outputQualityScore,
    securityRating,
    compositeScore,
  };
}

function normalizeReason(text) {
  return (text || "").toLowerCase().trim();
}

export function scoreReasonExplanation(reasonExplanation, problemMeta = {}) {
  const r = normalizeReason(reasonExplanation);
  if (!r || r.length < 12) {
    return {
      reasonQualityScore: 0,
      reasonQualityLabel: "incorrect",
      matchedKeywords: [],
      hitAntiPatterns: [],
    };
  }

  const keywords = problemMeta.expectedReasonKeywords || [];
  const anti = problemMeta.antiPatterns || [];

  const matchedKeywords = keywords.filter((k) =>
    r.includes(k.toLowerCase())
  );
  const hitAntiPatterns = anti.filter((k) => r.includes(k.toLowerCase()));

  let score = 40;
  score += Math.min(40, matchedKeywords.length * 8);
  score -= Math.min(35, hitAntiPatterns.length * 12);
  if (r.length > 80) score += 5;
  score = clamp(score, 0, 100);

  let reasonQualityLabel = "incorrect";
  if (score >= 72) reasonQualityLabel = "correct";
  else if (score >= 38) reasonQualityLabel = "partial";

  return {
    reasonQualityScore: score,
    reasonQualityLabel,
    matchedKeywords,
    hitAntiPatterns,
  };
}

/** Adjust composite based on Yes/No reflection vs exercise ground truth. */
export function applyReflectionCompositeAdjustment(
  baseComposite,
  userHallucinationAnswerCorrect
) {
  let score = baseComposite;
  if (userHallucinationAnswerCorrect === true) score += 20;
  else if (userHallucinationAnswerCorrect === false) score -= 25;
  return clamp(Math.round(score), 0, 100);
}
