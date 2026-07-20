import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, isToolCallEventType } from "@earendil-works/pi-coding-agent";
import type { SelectItem } from "@earendil-works/pi-tui";
import { Container, SelectList, Text } from "@earendil-works/pi-tui";
import { parse as shellParse } from "shell-quote";

type Severity = "high" | "medium";

type Risk = {
	severity: Severity;
	reasons: string[];
};

type OpToken = { op: string; [k: string]: unknown };

type Token = string | OpToken;

function isOpToken(t: Token): t is OpToken {
	return typeof t === "object" && t !== null && "op" in t;
}

function tokensToStrings(tokens: Token[]): string[] {
	return tokens.filter((t) => typeof t === "string") as string[];
}

function splitOnOps(tokens: Token[], splitOps: string[]): Token[][] {
	const out: Token[][] = [];
	let current: Token[] = [];
	for (const t of tokens) {
		if (isOpToken(t) && splitOps.includes(t.op)) {
			if (current.length) out.push(current);
			current = [];
			continue;
		}
		current.push(t);
	}
	if (current.length) out.push(current);
	return out;
}

function hasFlag(args: string[], flag: string): boolean {
	return args.includes(flag) || args.some((a) => a.startsWith(flag) && flag.length === 2 && a.startsWith("-"));
}

function anyArgStartsWith(args: string[], prefix: string): boolean {
	return args.some((a) => a.startsWith(prefix));
}

const ENV_ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Command interpreters that execute their stdin as code when invoked with no code source
 * of their own (no `-e`/`-c`/script-file). Piping INTO a *bare* one of these is remote code
 * execution — the canonical `curl … | sh`. Piping its OUTPUT elsewhere (`node -e '…' | head`)
 * is completely safe and must not prompt.
 */
const EXEC_INTERPRETERS = new Set([
	"sh", "bash", "zsh", "fish", "dash", "ksh", "ash", "csh", "tcsh",
	"python", "python2", "python3", "ruby", "rb", "node", "nodejs", "perl", "php", "lua", "tcl", "tclsh",
	"deno", "bun",
]);

/** Flags that give an interpreter its own code source, so it will NOT execute piped stdin. */
const INTERPRETER_CODE_FLAGS = new Set(["-e", "--eval", "-c", "-r", "-p", "--print", "-m", "--module"]);

/** Remove transparent command wrappers so the executable they invoke is analyzed. */
export function unwrapCommand(args: string[]): string[] {
	let current = args.slice();
	for (;;) {
		const command = current[0];
		if (!command) return current;
		if (command === "rtk") {
			current = current.slice(1);
			if (current[0] && ["proxy", "err", "summary", "test"].includes(current[0])) current = current.slice(1);
			continue;
		}
		if (command === "env") {
			current = current.slice(1);
			while (current.length) {
				const option = current[0];
				if (!option) break;
				if (ENV_ASSIGNMENT.test(option) || option === "-i" || option === "--ignore-environment") current = current.slice(1);
				else if (option === "-u" || option === "--unset") current = current.slice(2);
				else if (option.startsWith("--unset=")) current = current.slice(1);
				else break;
			}
			continue;
		}
		if (["command", "builtin", "nohup", "time", "nice"].includes(command)) {
			current = current.slice(1);
			while (current[0]?.startsWith("-")) {
				const option = current[0];
				current = current.slice(1);
				if ((command === "nice" && option === "-n") || (command === "time" && ["-f", "-o"].includes(option))) current = current.slice(1);
			}
			continue;
		}
		return current;
	}
}

/** Return the git subcommand after global options such as -C and -c. */
function gitCommand(rest: string[]): { sub?: string; args: string[] } {
	let index = 0;
	const optionsWithValues = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--config-env", "--exec-path"]);
	while (index < rest.length) {
		const arg = rest[index];
		if (!arg) break;
		if (arg === "--") { index += 1; break; }
		if (!arg.startsWith("-")) break;
		if (optionsWithValues.has(arg)) index += 2;
		else index += 1;
	}
	return { sub: rest[index], args: rest.slice(index + 1) };
}

/**
 * True if invoking this interpreter will execute code read from stdin — i.e. it has no code
 * source of its own (no `-e`/`-c`/`-r`/script file). A bare interpreter is the only form that
 * executes piped input as code; `node -e '…'`, `python -c '…'`, `python script.py`, etc. are safe.
 */
function interpreterReadsStdin(args: string[]): boolean {
	// args[0] is the interpreter name; the rest are its arguments.
	for (const arg of args.slice(1)) {
		if (arg.startsWith("-e=") || arg.startsWith("--eval=")) return false;
		if (INTERPRETER_CODE_FLAGS.has(arg)) return false;
		if (!arg.startsWith("-")) return false; // first positional → treated as a script/file/module
	}
	return true;
}

function analyzeSegment(seg: Token[]): Risk | null {
	const reasons: string[] = [];
	let severity: Severity = "medium";

	const ops = seg.filter(isOpToken).map((o) => o.op);
	const args = unwrapCommand(tokensToStrings(seg));
	if (args.length === 0) return null;

	const cmd = args[0]!;
	const rest = args.slice(1);

	// Pipe INTO a code-executing interpreter that reads code from stdin is remote code
	// execution — the canonical `curl ... | sh` / `echo ... | python3`. This must NOT fire for
	// safe plumbing where the interpreter has its own code source: `node -e '...' | head` pipes
	// node's OUTPUT to head and node never executes the pipe. Only an interpreter that is the
	// *consumer* of a pipe AND would execute stdin as code is dangerous.
	if (ops.includes("|")) {
		const stages = splitOnOps(seg, ["|"]);
		for (let i = 1; i < stages.length; i++) {
			const stageArgs = unwrapCommand(tokensToStrings(stages[i]!));
			const stageCmd = stageArgs[0];
			if (stageCmd && EXEC_INTERPRETERS.has(stageCmd) && interpreterReadsStdin(stageArgs)) {
				reasons.push("pipe to a command interpreter (possible remote code execution)");
				severity = "high";
			}
		}
	}

	// sudo
	if (cmd === "sudo") {
		reasons.push("sudo (elevated privileges)");
		severity = "high";
	}

	// rm/rmdir/unlink
	if (cmd === "rm" || cmd === "rmdir" || cmd === "unlink") {
		severity = "high";
		reasons.push(`${cmd} (file deletion)`);
		if (rest.some((a) => a.includes("-r") || a.includes("-R"))) reasons.push("recursive delete (-r/-R)");
		if (rest.some((a) => a.includes("-f"))) reasons.push("forced delete (-f)");
		if (ops.includes("glob")) reasons.push("glob pattern expansion (may delete many files)");
	}

	// find -delete
	if (cmd === "find" && rest.includes("-delete")) {
		severity = "high";
		reasons.push("find -delete (bulk deletion)");
	}

	// git operations (only destructive subcommands prompt; routine git passes silently)
	if (cmd === "git") {
		const { sub, args: subArgs } = gitCommand(rest);

		// Only prompt on genuinely destructive git ops; routine git
		// (status/log/add/commit/push/pull/fetch/diff/branch/checkout/stash/…)
		// passes through silently.
		if (sub === "rm") {
			severity = "high";
			reasons.push("git rm (deletes files from working tree and stages deletions)");
		}
		if (sub === "clean" && (subArgs.some((a) => a.includes("-f")) || subArgs.includes("-d") || subArgs.includes("-x"))) {
			severity = "high";
			reasons.push("git clean (can delete untracked files)");
		}
		if (sub === "reset" && (subArgs.includes("--hard") || subArgs.includes("--merge"))) {
			severity = "high";
			reasons.push("git reset --hard/--merge (can discard changes)");
		}
		if (sub === "checkout" && (subArgs.includes(".") || subArgs.includes("--") || subArgs.includes("-f") || subArgs.includes("--force") || subArgs.some((arg) => arg.startsWith("--pathspec-from-file")))) {
			severity = severity === "high" ? "high" : "medium";
			reasons.push("git checkout (can overwrite working tree)");
		}
		if (sub === "restore" && (!subArgs.includes("--staged") || subArgs.includes("--worktree") || subArgs.includes("-W"))) {
			severity = "high";
			reasons.push("git restore (can discard working-tree changes)");
		}
		if (sub === "branch" && (subArgs.includes("-D") || (subArgs.includes("--delete") && subArgs.includes("--force")))) {
			severity = "high";
			reasons.push("git branch -D (force-deletes a branch)");
		}
		if (sub === "tag" && (subArgs.includes("-d") || subArgs.includes("--delete"))) {
			severity = severity === "high" ? "high" : "medium";
			reasons.push("git tag --delete (deletes tags)");
		}
		if (sub === "stash" && (subArgs[0] === "drop" || subArgs[0] === "clear")) {
			severity = "high";
			reasons.push(`git stash ${subArgs[0]} (deletes stashed changes)`);
		}
		if (sub === "worktree" && subArgs[0] === "remove") {
			severity = subArgs.includes("--force") || subArgs.includes("-f") ? "high" : severity;
			reasons.push("git worktree remove (removes a worktree)");
		}
		if (sub === "push" && (subArgs.includes("--force") || subArgs.some((arg) => arg.startsWith("--force-with-lease")) || subArgs.includes("-f") || subArgs.some((arg) => arg.startsWith("+")))) {
			severity = "high";
			reasons.push("git push --force (rewrite remote history)");
		}
		if (sub === "reflog" && subArgs.includes("expire")) {
			severity = "high";
			reasons.push("git reflog expire (can remove recovery history)");
		}
		if (sub === "reflog" && subArgs.includes("delete")) {
			severity = "high";
			reasons.push("git reflog delete (can remove recovery history)");
		}
		if (sub === "gc" && subArgs.some((a) => a.startsWith("--prune"))) {
			severity = "high";
			reasons.push("git gc --prune (can permanently delete objects)");
		}
	}

	// truncate
	if (cmd === "truncate") {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("truncate (in-place size change, can erase contents)");
	}

	// dd of=
	if (cmd === "dd" && (anyArgStartsWith(rest, "of=") || rest.includes("of"))) {
		severity = "high";
		reasons.push("dd with output file/device (can overwrite data)");
	}

	// Disk / volume management (prompt aggressively; high risk)
	// Linux: mkfs.*, wipefs, parted, fdisk, gdisk/sgdisk, lsblk, cryptsetup, LVM tools, zpool
	// macOS: diskutil, hdiutil, gpt, newfs_*, asr
	if (cmd.startsWith("mkfs")) {
		severity = "high";
		reasons.push("mkfs (filesystem formatting)");
	}
	if (cmd.startsWith("newfs_")) {
		severity = "high";
		reasons.push("newfs_* (filesystem formatting)");
	}
	if (cmd === "wipefs") {
		severity = "high";
		reasons.push("wipefs (disk signature wipe)");
	}
	if (cmd === "diskutil") {
		severity = "high";
		reasons.push("diskutil (disk management command)");
		if (rest.includes("eraseDisk") || rest.includes("eraseVolume")) {
			reasons.push("diskutil erase (destructive disk operation)");
		}
	}
	if (cmd === "hdiutil") {
		severity = "high";
		reasons.push("hdiutil (disk image management command)");
	}
	if (cmd === "gpt") {
		severity = "high";
		reasons.push("gpt (partition table manipulation)");
	}
	if (cmd === "asr") {
		severity = "high";
		reasons.push("asr (Apple Software Restore; can overwrite volumes)");
	}
	if (cmd === "parted" || cmd === "fdisk" || cmd === "gdisk" || cmd === "sgdisk") {
		severity = "high";
		reasons.push(`${cmd} (disk/partition management)`);
	}
	if (cmd === "cryptsetup") {
		severity = "high";
		reasons.push("cryptsetup (disk encryption management)");
	}
	if (cmd === "pvcreate" || cmd === "vgcreate" || cmd === "lvcreate") {
		severity = "high";
		reasons.push(`${cmd} (LVM volume management)`);
	}
	if (cmd === "zpool") {
		severity = "high";
		reasons.push("zpool (ZFS pool management)");
	}

	// chmod/chown recursive
	if (cmd === "chmod" && (rest.includes("-R") || rest.includes("--recursive"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("chmod -R (recursive permission changes)");
	}
	if (cmd === "chown" && (rest.includes("-R") || rest.includes("--recursive"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("chown -R (recursive ownership changes)");
	}

	// mv/cp overwriting
	if (cmd === "mv" && (rest.includes("-f") || rest.includes("--force"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("mv --force/-f (can overwrite files)");
	}
	if (cmd === "cp" && (rest.includes("-f") || rest.includes("--force"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("cp --force/-f (can overwrite files)");
	}

	// sed/perl in-place
	if (cmd === "sed" && (hasFlag(rest, "-i") || rest.includes("--in-place"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("sed -i (in-place file modification)");
	}
	if (cmd === "perl" && (rest.includes("-pi") || (rest.includes("-p") && rest.includes("-i")))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("perl -pi/-i (in-place file modification)");
	}

	// kill/shutdown/systemctl
	if (cmd === "kill" || cmd === "pkill" || cmd === "killall") {
		severity = severity === "high" ? "high" : "medium";
		reasons.push(`${cmd} (process termination)`);
		if (rest.includes("-9")) {
			severity = "high";
			reasons.push("SIGKILL (-9)");
		}
	}
	if (cmd === "shutdown" || cmd === "reboot") {
		severity = "high";
		reasons.push(`${cmd} (system power operation)`);
	}
	if (cmd === "systemctl" && (rest.includes("stop") || rest.includes("disable"))) {
		severity = severity === "high" ? "high" : "medium";
		reasons.push("systemctl stop/disable (service disruption)");
	}

	// Infra deletes
	if (cmd === "kubectl" && rest[0] === "delete") {
		severity = "high";
		reasons.push("kubectl delete (resource deletion)");
	}
	if (cmd === "terraform" && rest[0] === "destroy") {
		severity = "high";
		reasons.push("terraform destroy (infrastructure teardown)");
	}
	if (cmd === "aws" && rest[0] === "s3" && rest[1] === "rm" && rest.includes("--recursive")) {
		severity = "high";
		reasons.push("aws s3 rm --recursive (bulk deletion)");
	}
	if (cmd === "gcloud" && rest.includes("delete")) {
		severity = "high";
		reasons.push("gcloud delete (resource deletion)");
	}

	if (reasons.length === 0) return null;
	return { severity, reasons };
}

export function analyzeBashCommand(command: string): Risk | null {
	let tokens: Token[];
	try {
		tokens = shellParse(command) as Token[];
	} catch {
		// Fallback: if we can't parse, treat it as questionable
		return { severity: "medium", reasons: ["unparsed shell command (unable to analyze safely)"] };
	}

	const reasons: string[] = [];
	let severity: Severity = "medium";

	// Pipes and redirections are plumbing, not inherently destructive — what matters is the
	// actual commands within each segment (analyzed below), plus redirections that truncate or
	// overwrite a real file. Harmless targets like `>/dev/null`, `2>/dev/null`, and fd-merges
	// like `2>&1` (emitted by shell-quote as a distinct `>&` op) must not prompt on their own.
	// shell-quote emits the redirection target as the token immediately after the operator.
	const DEVICE_TARGETS = new Set(["/dev/null", "/dev/stdout", "/dev/stderr"]);
	const REDIRECT_OPS = new Set([">", ">>", "2>", "2>>"]);
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]!;
		if (!isOpToken(token) || !REDIRECT_OPS.has(token.op)) continue;
		const target = tokens[i + 1];
		const targetPath = typeof target === "string" ? target : undefined;
		if (!targetPath || DEVICE_TARGETS.has(targetPath)) continue;
		reasons.push("shell output redirection (can overwrite files)");
		break;
	}

	// Segment analysis (split on &&, ||, ;)
	const segments = splitOnOps(tokens, ["&&", "||", ";"]);
	for (const seg of segments) {
		const segRisk = analyzeSegment(seg);
		if (!segRisk) continue;
		if (segRisk.severity === "high") severity = "high";
		for (const r of segRisk.reasons) reasons.push(r);
	}

	// De-duplicate reasons
	const uniq = [...new Set(reasons)];
	if (uniq.length === 0) return null;
	return { severity, reasons: uniq };
}

/** If the tab-attention extension is loaded, flash a [!] marker in the terminal
 *  tab title (pausing the working spinner) while awaiting input. No-op otherwise. */
function requestTabAttention(): () => void {
	const ctrl = (globalThis as { __piTabAttention?: { requestAttention?: () => () => void } }).__piTabAttention;
	return ctrl?.requestAttention?.() ?? (() => {});
}

async function promptRunOrAbort(ctx: ExtensionContext, command: string, risk: Risk): Promise<"run" | "abort"> {
	if (!ctx.hasUI) return "abort";

	const reasonsText = risk.reasons.map((r) => `• ${r}`).join("\n");
	const header = `Command flagged as ${risk.severity.toUpperCase()} risk:`;
	const body = `${header}\n\n${reasonsText}\n\nCommand:\n${command}`;

	const items: SelectItem[] = [
		{ value: "run", label: "Run", description: "Execute the command" },
		{ value: "abort", label: "Abort", description: "Block this command" },
	];

	// Surface a [!] marker in the terminal tab (and pause the working spinner)
	// while this prompt is on screen — the agent is blocked waiting for you.
	const restoreAttention = requestTabAttention();
	const choice = await ctx.ui.custom<"run" | "abort">((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((s: string) => theme.fg("warning", s)));
		container.addChild(new Text(theme.fg("warning", theme.bold("Potentially destructive bash command")), 1, 0));
		container.addChild(new Text(body, 1, 0));

		const list = new SelectList(items, items.length, {
			selectedPrefix: (t) => theme.fg("accent", t),
			selectedText: (t) => theme.fg("accent", t),
			description: (t) => theme.fg("muted", t),
			scrollInfo: (t) => theme.fg("dim", t),
			noMatch: (t) => theme.fg("warning", t),
		});

		list.onSelect = (item) => done(item.value as "run" | "abort");
		list.onCancel = () => done("abort");
		container.addChild(list);

		container.addChild(new DynamicBorder((s: string) => theme.fg("warning", s)));

		return {
			render: (w) => container.render(w),
			invalidate: () => container.invalidate(),
			handleInput: (data) => {
				list.handleInput(data);
				tui.requestRender();
			},
		};
	}, { overlay: true }).finally(restoreAttention);

	return choice ?? "abort";
}

// PI_SUBAGENT_DEPTH is 0 (or unset) in the main session and >= 1 in spawned subagent processes.
// Behaviour branches on this: interactive prompting in the main session, headless hard-block
// for catastrophic operations in subagents (where stdin is /dev/null and no UI is available).
const _subagentDepth = Number(process.env.PI_SUBAGENT_DEPTH ?? "0");
const _isSubagent = Number.isFinite(_subagentDepth) && _subagentDepth >= 1;

// Hard-block patterns for subagent (headless) mode. Criteria: unrecoverable by default AND
// unlikely to be intentional in an automated context. Fewer false positives over broad coverage —
// the interactive prompt handles the rest for main sessions.
const HEADLESS_BLOCKED: Array<{ pattern: RegExp; reason: string }> = [
	// Recursive deletion
	{ pattern: /(?<!\bgit\s+)\brm\b[^#\n]*\s-(?:[a-zA-Z]*[rR]|-\brecursive\b)/, reason: "recursive delete (rm -r / -rf / -Rf)" },
	// Privilege escalation
	{ pattern: /\bsudo\b/, reason: "elevated privileges (sudo)" },
	// Remote code execution via pipe to any code-executing interpreter.
	{ pattern: /\b(curl|wget)\b[^#\n]*\|\s*(ba?sh|zsh|fish|dash|ksh|ash|csh|tcsh|sh|python[23]?|ruby|rb|node|nodejs|perl|php|lua|tcl|tclsh|deno|bun)\b/, reason: "pipe to a command interpreter (remote code execution)" },
	// Disk / filesystem destruction
	{ pattern: /\bmkfs/, reason: "filesystem formatting (mkfs)" },
	{ pattern: /\bnewfs_\w+/, reason: "filesystem formatting (newfs_*)" },
	{ pattern: /\bwipefs\b/, reason: "disk signature wipe" },
	{ pattern: /\bdiskutil\s+(erase|zeroDisk|secureErase|reformat)/i, reason: "destructive disk operation (diskutil)" },
	{ pattern: /\bdd\b[^#\n]*\bof=\/dev\//, reason: "raw disk write (dd of=/dev/...)" },
	{ pattern: /\b(parted|fdisk|gdisk|sgdisk)\b/, reason: "partition table management" },
	{ pattern: /\bcryptsetup\b/, reason: "disk encryption management" },
	{ pattern: /\bzpool\b/, reason: "ZFS pool management" },
	// System power
	{ pattern: /\b(shutdown|reboot|halt|poweroff)\b/, reason: "system power operation" },
	// Infrastructure teardown
	{ pattern: /\bterraform\s+destroy\b/, reason: "infrastructure teardown (terraform destroy)" },
	{ pattern: /\bkubectl\s+delete\b/, reason: "Kubernetes resource deletion" },
	{ pattern: /\baws\s+s3\s+rm\b[^#\n]*--recursive/, reason: "bulk S3 deletion (aws s3 rm --recursive)" },
	// Destructive git operations
	{ pattern: /\bgit\s+commit\b/, reason: "git commit (commits are main-session operations)" },
	{ pattern: /\bgit\s+pull\b/, reason: "git pull (pulls are main-session operations)" },
	{ pattern: /\bgit\s+push\b/, reason: "git push (pushes are main-session operations)" },
	{ pattern: /\bgit\s+reset\b[^#\n]*--hard\b/, reason: "discard all uncommitted changes (git reset --hard)" },
	{ pattern: /\bgit\s+clean\b[^#\n]*-[a-zA-Z]*f/, reason: "delete untracked files (git clean -f)" },
	{ pattern: /\bgit\s+reflog\s+expire\b/, reason: "expire reflog (removes recovery history)" },
	{ pattern: /\bgit\s+gc\b[^#\n]*--prune\b/, reason: "prune unreachable objects (git gc --prune)" },
];

function headlessGitReason(command: string): string | undefined {
	let tokens: Token[];
	try { tokens = shellParse(command) as Token[]; }
	catch { return undefined; }
	for (const segment of splitOnOps(tokens, ["&&", "||", ";"])) {
		const args = unwrapCommand(tokensToStrings(segment));
		if (args[0] !== "git") continue;
		const { sub } = gitCommand(args.slice(1));
		if (sub === "commit" || sub === "pull" || sub === "push") return `git ${sub} (main-session operation)`;
		const gitReasons = analyzeSegment(segment)?.reasons.filter((reason) => reason.startsWith("git ")) ?? [];
		if (gitReasons.length) return gitReasons.join(", ");
	}
	return undefined;
}

export default function (pi: ExtensionAPI) {
	if (_isSubagent) {
		// Subagent mode: hard-block catastrophic operations, no prompting.
		pi.on("tool_call", async (event) => {
			if (!isToolCallEventType("bash", event)) return;
			const command = event.input.command;
			for (const { pattern, reason } of HEADLESS_BLOCKED) {
				if (pattern.test(command)) {
					return {
						block: true,
						reason:
							`Blocked by bash-guard: ${reason}. ` +
							"This is a non-interactive subagent session — catastrophic operations are not permitted. " +
							"Propose a safer alternative or ask the parent agent to confirm with the user.",
					};
				}
			}
			const gitReason = headlessGitReason(command);
			if (gitReason) {
				return {
					block: true,
					reason: `Blocked by bash-guard: ${gitReason}. This is a non-interactive subagent session; ask the parent agent to perform the operation.`,
				};
			}
		});
		return;
	}

	// Main session mode: interactive prompting.
	pi.registerFlag("bash-guard-auto-allow", {
		description: "If set, bash-guard will not block when no UI is available (non-interactive modes).",
		type: "boolean",
		default: false,
	});

	// Avoid annoying retry loops: if the exact command was aborted recently, auto-block it.
	const recentlyAborted = new Map<string, number>();
	const ABORT_REMEMBER_MS = 60_000;

	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const command = event.input.command;
		const risk = analyzeBashCommand(command);
		if (!risk) return;

		const now = Date.now();
		const lastAbort = recentlyAborted.get(command);
		if (lastAbort && now - lastAbort < ABORT_REMEMBER_MS) {
			return {
				block: true,
				reason:
					"Blocked by bash-guard: command was already aborted recently. Ask the user for a safer alternative; do not retry the same command.",
			};
		}

		if (!ctx.hasUI && pi.getFlag("--bash-guard-auto-allow")) {
			// Non-interactive mode: allow when explicitly requested.
			return;
		}

		const choice = await promptRunOrAbort(ctx, command, risk);
		if (choice === "run") return;

		recentlyAborted.set(command, now);
		return {
			block: true,
			reason:
				"Blocked by user via bash-guard (potentially destructive command). Ask the user for confirmation or propose a non-destructive alternative.",
		};
	});
}
