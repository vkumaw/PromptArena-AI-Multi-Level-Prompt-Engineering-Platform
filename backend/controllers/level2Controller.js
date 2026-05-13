import { evaluatePrompt } from "../utils/evaluate.js";
import { stripMarkdownCode } from "../services/testRunner.js";
import { buildLevel2ImprovementFeedback } from "../utils/level2ImprovementFeedback.js";
import UserData from "../models/userData.js";

function testPassPercent(record) {
  if (!record || !record.totalTestCases || record.totalTestCases <= 0)
    return undefined;
  return Math.round(
    ((record.testCasesPassed ?? 0) / record.totalTestCases) * 100
  );
}

/** GET saved attempts for read-only review (e.g. after 3/3 attempts or on revisit). */
export const getLevel2History = async (req, res) => {
  try {
    const problemId = req.query.problemId;
    const uid = (req.query.userId || "guest-user").toString();

    if (!problemId) {
      return res.status(400).json({ error: "problemId is required" });
    }

    const rows = await UserData.find({ userId: uid, problemId }).sort({
      timestamp: 1,
    });

    const records = rows.map((a, index) => ({
      version: index + 1,
      prompt: a.prompt,
      reliabilityScore: a.reliabilityScore ?? 0,
      promptScore: typeof a.promptScore === "number" ? a.promptScore : null,
      testCasesPassed: a.testCasesPassed ?? 0,
      totalTestCases: a.totalTestCases ?? 0,
      testScore:
        a.totalTestCases > 0
          ? Math.round(((a.testCasesPassed ?? 0) / a.totalTestCases) * 100)
          : 0,
      structureScore: a.structureScore ?? 0,
      aiOutput: a.aiOutput || a.generatedCode || "",
      timestamp: a.timestamp
        ? new Date(a.timestamp).toISOString()
        : new Date().toISOString(),
      feedback: Array.isArray(a.feedback) ? a.feedback : [],
    }));

    const evolutionHistory = records.map((r) => ({
      version: r.version,
      score: r.reliabilityScore,
      promptScore: r.promptScore,
      timestamp: r.timestamp,
    }));

    const attempts = records.length;
    const last = records[records.length - 1];
    const first = records[0];

    const showComparison =
      last && (last.reliabilityScore === 100 || attempts >= 3);

    let comparison = null;
    if (showComparison && first && last) {
      let improvementPercent = null;
      if (records.length >= 2) {
        const prevRel = records[records.length - 2].reliabilityScore ?? 0;
        improvementPercent = Math.round(
          (last.reliabilityScore ?? 0) - prevRel
        );
      }
      comparison = {
        before: first.prompt,
        after: last.prompt,
        improvementPercent,
      };
    }

    const lastRel = last?.reliabilityScore ?? 0;
    const efficiencyIndex =
      attempts > 0 ? Math.round(lastRel / attempts) : null;

    let feedback = [];
    if (last) {
      const stored = last.feedback;
      if (Array.isArray(stored) && stored.length > 0) {
        feedback = stored;
      } else if (records.length >= 1) {
        const lastRec = records[records.length - 1];
        const prevRec =
          records.length >= 2 ? records[records.length - 2] : null;
        feedback = buildLevel2ImprovementFeedback({
          currentPrompt: lastRec.prompt,
          previousPrompt: prevRec?.prompt ?? null,
          problem: null,
          metrics: {
            prevReliability: prevRec?.reliabilityScore,
            currentReliability: lastRec.reliabilityScore,
            prevTestPass: testPassPercent(prevRec),
            currentTestPass: testPassPercent(lastRec),
          },
        });
      }
    }

    res.json({
      attempts,
      records,
      evolutionHistory,
      comparison,
      efficiencyIndex,
      feedback,
      latest: last
        ? {
            reliabilityScore: last.reliabilityScore,
            promptScore: last.promptScore ?? undefined,
            testScore: last.testScore,
            testCasesPassed: last.testCasesPassed,
            totalTestCases: last.totalTestCases,
            aiOutput: stripMarkdownCode(last.aiOutput || ""),
            newVersion: {
              version: last.version,
              promptText: last.prompt,
              structureScore: last.structureScore,
              timestamp: last.timestamp,
            },
          }
        : null,
    });
  } catch (err) {
    console.error("Level 2 History Error:", err);
    res.status(500).json({ error: err.message });
  }
};

async function generateCodeFromOpenRouter(prompt, problem) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `
You are solving a coding problem.

Problem Title: ${problem?.title}
Problem Description: ${problem?.description}
Expected Output: ${problem?.expected_output}

Example Test Case:
${JSON.stringify(problem?.test_cases?.[0])}

User Prompt:
${prompt}

IMPORTANT:
- Solve THIS problem only
- Return only raw Python function code
- Do NOT use markdown code fences
- Do NOT explain anything
- Do NOT use input()
- Do NOT use print()
- Do NOT include example usage
`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} ${errText}`);
  }

  const payload = await response.json();
  const raw = payload.choices?.[0]?.message?.content || "";
  return stripMarkdownCode(raw);
}

export const handleLevel2 = async (req, res) => {
  try {
    const { userId, prompt, problem } = req.body;

    if (!prompt || !problem) {
      return res.status(400).json({ error: "Missing input" });
    }

    const problemId = problem?.problem_id ?? problem?.id;
    const uid = userId || "guest-user";

    const previousAttempts = await UserData.find({
      userId: uid,
      problemId,
    }).sort({ timestamp: 1 });

    if (previousAttempts.length >= 3) {
      return res.status(400).json({
        error: "Maximum 3 attempts reached for this problem.",
      });
    }

    const aiOutput = await generateCodeFromOpenRouter(prompt, problem);
    const result = await evaluatePrompt(prompt, problem, aiOutput, {
      combinedReliability: true,
    });

    const attempts = previousAttempts.length + 1;

    const efficiencyIndex =
      attempts > 0 ? Math.round(result.reliabilityScore / attempts) : null;

    const evolutionHistory = previousAttempts.map((a, index) => ({
      version: index + 1,
      score: a.reliabilityScore ?? 0,
      promptScore:
        typeof a.promptScore === "number" ? a.promptScore : null,
      timestamp: a.timestamp
        ? new Date(a.timestamp).toISOString()
        : new Date().toISOString(),
    }));

    evolutionHistory.push({
      version: attempts,
      score: result.reliabilityScore,
      promptScore:
        typeof result.promptScore === "number" ? result.promptScore : null,
      timestamp: new Date().toISOString(),
    });

    const prevDoc =
      previousAttempts.length > 0
        ? previousAttempts[previousAttempts.length - 1]
        : null;
    const prevPrompt = prevDoc?.prompt ?? null;

    const feedback = buildLevel2ImprovementFeedback({
      currentPrompt: prompt,
      previousPrompt: prevPrompt,
      problem,
      metrics: {
        prevReliability: prevDoc?.reliabilityScore,
        currentReliability: result.reliabilityScore,
        prevTestPass: testPassPercent(prevDoc),
        currentTestPass: testPassPercent({
          testCasesPassed: result.testCasesPassed,
          totalTestCases: result.totalTestCases,
        }),
      },
    });

    const showComparison =
      result.reliabilityScore === 100 || attempts >= 3;

    let comparison = null;
    if (showComparison) {
      const firstPrompt =
        previousAttempts.length > 0 ? previousAttempts[0].prompt : prompt;
      let improvementPercent = null;
      if (previousAttempts.length >= 1) {
        const prevRel =
          previousAttempts[previousAttempts.length - 1].reliabilityScore ??
          0;
        improvementPercent = Math.round(result.reliabilityScore - prevRel);
      }
      comparison = {
        before: firstPrompt,
        after: prompt,
        improvementPercent,
      };
    }

    await UserData.create({
      userId: uid,
      problemId,
      prompt,
      generatedCode: aiOutput,
      structureScore: result.structureScore,
      promptScore: result.promptScore ?? 0,
      reliabilityScore: result.reliabilityScore,
      effectivenessScore: result.effectivenessScore,
      ethicalScore: result.ethicalScore,
      hallucinationDetected: result.hallucinationDetected,
      testCasesPassed: result.testCasesPassed,
      totalTestCases: result.totalTestCases,
      testCaseDetails: result.testCaseResults,
      aiOutput,
      feedback,
      timestamp: new Date(),
    });

    res.json({
      ...result,
      aiOutput,
      evolutionHistory,
      efficiencyIndex,
      feedback,
      comparison,
      attempts,
      newVersion: {
        version: attempts,
        promptText: prompt,
        structureScore: result.structureScore,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Level 2 Error:", err);
    res.status(500).json({ error: err.message });
  }
};
