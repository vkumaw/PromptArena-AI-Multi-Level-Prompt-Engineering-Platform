import fetch from "node-fetch";
import dotenv from "dotenv";
import { evaluatePrompt, computeLevel1Reliability } from "../utils/evaluate.js";
import { runTestCases } from "../services/testRunner.js";
import { checkEthics } from "../../src/app/utils/ethics.js";
import { detectHallucination } from "../../src/app/utils/hallucination.js";
import UserData from "../models/userData.js";

dotenv.config();

const LEVEL1_TAG = 1;

function mapTestCaseDetails(details) {
  if (!Array.isArray(details)) return [];
  return details.map((row) => ({
    input: row.input ?? "",
    expectedOutput:
      row.expectedOutput ?? row.expected ?? String(row.expected ?? ""),
    actualOutput: row.actualOutput ?? row.actual ?? "Error",
    passed: Boolean(row.passed),
  }));
}

/** Map MongoDB document → Level 1 API payload (saved / live). */
export function mapUserDataToLevel1Response(doc) {
  const total = doc.totalTestCases ?? 0;
  const passed = doc.testCasesPassed ?? 0;
  const testPassRate =
    typeof doc.testPassRate === "number"
      ? doc.testPassRate
      : total > 0
        ? Math.round((passed / total) * 100)
        : 0;
  const predictedSuccess =
    doc.predictedSuccess ??
    Math.min(100, Math.max(0, (doc.structureScore ?? 0) * 10));

  return {
    structureScore: doc.structureScore ?? 0,
    predictedSuccess,
    successProbability: predictedSuccess,
    reliability: doc.reliabilityScore ?? 0,
    reliabilityScore: doc.reliabilityScore ?? 0,
    effectiveness: doc.effectivenessScore ?? 0,
    effectivenessScore: doc.effectivenessScore ?? 0,
    passed,
    total,
    testCasesPassed: passed,
    totalTestCases: total,
    testCaseResults: mapTestCaseDetails(doc.testCaseDetails),
    feedback: Array.isArray(doc.feedback) ? doc.feedback : [],
    generatedCode: doc.generatedCode || doc.aiOutput || "",
    promptScore:
      typeof doc.promptScore === "number" ? doc.promptScore : undefined,
    testPassRate,
    prompt: doc.prompt ?? "",
  };
}

function authUserIdString(raw) {
  if (raw == null || raw === "") return null;
  return String(raw).trim();
}

async function findLevel1Attempt(userId, problemId) {
  const uid = authUserIdString(userId);
  if (!uid) return null;
  return UserData.findOne({ userId: uid, problemId, level: LEVEL1_TAG }).sort({
    timestamp: -1,
  });
}

/** GET saved Level 1 attempt for read-only review (one attempt per user + problem). */
export const getLevel1History = async (req, res) => {
  try {
    const problemId = req.query.problemId;
    const userId = authUserIdString(req.user?.userId);

    if (!problemId) {
      return res.status(400).json({ error: "problemId is required" });
    }
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const doc = await findLevel1Attempt(userId, problemId);

    if (!doc) {
      return res.json({ attempted: false, savedResult: null });
    }

    res.json({
      attempted: true,
      savedResult: mapUserDataToLevel1Response(doc),
    });
  } catch (err) {
    console.error("Level 1 History Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const handleLevel1 = async (req, res) => {
  try {
    const { prompt, problem } = req.body;
    const userId = authUserIdString(req.user.userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const problemId = problem?.problem_id ?? problem?.id;
    if (!problemId) {
      return res.status(400).json({ error: "Missing problem" });
    }

    const existing = await findLevel1Attempt(userId, problemId);
    if (existing) {
      return res.json({
        alreadyAttempted: true,
        savedResult: mapUserDataToLevel1Response(existing),
      });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `
You are a Python coding assistant.

Rules:
- Return ONLY raw Python function code
- Do NOT include explanations
- Do NOT include markdown
- Do NOT use input()
- Do NOT use print()
- Do NOT include example usage
- Only define the required function
`,
            },
            {
              role: "user",
              content: `
Problem Title: ${problem?.title}

Problem Description:
${problem?.description}

Expected Output:
${problem?.expected_output}

User Prompt:
${prompt}
`,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    const generatedCode =
      data.choices?.[0]?.message?.content || "No response";

    const testDetails = runTestCases(problem, generatedCode);
    const result = await evaluatePrompt(prompt, problem, generatedCode, {
      testResult: testDetails,
    });

    const ethicalScore = checkEthics(prompt) || 0;
    const hallucinationDetected = detectHallucination(prompt);

    const testPassRateForReliability =
      result.total > 0 ? (result.passed / result.total) * 100 : 0;
    const reliabilityScore = computeLevel1Reliability(
      testPassRateForReliability,
      result.predictedSuccess
    );

    await UserData.create({
      userId,
      problemId,
      level: LEVEL1_TAG,
      prompt,
      generatedCode,
      structureScore: result.structureScore,
      predictedSuccess: result.predictedSuccess,
      promptScore: result.promptScore ?? 0,
      testPassRate: result.testPassRate ?? 0,
      reliabilityScore,
      effectivenessScore: result.effectiveness,
      ethicalScore,
      hallucinationDetected,
      testCasesPassed: result.passed,
      totalTestCases: result.total,
      testCaseDetails: testDetails.results || [],
      aiOutput: generatedCode,
      feedback: result.feedback ?? [],
      timestamp: new Date(),
    });

    const payload = {
      alreadyAttempted: false,
      structureScore: result.structureScore,
      predictedSuccess: result.predictedSuccess,
      reliability: reliabilityScore,
      effectiveness: result.effectiveness,
      passed: result.passed,
      total: result.total,
      promptScore: result.promptScore,
      testPassRate: result.testPassRate,
      successProbability: result.predictedSuccess,
      reliabilityScore,
      effectivenessScore: result.effectiveness,
      testCasesPassed: result.passed,
      totalTestCases: result.total,
      testCaseResults: testDetails.results || [],
      feedback: result.feedback ?? [],
      generatedCode,
      prompt,
    };

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
