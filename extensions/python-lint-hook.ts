/**
 * Python Lint Hook Extension for pi (Global)
 *
 * Automatically runs `ruff check && pyright` after any Python file edit
 * and sends errors back to the agent for fixing.
 *
 * Activation: Detects Python projects by checking for:
 * - pyproject.toml
 * - setup.py
 * - .python-version
 * - app/ directory with .py files
 *
 * Commands: Runs `ruff check --fix . && pyright` (or pyright app/ if app/ exists)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Cache for Python project detection
let isPythonProject: boolean | null = null;
let projectType: "app" | "standard" | null = null;

// Track if we're already linting to avoid infinite loops
let isLinting = false;
let pendingLint = false;

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // Reset cache on new session
    isPythonProject = null;
    projectType = null;

    if (detectPythonProject()) {
      const target = projectType === "app" ? "app/" : ".";
      ctx.ui.notify(`Python lint hook loaded - will run ruff check && pyright ${target} after edits`, "info");
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    // Only process edit and write tools
    if (event.toolName !== "edit" && event.toolName !== "write") {
      return;
    }

    // Skip if this was an error
    if (event.isError) {
      return;
    }

    // Get the file path from the tool input
    const input = event.input as { path?: string };
    const filePath = input.path;

    if (!filePath || !filePath.endsWith(".py")) {
      return;
    }

    // Skip test files, migrations, and virtual environments
    if (
      filePath.includes("node_modules") ||
      filePath.includes(".venv") ||
      filePath.includes("venv") ||
      filePath.includes("__pycache__") ||
      filePath.includes("/migrations/") ||
      filePath.includes("/tests/") ||
      filePath.includes("test_") ||
      filePath.includes("_test.py")
    ) {
      return;
    }

    // Check if this is a Python project (cached)
    if (!detectPythonProject()) {
      return;
    }

    // Avoid re-entrant linting
    if (isLinting) {
      pendingLint = true;
      return;
    }

    isLinting = true;

    try {
      await runLintAndReport(ctx);
    } finally {
      isLinting = false;

      // If a lint was requested while we were linting, run it now
      if (pendingLint) {
        pendingLint = false;
        setTimeout(() => runLintAndReport(ctx), 100);
      }
    }
  });

  function detectPythonProject(): boolean {
    if (isPythonProject !== null) {
      return isPythonProject;
    }

    const cwd = process.cwd();

    // Check for Python project indicators
    const hasPyproject = existsSync(join(cwd, "pyproject.toml"));
    const hasSetup = existsSync(join(cwd, "setup.py"));
    const hasPythonVersion = existsSync(join(cwd, ".python-version"));
    const hasAppDir = existsSync(join(cwd, "app"));

    if (hasPyproject || hasSetup || hasPythonVersion) {
      isPythonProject = true;
      projectType = hasAppDir ? "app" : "standard";
      return true;
    }

    isPythonProject = false;
    return false;
  }

  async function runLintAndReport(ctx: unknown) {
    const cwd = process.cwd();
    const target = projectType === "app" ? "app" : ".";

    // @ts-expect-error - ctx typing is complex
    ctx.ui.notify?.(`Running ruff check && pyright ${target}...`, "info");

    // Run ruff check with auto-fix first
    const ruffResult = await runCommand("ruff", ["check", "--fix", target], cwd);

    // Run pyright
    const pyrightResult = await runCommand("pyright", [target], cwd);

    // Combine errors
    const errors: string[] = [];

    if (ruffResult.exitCode !== 0 && ruffResult.stderr) {
      errors.push(`=== Ruff Errors ===\n${ruffResult.stderr}`);
    }

    if (pyrightResult.exitCode !== 0) {
      const pyrightErrors = parsePyrightErrors(pyrightResult.stdout);
      if (pyrightErrors) {
        errors.push(`=== Pyright Errors ===\n${pyrightErrors}`);
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Python lint/type errors found. Please fix ALL errors (including pre-existing ones):

${errors.join("\n\n")}

Instructions:
1. Fix each error one by one
2. Do NOT skip or ignore any errors
3. Do NOT use type: ignore comments unless absolutely necessary
4. For ruff errors, try to fix the underlying issue rather than adding # noqa
5. Ensure proper type annotations on all functions
6. Run ruff check && pyright again after fixes to verify`;

      // Send a steering message to interrupt and get the agent to fix
      pi.sendUserMessage(errorMessage, { mode: "steer" });

      // @ts-expect-error - ctx typing is complex
      ctx.ui.notify?.("Lint/type errors found - sending to agent for fixing", "warning");
    } else {
      // @ts-expect-error - ctx typing is complex
      ctx.ui.notify?.("✓ No lint/type errors", "info");
    }
  }

  function runCommand(command: string, args: string[], cwd: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, {
        cwd,
        shell: true,
        timeout: 120000, // 2 minute timeout for large projects
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
        });
      });

      proc.on("error", (err) => {
        resolve({
          exitCode: 1,
          stdout: "",
          stderr: `Failed to run ${command}: ${err.message}`,
        });
      });
    });
  }

  function parsePyrightErrors(output: string): string {
    if (!output.trim()) return "";

    // Pyright outputs errors in a specific format
    // Error lines typically have format: "  path:line:column - error: message"
    const lines = output.split("\n");
    const errorLines: string[] = [];
    let foundErrors = false;

    for (const line of lines) {
      // Error lines typically have format: "  path:line:column - error: message"
      if (line.includes(" - error:") || line.includes(" - warning:")) {
        errorLines.push(line);
        foundErrors = true;
      } else if (foundErrors && line.startsWith("  ") && !line.includes("errors,") && !line.includes("warnings,") && !line.includes("files checked")) {
        // Continuation of error message
        errorLines.push(line);
      }
    }

    return errorLines.join("\n").trim();
  }
}
