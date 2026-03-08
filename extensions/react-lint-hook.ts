/**
 * React Lint Hook Extension for pi (Global)
 *
 * Automatically runs lint and typecheck after any React/TypeScript file edit
 * and sends errors back to the agent for fixing.
 *
 * Activation: Detects React projects by checking for:
 * - package.json with "react" in dependencies
 * - .tsx/.jsx files in src/ directory
 *
 * Commands: Tries in order:
 * - bun run lint && bun run typecheck
 * - npm run lint && npm run typecheck
 * - yarn lint && yarn typecheck
 * - pnpm lint && pnpm typecheck
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Cache for React project detection
let isReactProject: boolean | null = null;
let packageManager: string | null = null;

// Track if we're already linting to avoid infinite loops
let isLinting = false;
let pendingLint = false;

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // Reset cache on new session
    isReactProject = null;
    packageManager = null;

    if (detectReactProject()) {
      ctx.ui.notify(`React lint hook loaded - will run ${getPackageManager()} run lint && typecheck after edits`, "info");
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

    if (!filePath) {
      return;
    }

    // Only process TypeScript/JavaScript files
    const validExtensions = [".ts", ".tsx", ".js", ".jsx"];
    if (!validExtensions.some((ext) => filePath.endsWith(ext))) {
      return;
    }

    // Skip test files, config files, and node_modules
    if (
      filePath.includes(".test.") ||
      filePath.includes(".spec.") ||
      filePath.includes("__tests__") ||
      filePath.includes("node_modules") ||
      filePath.includes(".config.") ||
      filePath.endsWith(".d.ts")
    ) {
      return;
    }

    // Check if this is a React project (cached)
    if (!detectReactProject()) {
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

  function detectReactProject(): boolean {
    if (isReactProject !== null) {
      return isReactProject;
    }

    const cwd = process.cwd();
    const packageJsonPath = join(cwd, "package.json");

    // Check if package.json exists and has react
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps.react || deps["@types/react"]) {
          isReactProject = true;
          return true;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Check for tsx/jsx files in src/
    const srcPath = join(cwd, "src");
    if (existsSync(srcPath)) {
      // Simple heuristic: if src/ exists, likely a frontend project
      // Could be enhanced to actually scan for .tsx files
      isReactProject = true;
      return true;
    }

    isReactProject = false;
    return false;
  }

  function getPackageManager(): string {
    if (packageManager) {
      return packageManager;
    }

    const cwd = process.cwd();

    // Check for lock files to determine package manager
    if (existsSync(join(cwd, "bun.lock"))) {
      packageManager = "bun";
    } else if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
      packageManager = "pnpm";
    } else if (existsSync(join(cwd, "yarn.lock"))) {
      packageManager = "yarn";
    } else {
      packageManager = "npm";
    }

    return packageManager;
  }

  async function runLintAndReport(ctx: unknown) {
    const cwd = process.cwd();
    const pm = getPackageManager();

    // @ts-expect-error - ctx typing is complex
    ctx.ui.notify?.(`Running lint && typecheck...`, "info");

    // Run lint first
    const lintResult = await runCommand(pm, ["run", "lint"], cwd);

    // Run typecheck
    const typecheckResult = await runCommand(pm, ["run", "typecheck"], cwd);

    // Combine errors
    const errors: string[] = [];

    if (lintResult.exitCode !== 0) {
      const lintErrors = parseLintErrors(lintResult.stdout + "\n" + lintResult.stderr);
      if (lintErrors) {
        errors.push(`=== Lint Errors ===\n${lintErrors}`);
      }
    }

    if (typecheckResult.exitCode !== 0) {
      const typeErrors = parseTypeErrors(typecheckResult.stdout + "\n" + typecheckResult.stderr);
      if (typeErrors) {
        errors.push(`=== Type Errors ===\n${typeErrors}`);
      }
    }

    if (errors.length > 0) {
      const errorMessage = `React/TypeScript errors found. Please fix ALL errors and warnings (including pre-existing ones):

${errors.join("\n\n")}

Instructions:
1. Fix each error/warning one by one
2. Do NOT skip or ignore any errors
3. Do NOT use @ts-ignore or @ts-expect-error unless absolutely necessary
4. For lint errors, try to fix the underlying issue rather than disabling the rule
5. Run lint && typecheck again after fixes to verify`;

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

  function parseLintErrors(output: string): string {
    if (!output.trim()) return "";

    // Filter out success messages and empty lines
    const lines = output.split("\n").filter((line) => {
      const trimmed = line.trim().toLowerCase();
      return (
        trimmed &&
        !trimmed.includes("0 error") &&
        !trimmed.includes("0 warning") &&
        !trimmed.includes("no problems found") &&
        !trimmed.includes("check passed") &&
        !trimmed.startsWith("success")
      );
    });

    return lines.join("\n").trim();
  }

  function parseTypeErrors(output: string): string {
    if (!output.trim()) return "";

    // TypeScript errors typically have format: "path:line:col - error TSxxxx: message"
    const lines = output.split("\n").filter((line) => {
      const trimmed = line.trim().toLowerCase();
      return (
        trimmed &&
        !trimmed.includes("0 error") &&
        !trimmed.includes("found 0 errors") &&
        !trimmed.includes("no errors found") &&
        !trimmed.startsWith("success")
      );
    });

    return lines.join("\n").trim();
  }
}
