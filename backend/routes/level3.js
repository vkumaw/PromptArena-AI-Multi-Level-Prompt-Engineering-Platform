import express from "express";
import { level3CodingProblems } from "../../shared/level3CodingProblems.js";
import {
  analyzeAiResponseSnippet,
  scoreReasonExplanation,
  applyReflectionCompositeAdjustment,
} from "../../shared/level3CodingAnalyze.js";
import UserData from "../models/userData.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

function checkEthics(prompt) {
  const text = prompt.toLowerCase().trim();

  const severeWords = [
    "ransomware",
    "phishing",
    "malware",
    "virus",
    "trojan",
    "spyware",
    "hack account",
    "steal data",
    "steal password",
    "private data",
    "ddos",
    "blackmail",
    "extortion",
    "fake login page",
    "fake bank email",
    "bypass security",
    "without permission",
    "without being detected",
    "avoid detection",
    "illegal access",
    "unauthorized access",
  ];

  const mediumWords = [
    "hack",
    "bypass",
    "crack password",
    "spy",
    "surveillance",
    "fake identity",
    "biased hiring",
    "discriminate",
    "social engineering",
  ];

  const ethicalWords = [
    "i cannot help",
    "i cannot assist",
    "i will not help",
    "i will not assist",
    "i refuse",
    "i do not support",
    "this is unethical",
    "this violates policy",
    "not allowed",
    "illegal activity",
    "against ethical guidelines",
    "not appropriate",
    "instead explain",
    "instead provide",
    "prevention",
    "protection",
    "security awareness",
    "cybersecurity awareness",
    "report suspicious",
    "report to admin",
    "privacy protection",
    "fair hiring",
    "equal opportunity",
    "responsible ai",
    "ethical use",
    "legal guidelines",
    "authorized testing",
    "defensive purpose",
    "employee awareness",
    "safe practices",
  ];

  let severe = false;
  let medium = false;
  let ethical = false;

  severeWords.forEach((word) => {
    if (text.includes(word)) {
      severe = true;
    }
  });

  mediumWords.forEach((word) => {
    if (text.includes(word)) {
      medium = true;
    }
  });

  ethicalWords.forEach((word) => {
    if (text.includes(word)) {
      ethical = true;
    }
  });

  if (severe && !ethical) {
    return 15;
  }

  if (medium && !ethical) {
    return 35;
  }

  if ((severe || medium) && ethical) {
    return 95;
  }

  if (ethical) {
    return 95;
  }

  return 60;
}

function buildCodingRationale({
  problem,
  analysis,
  gt,
  userBelief,
  userCorrect,
  reasonScoring,
}) {
  const lines = [];

  lines.push(
    `Ground truth (this exercise): ${
      gt
        ? "the canonical snippet counts as hallucinating / unreliable."
        : "the canonical snippet is not treated as a hallucination."
    }`
  );

  lines.push(
    `Automated scan of your pasted AI output: ${
      analysis.intrinsicHallucination
        ? "possible hallucination-style issues detected (fake deps, dead logic, etc.)."
        : "no strong hallucination-style signals detected."
    }`
  );

  if (userBelief === null) {
    lines.push(
      "Select Yes or No for whether you believe the AI output hallucinates."
    );
  } else if (userCorrect) {
    lines.push(
      "Your Yes/No answer matches the exercise ground truth—nice work."
    );
  } else {
    lines.push(
      "Your Yes/No answer does not match this exercise's ground truth; compare with the automated scan and keywords below."
    );
  }

  lines.push(
    `Explanation quality: ${reasonScoring.reasonQualityLabel} (${reasonScoring.reasonQualityScore}/100).`
  );

  if (problem?.title) {
    lines.push(`Scenario: ${problem.title}.`);
  }

  return lines.join(" ");
}

/** GET saved Level 3 coding attempts for read-only review after 3/3 or on revisit. */
router.get("/history", verifyToken, async (req, res) => {
  try {
    const problemId = req.query.problemId;
    const userId = req.user.userId.toString();

    if (!problemId) {
      return res.status(400).json({ error: "problemId is required" });
    }

    const rows = await UserData.find({
      userId,
      problemId,
      level: 3,
    }).sort({ timestamp: 1 });

    const records = rows.map((row, index) => ({
      attempt: index + 1,
      compositeScore: row.effectivenessScore ?? 0,
      reasonQualityScore: row.ethicalScore ?? 0,
      believesHallucination: row.hallucinationDetected ?? null,
      reliabilityScore: row.reliabilityScore ?? 0,
      outputQualityScore: row.outputQualityScore ?? 0,
securityRating: row.securityRating ?? 0,
      userPrompt: row.prompt ?? "",
      aiResponseText: row.generatedCode ?? "",
      timestamp: row.timestamp
        ? new Date(row.timestamp).toISOString()
        : new Date().toISOString(),
      matchedKeywords: Array.isArray(row.feedback) ? row.feedback : [],
    }));

    return res.json({
      attempts: records.length,
      records,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load Level 3 history" });
  }
});

router.post("/", verifyToken, async (req, res) => {
  const { promptText, mode } = req.body;

  if (mode === "ethical") {
    const ethicalIntegrityScore = checkEthics(promptText || "");

    let rationale = "";

    if (ethicalIntegrityScore >= 90) {
      rationale =
        "Strong ethical response. Safe, responsible, and clearly avoids harmful actions.";
    } else if (ethicalIntegrityScore >= 70) {
      rationale =
        "Mostly ethical response. Safe overall, but stronger refusal and safer framing would improve it.";
    } else if (ethicalIntegrityScore >= 40) {
      rationale =
        "Questionable response. Some risky intent or unclear ethical boundaries were detected.";
    } else {
      rationale =
        "Highly unethical response detected. Harmful or illegal intent is present.";
    }
    const userId = req.user.userId.toString();
const ethicalProblemId = `ethical-${req.body.scenarioId || "default"}`;

const previousEthical = await UserData.find({
  userId,
  problemId: ethicalProblemId,
  level: 3,
});

if (previousEthical.length >= 1) {
  return res.status(400).json({
    error: "Maximum 1 attempt reached for this ethical scenario.",
  });
}

await UserData.create({
  userId,
  problemId: ethicalProblemId,
  level: 3,
  prompt: promptText || "",
  effectivenessScore: ethicalIntegrityScore,
  ethicalScore: ethicalIntegrityScore,
  timestamp: new Date(),
});

    return res.json({
      ethicalIntegrityScore,
      rationale,
    });
  }

  // --- Coding reliability / hallucination (structured exercises) ---
  const {
    userPrompt,
    aiResponseText,
    believesHallucination,
    reasonExplanation,
    problemId,
    scenarioId,
  } = req.body;

  const pid = problemId || scenarioId;
  const userId = req.user.userId.toString();

  const previousAttempts = await UserData.find({
    userId,
    problemId: pid,
    level: 3,
  });

  if (previousAttempts.length >= 1) {
    return res.status(400).json({
      error: "Maximum 1 attempts reached for this coding problem.",
    });
  }

  const problem = level3CodingProblems.find((p) => p.problemId === pid);

  if (!problem) {
    return res.status(400).json({
      error:
        "Unknown coding problem. Send problemId (e.g. l3-1) from the Level 3 coding list.",
    });
  }

  const snippet = (aiResponseText ?? "").trim();
  if (!snippet) {
    return res.status(400).json({
      error: "Paste the AI response (Step 2) so it can be analyzed.",
    });
  }

  const analysis = analyzeAiResponseSnippet(snippet);
  const explanationSource =
    typeof reasonExplanation === "string" && reasonExplanation.trim()
      ? reasonExplanation
      : typeof promptText === "string"
        ? promptText
        : "";

  const reasonScoring = scoreReasonExplanation(explanationSource, problem);

  const gt = !!problem.groundTruthHallucination;
  const userBelief =
    typeof believesHallucination === "boolean" ? believesHallucination : null;

  const userHallucinationAnswerCorrect =
    userBelief === null ? null : userBelief === gt;

  const adjustedComposite = applyReflectionCompositeAdjustment(
    analysis.compositeScore,
    userHallucinationAnswerCorrect
  );

  const rationale = buildCodingRationale({
    problem,
    analysis,
    gt,
    userBelief,
    userCorrect: userHallucinationAnswerCorrect,
    reasonScoring,
  });

  const attempts = previousAttempts.length + 1;

  await UserData.create({
    userId,
    problemId: pid,
    level: 3,
    prompt: typeof userPrompt === "string" ? userPrompt : "",
    generatedCode: aiResponseText,
    hallucinationDetected: userBelief,
    reliabilityScore: analysis.reliabilityScore,
    outputQualityScore: analysis.outputQualityScore,
securityRating: analysis.securityRating,
    effectivenessScore: adjustedComposite,
    ethicalScore: reasonScoring.reasonQualityScore,
    feedback: reasonScoring.matchedKeywords ?? [],
    timestamp: new Date(),
  });

  return res.json({
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
    userPromptReceived: typeof userPrompt === "string" ? userPrompt : "",
    attempts,
  });
});

export default router;
