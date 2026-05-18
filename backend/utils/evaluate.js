import { calculateScore } from "../../src/app/utils/scoring.js";
import { checkEthics } from "../../src/app/utils/ethics.js";
import { detectHallucination } from "../../src/app/utils/hallucination.js";
import { runTestCases } from "../services/testRunner.js";
import {
  computePromptScore,
  applyLevel1PromptQualityAdjustments,
  capLevel1StructureScore,
  resolveProblemForSimilarity,
  buildLevel1Feedback,
} from "./promptQuality.js";

/**
 * Level 1 reliability only: mostly test pass rate, small prompt-quality term.
 * reliability = round((testPassRate * 0.82) + (predictedSuccess * 0.18))
 */
export function computeLevel1Reliability(testPassRate, predictedSuccess) {
  const testPct = Number.isFinite(testPassRate) ? testPassRate : 0;
  const pred = Number.isFinite(predictedSuccess) ? predictedSuccess : 0;
  return Math.min(
    100,
    Math.max(0, Math.round(testPct * 0.82 + pred * 0.18))
  );
}

/**
 * @param {string} prompt
 * @param {object} problem
 * @param {string} generatedCode
 * @param {{ combinedReliability?: boolean; testResult?: { passed: number; total: number; results?: unknown[] } }} [options]
 */
export async function evaluatePrompt(
  prompt,
  problem,
  generatedCode,
  options = {}
) {
  const aiOutput = generatedCode;

  const testResult =
    options.testResult != null
      ? options.testResult
      : runTestCases(problem, aiOutput);
  const passed = testResult.passed ?? 0;
  const total = testResult.total ?? 0;

  if (options.combinedReliability) {
    // Level 2: combined reliability path
    const structureScore = calculateScore(prompt) || 0;
    const reliabilityRaw =
      total > 0 ? (passed / total) * 100 : 0;
    const testScore = reliabilityRaw;
    const promptScore = computePromptScore(prompt, problem);
    const reliabilityScore = Math.round(promptScore * 0.6 + testScore * 0.4);
    const ethicalScore = checkEthics(prompt) || 0;
    const hallucinationDetected = detectHallucination(prompt);
    const effectivenessScore = Math.round(
      (structureScore || 0) * 0.6 + (reliabilityScore || 0) * 0.4
    );

    return {
      structureScore: structureScore || 0,
      reliabilityScore,
      effectivenessScore,
      ethicalScore,
      hallucinationDetected,
      testCasesPassed: passed,
      totalTestCases: total,
      testCaseResults: testResult.results || [],
      aiOutput,
      promptScore,
      testScore: Math.round(testScore),
    };
  }

  // --- Level 1: aligned with Level 2 (prompt quality + test pass rate) ---

  const normalizedPrompt = (prompt || "").trim();
  const testPassRate = total > 0 ? (passed / total) * 100 : 0;

  const problemForQuality = resolveProblemForSimilarity(problem);

  const basePromptScore = computePromptScore(
    prompt,
    problemForQuality,
    { level1: true }
  );
  const rawStructureScore = !normalizedPrompt
    ? 0
    : Math.max(1, Math.min(10, Math.round(basePromptScore / 10)));

  const quality = applyLevel1PromptQualityAdjustments(
    basePromptScore,
    normalizedPrompt,
    problemForQuality
  );
  const promptScore = quality.promptScore;

  const structureBeforeCap = !normalizedPrompt
    ? 0
    : Math.max(1, Math.min(10, Math.round(promptScore / 10)));

  const structureScore = capLevel1StructureScore(structureBeforeCap, quality);

  console.log("[Level1 structure score]", {
    rawStructureScore,
    similarityPct: Math.round((quality.similarity ?? 0) * 100),
    structureAfterPromptAdjust: structureBeforeCap,
    finalStructureScore: structureScore,
    isCopyPaste: quality.isCopyPaste,
    addedEngineering: quality.addedEngineering,
  });

  const predictedSuccess = Math.min(100, Math.max(0, structureScore * 10));

  const reliability = computeLevel1Reliability(testPassRate, predictedSuccess);

  const effectiveness = Math.min(
    100,
    Math.max(0, Math.round(predictedSuccess * 0.5 + reliability * 0.5))
  );

  const feedback = buildLevel1Feedback(normalizedPrompt, problem, {
    isCopyPaste: quality.isCopyPaste,
    highSimilarity: quality.highSimilarity,
    testPassRate: Math.round(testPassRate),
  });

  return {
    structureScore,
    predictedSuccess,
    reliability,
    effectiveness,
    passed,
    total,
    promptScore: Math.round(promptScore),
    testPassRate: Math.round(testPassRate),
    feedback,
  };
}
