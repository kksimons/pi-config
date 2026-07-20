/**
 * Web Browser Extension
 *
 * Provides Chrome DevTools Protocol (CDP) automation for web testing and interaction.
 * Wraps browser scripts from https://github.com/mitsuhiko/agent-stuff/tree/main/skills/web-browser
 *
 * Usage:
 * - browser_start: Start Chrome with remote debugging
 * - browser_navigate: Navigate to a URL
 * - browser_evaluate: Execute JavaScript
 * - browser_screenshot: Take a screenshot
 * - browser_pick: Interactive element picker
 * - browser_dismiss_cookies: Dismiss cookie dialogs
 * - browser_logs: Tail console/network logs
 * - browser_net_summary: Summarize network requests
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, StringEnum } from "@mariozechner/pi-ai";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const SCRIPTS_DIR = new URL("./scripts", import.meta.url).pathname;

export default function (pi: ExtensionAPI) {
  // Register /browser-start command
  pi.registerCommand("browser-start", {
    description: "Start Chrome with CDP (Chrome DevTools Protocol) remote debugging on :9222",
    getArgumentCompletions: () => [
      { value: "--profile", label: "--profile (use your Chrome profile)" },
    ],
    handler: async (args, ctx) => {
      const useProfile = args?.includes("--profile");
      const scriptPath = `${SCRIPTS_DIR}/start.js`;

      try {
        const { stdout } = await execAsync(`node "${scriptPath}" ${useProfile ? "--profile" : ""}`);
        ctx.ui.notify(stdout.trim(), "success");
        return;
      } catch (error: any) {
        ctx.ui.notify(`Failed to start browser: ${error.message}`, "error");
        return;
      }
    },
  });

  // Browser automation tools
  pi.registerTool({
    name: "browser_start",
    label: "Browser Start",
    description: "Start Chrome with remote debugging enabled on port 9222. Required before other browser tools.",
    promptSnippet: "Start Chrome browser with CDP (required before browser_navigate, browser_evaluate, etc.)",
    parameters: Type.Object({
      useProfile: Type.Optional(
        Type.Boolean({ description: "Copy your Chrome profile (cookies, logins) for persistent sessions" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate) {
      const useProfile = params.useProfile ?? false;
      const scriptPath = `${SCRIPTS_DIR}/start.js`;

      try {
        const { stdout, stderr } = await execAsync(`node "${scriptPath}" ${useProfile ? "--profile" : ""}`, {
          timeout: 30000,
        });

        if (stderr && !stdout) {
          throw new Error(stderr.trim());
        }

        return {
          content: [{ type: "text", text: stdout.trim() }],
          details: { started: true, useProfile },
        };
      } catch (error: any) {
        throw new Error(`Failed to start browser: ${error.message}`);
      }
    },
  });

  pi.registerTool({
    name: "browser_navigate",
    label: "Browser Navigate",
    description: "Navigate Chrome to a URL. Opens in new tab if newTab=true, otherwise uses current tab.",
    promptSnippet: "Navigate Chrome to a URL (use after browser_start)",
    parameters: Type.Object({
      url: Type.String({ description: "URL to navigate to" }),
      newTab: Type.Optional(Type.Boolean({ description: "Open in new tab instead of current tab" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate) {
      const scriptPath = `${SCRIPTS_DIR}/nav.js`;

      try {
        const { stdout, stderr } = await execAsync(
          `node "${scriptPath}" "${params.url}" ${params.newTab ? "--new" : ""}`,
          { timeout: 45000 },
        );

        if (stderr && !stdout) {
          throw new Error(stderr.trim());
        }

        return {
          content: [{ type: "text", text: stdout.trim() }],
          details: { url: params.url, newTab: params.newTab ?? false },
        };
      } catch (error: any) {
        throw new Error(`Failed to navigate: ${error.message}`);
      }
    },
  });

  pi.registerTool({
    name: "browser_evaluate",
    label: "Browser Evaluate",
    description: "Execute JavaScript in the current Chrome tab. Returns the result.",
    promptSnippet: "Execute JavaScript in Chrome and return the result",
    parameters: Type.Object({
      code: Type.String({ description: "JavaScript code to evaluate (automatically wrapped in async IIFE)" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate) {
      const scriptPath = `${SCRIPTS_DIR}/eval.js`;

      try {
        const { stdout, stderr } = await execAsync(`node "${scriptPath}" ${params.code}`, {
          timeout: 45000,
        });

        if (stderr && !stdout) {
          throw new Error(stderr.trim());
        }

        return {
          content: [{ type: "text", text: stdout.trim() }],
          details: { code: params.code },
        };
      } catch (error: any) {
        throw new Error(`Failed to evaluate: ${error.message}`);
      }
    },
  });

  pi.registerTool({
    name: "browser_screenshot",
    label: "Browser Screenshot",
    description: "Take a screenshot of the current Chrome viewport. Returns the path to the PNG file.",
    promptSnippet: "Take a screenshot of the current Chrome tab",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate) {
      const scriptPath = `${SCRIPTS_DIR}/screenshot.js`;

      try {
        const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
          timeout: 15000,
        });

        if (stderr && !stdout) {
          throw new Error(stderr.trim());
        }

        const filepath = stdout.trim();
        return {
          content: [{ type: "text", text: `Screenshot saved to: ${filepath}` }],
          details: { filepath },
        };
      } catch (error: any) {
        throw new Error(`Failed to take screenshot: ${error.message}`);
      }
    },
  });

  pi.registerTool({
    name: "browser_pick",
    label: "Browser Pick",
    description: "Interactive element picker. Displays a message to user, who clicks elements. Returns element info.",
    promptSnippet: "Interactive element picker - user clicks elements, returns their info",
    parameters: Type.Object({
      message: Type.String({ description: "Instruction message to display to user (e.g., 'Click submit button')" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate) {
      const scriptPath = `${SCRIPTS_DIR}/pick.js`;

      try {
        const { stdout, stderr } = await execAsync(`node "${scriptPath}" ${params.message}`, {
          timeout: 300000,
        });

        if (stderr && !stdout) {
          throw new Error(stderr.trim());
        }

        return {
          content: [{ type: "text", text: stdout.trim() }],
          details: { message: params.message },
        };
      } catch (error: any) {
        throw new Error(`Failed to pick elements: ${error.message}`);
      }
    },
  });

  pi.registerTool({
    name: "browser_dismiss_cookies",
    label: "Browser Dismiss Cookies",
    description: "Automatically dismiss cookie consent dialogs. Supports OneTrust, Cookiebot, Google, YouTube, and more.",
    promptSnippet: "Dismiss cookie consent dialogs automatically",
    parameters: Type.Object({
      mode: StringEnum(["accept", "reject"] as const, {
        description: "Whether to accept or reject cookies (default: accept)",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate) {
      const mode = params.mode ?? "accept";
      const scriptPath = `${SCRIPTS_DIR}/dismiss-cookies.js`;

      try {
        const { stdout, stderr } = await execAsync(
          `node "${scriptPath}" ${mode === "reject" ? "--reject" : ""}`,
          { timeout: 30000 },
        );

        if (stderr && !stdout) {
          throw new Error(stderr.trim());
        }

        return {
          content: [{ type: "text", text: stdout.trim() }],
          details: { mode },
        };
      } catch (error: any) {
        throw new Error(`Failed to dismiss cookies: ${error.message}`);
      }
    },
  });

  pi.registerTool({
    name: "browser_logs",
    label: "Browser Logs",
    description: "Tail console and network logs from the browser session. Logs are stored in ~/.cache/agent-web/logs/",
    promptSnippet: "Tail console and network logs from the browser",
    parameters: Type.Object({
      follow: Type.Optional(
        Type.Boolean({ description: "Keep following new log entries (default: false - dump current and exit)" }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate) {
      const scriptPath = `${SCRIPTS_DIR}/logs-tail.js`;

      try {
        const { stdout, stderr } = await execAsync(
          `node "${scriptPath}" ${params.follow ? "--follow" : ""}`,
          { timeout: 30000 },
        );

        if (stderr && !stdout) {
          throw new Error(stderr.trim());
        }

        return {
          content: [{ type: "text", text: stdout.trim() || "No recent logs found" }],
          details: { follow: params.follow ?? false },
        };
      } catch (error: any) {
        throw new Error(`Failed to get logs: ${error.message}`);
      }
    },
  });

  pi.registerTool({
    name: "browser_net_summary",
    label: "Browser Net Summary",
    description: "Summarize network requests from the browser session (responses, status codes, timing).",
    promptSnippet: "Summarize network requests from the browser",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate) {
      const scriptPath = `${SCRIPTS_DIR}/net-summary.js`;

      try {
        const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
          timeout: 30000,
        });

        if (stderr && !stdout) {
          throw new Error(stderr.trim());
        }

        return {
          content: [{ type: "text", text: stdout.trim() || "No network activity recorded" }],
          details: {},
        };
      } catch (error: any) {
        throw new Error(`Failed to get network summary: ${error.message}`);
      }
    },
  });

  // Notify on load
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Web Browser extension loaded - use /browser-start to begin", "info");
  });
}
