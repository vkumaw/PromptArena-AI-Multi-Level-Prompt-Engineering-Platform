import { execFileSync } from "child_process";
import fs from "fs";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const PYTHON_CANDIDATES = ["python3", "python", "py"];
const PYTHON_NOT_FOUND_MSG =
  "No Python interpreter found. Tried: python3, python, py. Install Python 3 and ensure it is on PATH.";

/** @type {string | null | undefined} */
let cachedPythonCommand;

/**
 * Resolve the first available Python executable (python3 → python → py).
 * @returns {string | null}
 */
export function getPythonCommand() {
  if (cachedPythonCommand !== undefined) {
    return cachedPythonCommand;
  }

  for (const cmd of PYTHON_CANDIDATES) {
    try {
      execFileSync(cmd, ["--version"], {
        encoding: "utf8",
        timeout: 5000,
        stdio: "pipe",
      });
      cachedPythonCommand = cmd;
      return cmd;
    } catch {
      /* try next candidate */
    }
  }

  cachedPythonCommand = null;
  return null;
}

/**
 * Run a Python script file with the resolved interpreter.
 * @throws {Error} When no interpreter is available or execution fails
 */
function execPythonScript(scriptPath, options = {}) {
  const python = getPythonCommand();
  if (!python) {
    const err = new Error(PYTHON_NOT_FOUND_MSG);
    err.code = "PYTHON_NOT_FOUND";
    throw err;
  }

  return execFileSync(python, [scriptPath], {
    encoding: "utf8",
    timeout: 5000,
    ...options,
  });
}

/** Strip markdown fences and language tags from model output before execution */
export function stripMarkdownCode(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/^```(?:[\w+-]+)?\s*\r?\n?/i, "");
  s = s.replace(/\r?\n?```\s*$/i, "");
  s = s.replace(/```(?:python|py|javascript|js)?/gi, "").replace(/```/g, "");
  return s.trim();
}

/**
 * Legacy display convention in problems.ts: expectedOutput sometimes wrapped in extra quotes.
 * Strip only outer decorative quotes for scalar comparisons (not full JSON normalization).
 */
export function stripDecorativeQuotes(raw) {
  let s = String(raw ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

/**
 * Compare printed Python values with problems.ts expectations.
 * - First: strict string equality (normalized trim).
 * - If either side looks like a Python dict/list/tuple/set literal and strict failed,
 *   compare via ast.literal_eval in Python for structural equality (handles JSON-like
 *   expected strings vs Python repr actual output with single-quoted keys).
 * Booleans and numbers still match exactly via strict path first.
 */
export function outputsStructurallyEqual(actualRaw, expectedRaw) {
  const actual = String(actualRaw ?? "").trim();
  const expected = stripDecorativeQuotes(expectedRaw);

  if (actual === expected) return true;

  const structuralHint = (s) =>
    /^[\[{()]/.test(s) ||
    /^(True|False|None)$/.test(s.trim()) ||
    /^-?\d+(\.\d+)?$/.test(s.trim());
  if (!structuralHint(actual) && !structuralHint(expected)) return false;

  const dir = mkdtempSync(join(tmpdir(), "pa-cmp-"));
  try {
    const scriptPath = join(dir, "cmp_literals.py");
    const aPath = join(dir, "a.txt");
    const bPath = join(dir, "b.txt");
    writeFileSync(aPath, actual, "utf8");
    writeFileSync(bPath, expected, "utf8");
    writeFileSync(
      scriptPath,
      `import ast
with open(r"${aPath.replace(/\\/g, "\\\\")}", encoding="utf-8") as f:
    a = f.read()
with open(r"${bPath.replace(/\\/g, "\\\\")}", encoding="utf-8") as f:
    b = f.read()
try:
    va, vb = ast.literal_eval(a), ast.literal_eval(b)
    print(va == vb)
except Exception:
    print(False)
`,
      "utf8"
    );
    const out = execPythonScript(scriptPath).toString().trim();
    return out === "True";
  } catch {
    return false;
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export function runTestCases(problem, code) {
  if (!problem || !problem.test_cases) {
    return { passed: 0, total: 0, results: [] };
  }

  const functionName = extractFunctionName(code) || "solution";
  const pythonCmd = getPythonCommand();
  const pythonMissingMessage = pythonCmd ? null : PYTHON_NOT_FOUND_MSG;

  const results = [];
  let passed = 0;

  problem.test_cases.forEach((tc, index) => {
    const fileName = `temp_${Date.now()}_${index}.py`;

    if (pythonMissingMessage) {
      const expectedFlat = stripDecorativeQuotes(tc.expectedOutput);
      results.push({
        input: tc.input,
        expected: expectedFlat,
        expectedOutput: expectedFlat,
        actual: pythonMissingMessage,
        actualOutput: pythonMissingMessage,
        passed: false,
      });
      return;
    }

    try {
      let cleanCode = stripMarkdownCode(code);

      cleanCode = cleanCode
        .split("\n")
        .filter(
          (line) =>
            !line.includes("input(") &&
            !line.includes("print(") &&
            !line.includes("Enter a number")
        )
        .join("\n");

      const pythonCode = `
${cleanCode}

try:
    result = ${functionName}(${formatInput(tc.input)})
    print(result)
except Exception as e:
    print("ERROR")
`;

      fs.writeFileSync(fileName, pythonCode);

      const output = execPythonScript(fileName)
        .toString()
        .trim()
        .split("\n")
        .pop();

      const expectedDisplay = String(tc.expectedOutput ?? "").trim();
      const expectedFlat = stripDecorativeQuotes(tc.expectedOutput);

      const isPass =
        output === expectedFlat ||
        outputsStructurallyEqual(output, expectedDisplay);

      if (isPass) passed++;

      results.push({
        input: tc.input,
        expected: expectedFlat,
        expectedOutput: expectedFlat,
        actual: output,
        actualOutput: output,
        passed: isPass,
      });
    } catch {
      results.push({
        input: tc.input,
        expected: tc.expectedOutput,
        expectedOutput: String(tc.expectedOutput ?? ""),
        actual: "Error",
        actualOutput: "Error",
        passed: false,
      });
    } finally {
      if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
      }
    }
  });

  return {
    passed,
    total: problem.test_cases.length,
    results,
  };
}

function extractFunctionName(code) {
  const match = code.match(/def\s+(\w+)\s*\(/);
  return match ? match[1] : null;
}

function formatInput(input) {
  if (input.startsWith('"') || input.startsWith("'")) return input;
  return input;
}
