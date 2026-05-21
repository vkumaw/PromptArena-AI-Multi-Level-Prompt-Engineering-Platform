/**
 * Single source for Level 3 coding exercises (imported by backend; re-exported to frontend).
 * groundTruthHallucination: whether the canonical AI response should be labeled hallucinating
 * for teaching purposes (invalid deps, impossible APIs, broken logic), distinct from security-only issues.
 */
export const level3CodingProblems = [
  {
    problemId: "l3-1",
    title: "Fake dependency",
    summary:
      "Model output imports a non-existent package and skips real validation.",
    sampleUserPrompt:
      "Write Python code for user authentication with login and password check.",
    sampleAiResponse: `import fakeai.security

def authenticate(username, password):
    fakeai.security.verify(username)
    return True`,
    groundTruthHallucination: true,
    expectedReasonKeywords: [
      "import",
      "fake",
      "library",
      "does not exist",
      "hallucin",
      "invalid",
      "verify",
    ],
    antiPatterns: ["looks fine", "correct", "no issue", "works"],
  },
  {
    problemId: "l3-2",
    title: "Solid helper function",
    summary: "Straightforward prime check with edge handling — no invented APIs.",
    sampleUserPrompt:
      "Python function is_prime(n) returning True iff n is prime, handle n < 2.",
    sampleAiResponse: `def is_prime(n):
    if n < 2:
        return False
    i = 2
    while i * i <= n:
        if n % i == 0:
            return False
        i += 1
    return True`,
    groundTruthHallucination: false,
    expectedReasonKeywords: [
      "no",
      "not",
      "standard",
      "valid",
      "math",
      "loop",
      "edge",
      "def",
    ],
    antiPatterns: [
  "looks hallucinated",
  "fake dependency",
  "broken logic",
],
  },
  {
    problemId: "l3-3",
    title: "Hardcoded credentials",
    summary:
      "Runs but embeds plaintext secrets — unsafe, but not a fake library/API hallucination.",
    sampleUserPrompt: "Implement login(user, password) for our demo admin panel.",
    sampleAiResponse: `ADMIN_PASSWORD = "admin123"

def login(user, password):
    if password == ADMIN_PASSWORD:
        return True
    return False`,
    groundTruthHallucination: false,
    expectedReasonKeywords: [
      "password",
      "hardcoded",
      "secret",
      "security",
      "unsafe",
      "plaintext",
    ],
    antiPatterns: [
  "hallucinated api",
  "fake dependency",
  "undefined function call",
],
  },
  {
    problemId: "l3-4",
    title: "Undefined callee",
    summary: "Calls a function that is never defined — classic hallucination.",
    sampleUserPrompt: "Compute factorial using an optimized helper.",
    sampleAiResponse: `def factorial(n):
    return fast_fact(n)

def fast_fact(x):
    undefined_gamma(x)`,
    groundTruthHallucination: true,
    expectedReasonKeywords: [
      "undefined",
      "not defined",
      "missing",
      "call",
      "gamma",
      "hallucin",
    ],
    antiPatterns: ["looks correct", "fine", "no bug"],
  },
  {
    problemId: "l3-5",
    title: "Clean merge",
    summary: "Standard merge of two sorted lists — plausible and consistent.",
    sampleUserPrompt: "Merge two sorted lists into one sorted list in Python.",
    sampleAiResponse: `def merge_sorted(a, b):
    out = []
    i = j = 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i])
            i += 1
        else:
            out.append(b[j])
            j += 1
    out.extend(a[i:])
    out.extend(b[j:])
    return out`,
    groundTruthHallucination: false,
    expectedReasonKeywords: [
      "merge",
      "two pointer",
      "valid",
      "sorted",
      "standard",
      "no fake",
    ],
    antiPatterns: [
  "broken logic",
  "fake dependency",
  "undefined function",
],
  },
  {
    problemId: "l3-6",
    title: "Broken control flow",
    summary:
      "Unreachable code after return — indicates unreliable / contradictory generation.",
    sampleUserPrompt: "Return the maximum of two numbers.",
    sampleAiResponse: `def maximum(a, b):
    return a
    if b > a:
        return b`,
    groundTruthHallucination: true,
    expectedReasonKeywords: [
      "unreachable",
      "dead",
      "after return",
      "wrong",
      "logic",
      "hallucin",
      "bug",
    ],
    antiPatterns: ["perfect", "always correct"],
  },
  {
    problemId: "l3-7",
    title: "Phantom HTTP API",
    summary: "Uses a fabricated SDK method that does not exist.",
    sampleUserPrompt: "Fetch user profile JSON from our REST service in Python.",
    sampleAiResponse: `from requests_plus import fetch_json

def load_profile(user_id):
    return fetch_json(f"https://api.example.com/users/{user_id}/profile")`,
    groundTruthHallucination: true,
    expectedReasonKeywords: [
      "requests_plus",
      "import",
      "does not exist",
      "fake",
      "module",
      "hallucin",
      "fabricated",
    ],
    antiPatterns: [
  "valid package",
  "safe dependency",
  "official library",
],
  },
];
