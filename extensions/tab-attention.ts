/**
 * tab-attention — turn the terminal tab title into a live status indicator so you
 * never miss that Pi (or an agent prompt) needs you.
 *
 *   • working   → animated spinner (pi's own Braille spinner, 80 ms)
 *                   e.g.  ⠹ pi - my-session - heatsink-api
 *   • attention → "[!]" marker
 *                   e.g.  [!] pi - my-session - heatsink-api
 *   • idle      → plain base title
 *                   e.g.  pi - my-session - heatsink-api
 *
 * "attention" covers two cases:
 *   1. Pi finished its turn and is waiting for input          (agent_settled)
 *   2. A mid-turn prompt is blocking on you, e.g. bash-guard's
 *      Run/Abort dialog. Other extensions pause the spinner and
 *      show "[!]" via the controller published on
 *      globalThis.__piTabAttention.requestAttention().
 *
 * TUI-only: it never writes OSC title sequences in rpc/print/json modes, so
 * piped output stays clean.
 *
 * Flags:
 *   --tab-attention-enabled  (boolean, default true)  master switch
 *   --tab-attention-mark     (string,  default "[!]") marker shown when attention is needed
 */
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Pi's default working spinner (see pi-tui Loader DEFAULT_FRAMES). */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

/** Key under which this extension publishes a controller for other extensions. */
const GLOBAL_KEY = "__piTabAttention";

export type TabAttentionController = {
	/**
	 * Show the attention marker, pausing the working spinner if it is running.
	 * Returns a restore() function that returns to the previous state. Safe to
	 * call when disabled or not in TUI mode (it becomes a no-op).
	 */
	requestAttention(): () => void;
};

/** Mirror pi's config.js: APP_TITLE = pkg.piConfig?.name ?? "π". */
const APP_TITLE = readAppTitle();

function readAppTitle(): string {
	try {
		const require = createRequire(import.meta.url);
		// Resolve the package main (exposed via "exports") then walk up to its
		// package.json, which is NOT exposed for direct import.
		const entry = require.resolve("@earendil-works/pi-coding-agent");
		let dir = path.dirname(entry);
		for (let i = 0; i < 12; i++) {
			const pj = path.join(dir, "package.json");
			if (fs.existsSync(pj)) {
				const pkg = JSON.parse(fs.readFileSync(pj, "utf8")) as { name?: string; piConfig?: { name?: string } };
				if (pkg?.name === "@earendil-works/pi-coding-agent") {
					const name = pkg.piConfig?.name;
					return typeof name === "string" && name ? name : "π";
				}
			}
			const parent = path.dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
	} catch {
		// ignore — fall back to the default title
	}
	return "π";
}

export default function (pi: ExtensionAPI) {
	pi.registerFlag("tab-attention-enabled", {
		description: "Show a working spinner / [!] marker in the terminal tab title to signal when Pi needs input.",
		type: "boolean",
		default: true,
	});
	pi.registerFlag("tab-attention-mark", {
		description: "Prefix shown in the terminal tab title when attention is needed.",
		type: "string",
		default: "[!]",
	});

	// Stable references captured from the first event we see (ui/sessionManager/mode
	// are stable for the lifetime of the process, so capturing once is enough).
	let ui: ExtensionContext["ui"] | undefined;
	let sessionManager: ExtensionContext["sessionManager"] | undefined;
	let mode: ExtensionContext["mode"] | undefined;

	// Agent run in progress (between before_agent_start and agent_settled).
	let working = false;
	// Agent finished and is waiting for the next prompt.
	let settled = false;
	// Mid-turn prompts (e.g. bash-guard) that need attention right now. Depth-counted
	// so nested prompts restore correctly.
	let attentionOverride = 0;

	let spinnerTimer: ReturnType<typeof setInterval> | null = null;
	let frame = 0;

	const enabled = (): boolean => pi.getFlag("tab-attention-enabled") !== false;
	const mark = (): string => {
		const value = pi.getFlag("tab-attention-mark");
		const text = typeof value === "string" && value.trim() ? value : "[!]";
		return text.endsWith(" ") ? text : `${text} `;
	};

	const baseTitle = (): string => {
		if (!sessionManager) return APP_TITLE;
		const cwdBasename = path.basename(sessionManager.getCwd());
		const sessionName = sessionManager.getSessionName();
		return sessionName ? `${APP_TITLE} - ${sessionName} - ${cwdBasename}` : `${APP_TITLE} - ${cwdBasename}`;
	};

	const isAttention = (): boolean => settled || attentionOverride > 0;
	const isWorking = (): boolean => working && !isAttention();

	const writeTitle = (prefix: string): void => {
		if (mode !== "tui" || !ui) return;
		ui.setTitle(prefix ? `${prefix}${baseTitle()}` : baseTitle());
	};

	const stopSpinner = (): void => {
		if (spinnerTimer) {
			clearInterval(spinnerTimer);
			spinnerTimer = null;
		}
	};

	const renderStatic = (): void => {
		if (!enabled()) return;
		if (isAttention()) writeTitle(mark());
		else if (!isWorking()) writeTitle("");
		// while working, the spinner timer owns the writes
	};

	/** Reconcile current state: start/stop the spinner and render once if static. */
	const sync = (): void => {
		if (!enabled()) {
			stopSpinner();
			writeTitle(""); // restore the plain base title
			return;
		}
		if (isWorking()) {
			startSpinner();
		} else {
			stopSpinner();
			renderStatic();
		}
	};

	const startSpinner = (): void => {
		if (spinnerTimer) return;
		frame = 0;
		// Draw the first frame immediately so the spinner appears without an 80 ms gap.
		writeFrame();
		spinnerTimer = setInterval(() => {
			if (!enabled() || !isWorking()) {
				sync(); // state changed under us — reconcile
				return;
			}
			writeFrame();
		}, SPINNER_INTERVAL_MS);
	};

	const writeFrame = (): void => {
		const f = SPINNER_FRAMES[frame % SPINNER_FRAMES.length] ?? "";
		frame++;
		writeTitle(`${f} `);
	};

	const capture = (ctx: ExtensionContext): void => {
		ui ??= ctx.ui;
		sessionManager ??= ctx.sessionManager;
		mode ??= ctx.mode;
	};

	// --- agent lifecycle -------------------------------------------------------------

	// User submitted a prompt → Pi is working again. Fires once per submission and
	// stays "working" across automatic retries / compaction until agent_settled.
	pi.on("before_agent_start", (_event, ctx) => {
		capture(ctx);
		working = true;
		settled = false;
		sync();
	});

	// Pi will not continue on its own → it is waiting for input.
	pi.on("agent_settled", (_event, ctx) => {
		capture(ctx);
		working = false;
		settled = true;
		sync();
	});

	// Pi rewrites the base title on session changes; re-apply our state (deferred so
	// we win the race against Pi's own setTitle call). Reads fresh cwd/session each time.
	const reapply = (ctx: ExtensionContext): void => {
		capture(ctx);
		setTimeout(sync, 0);
	};
	pi.on("session_start", (_event, ctx) => reapply(ctx));
	pi.on("session_info_changed", (_event, ctx) => reapply(ctx));
	pi.on("session_before_switch", (_event, ctx) => reapply(ctx));

	// --- controller for other extensions (e.g. bash-guard mid-turn prompts) ----------

	const requestAttention = (): (() => void) => {
		if (!enabled()) return () => {};
		attentionOverride += 1;
		sync();
		return () => {
			attentionOverride = Math.max(0, attentionOverride - 1);
			sync();
		};
	};

	(globalThis as Record<string, unknown>)[GLOBAL_KEY] = { requestAttention } as TabAttentionController;

	pi.on("session_shutdown", () => {
		stopSpinner();
		delete (globalThis as Record<string, unknown>)[GLOBAL_KEY];
	});
}
