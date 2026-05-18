import { apiPath } from '../utils/apiBase';

export async function generateCode(prompt) {
  const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "PromptArena Project",
    },
    body: JSON.stringify({
      model: "openai/gpt-3.5-turbo", // ✅ FIXED
      messages: [
        { role: "user", content: prompt }
      ],
    }),
  });

  const data = await response.json();

  return data?.choices?.[0]?.message?.content || "No response";
}
export const fetchLevel1History = async (problemId, token) => {
  const response = await fetch(
    apiPath(`/level1/history?problemId=${encodeURIComponent(problemId)}`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from server.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "Failed to load saved attempt");
  }

  return data;
};

export const generateCodeFromAI = async (prompt, problem, token) => {
  let response;
  try {
    response = await fetch(apiPath("/level1"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt,
        problem
      })
    });
  } catch {
    throw new Error(
      "Cannot reach the API server. From the project root, run the backend: cd backend && npm run dev (port 3000), then reload this page."
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from server.");
  }

  if (!response.ok) {
    throw new Error(data?.error || "Failed to evaluate prompt");
  }

  return data;
};