/**
 * Long-term memory keyed by logical project rather than repository.
 * Memory starts disabled in every session and is enabled with /memory or Alt+M.
 */
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import type { SelectItem } from "@earendil-works/pi-tui";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { openPicker } from "./picker.ts";
import {
	type Config,
	type OrderState,
	candidatesFor,
	deleteMemoryProject,
	ensureInOrder,
	ensureMemoryFile,
	loadConfig,
	loadOrder,
	memoryFileFor,
	moveProject,
	norm,
	orderedProjects,
	projectNames,
	readMemoryFile,
	removeFromOrder,
	reposOf,
	resolveProject,
	saveConfig,
	saveOrder,
	tilde,
	toggleFavorite,
	validateProjectName,
	writeMemoryFile,
} from "./store.ts";

const MAX_INJECT_CHARS = 12 * 1024;

const memoryTemplate = (project: string, repos: string[] = []) => `# Project Memory — ${project}

> Shared long-term memory for the "${project}" project. This file is injected
> whenever project memory is enabled and is shared across ALL repos mapped to
> this project. Keep entries concise; prune stale ones.

## Overview
<!-- What this project is, its goals, and the repos it spans -->

## Architecture & Key Decisions
<!-- Why things are the way they are (applies across repos) -->

## Repo Map (where to find things)
${repos.length ? repos.map((repo) => `- ${repo}`).join("\n") : "<!-- which repo owns what: api, frontend, etc. -->"}

## Current State
<!-- What's in progress, what's done -->

## Gotchas / Notes
<!-- Things that bit us or are easy to forget -->

## Open Questions
<!-- Unresolved decisions -->
`;

interface MemoryState {
	enabled: boolean;
	project?: string;
}

function templateFor(cfg: Config, project: string): string {
	return memoryTemplate(project, reposOf(cfg, project));
}

function projectItems(cfg: Config, state: OrderState): SelectItem[] {
	return orderedProjects(cfg, state).map((name) => ({
		value: name,
		label: name,
		description: reposOf(cfg, name).join(", "),
	}));
}

function projectPickerOptions(cfg: Config, holder: { state: OrderState }, title: string) {
	return {
		multi: false as const,
		title,
		detail: (item: SelectItem) => `Memory file: ${tilde(memoryFileFor(cfg, item.value))}`,
		hint: "type to narrow · ↑↓ navigate · enter select · ctrl+↑/↓ reorder · ctrl+F favorite · esc cancel",
		reorderable: true,
		favoritable: true,
		isFavorite: (value: string) => Object.hasOwn(holder.state.favorites, value),
		onMove: (item: SelectItem, direction: "up" | "down") => {
			const next = moveProject(cfg, holder.state, item.value, direction);
			if (next !== holder.state) saveOrder(next);
			holder.state = next;
			return projectItems(cfg, next);
		},
		onFavorite: (item: SelectItem) => {
			holder.state = toggleFavorite(holder.state, item.value);
			saveOrder(holder.state);
			return projectItems(cfg, holder.state);
		},
	};
}

function repoItems(exclude?: Set<string>): SelectItem[] {
	const root = norm("~/repos");
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(root, { withFileTypes: true });
	} catch {
		return [];
	}
	return entries
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
		.map((entry) => {
			const absolute = path.join(root, entry.name);
			return { value: absolute, label: entry.name, description: tilde(absolute) };
		})
		.filter((item) => !exclude?.has(item.value))
		.sort((a, b) => a.label.localeCompare(b.label));
}

function repoArgument(raw: string): string {
	return raw.startsWith("/") || raw.startsWith("~/") ? norm(raw) : norm(path.join(os.homedir(), "repos", raw));
}

function parseArgs(raw: string | undefined): string[] {
	return (raw || "").trim().split(/\s+/).filter(Boolean);
}

export default function projectMemory(pi: ExtensionAPI) {
	let cfg: Config;
	try {
		cfg = loadConfig();
	} catch (error) {
		console.warn("[project-memory] failed to load config:", (error as Error).message);
		cfg = { projects: {}, default: {} };
	}
	let state: MemoryState = { enabled: false };

	function notify(ctx: ExtensionContext, message: string, level: "info" | "warning" | "error" = "info"): void {
		if (ctx.hasUI) ctx.ui.notify(message, level);
	}

	function refreshStatus(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;
		ctx.ui.setStatus(
			"project-memory",
			state.enabled && state.project ? ctx.ui.theme.fg("accent", `🧠 ${state.project}`) : undefined,
		);
	}

	function reloadConfig(ctx: ExtensionContext): boolean {
		try {
			cfg = loadConfig();
			return true;
		} catch (error) {
			notify(ctx, `Project memory config is invalid: ${(error as Error).message}`, "error");
			return false;
		}
	}

	function enable(ctx: ExtensionContext, requested?: string): void {
		const target = requested || state.project || resolveProject(cfg, ctx.cwd);
		if (!target) {
			notify(ctx, `No project maps to ${tilde(ctx.cwd)}. Try /memory create <name> or /memory <project>.`, "warning");
			return;
		}
		if (!cfg.projects?.[target]) {
			notify(ctx, `Unknown project "${target}". Try /memory list.`, "warning");
			return;
		}
		ensureMemoryFile(cfg, target, templateFor(cfg, target));
		state = { enabled: true, project: target };
		refreshStatus(ctx);
		notify(ctx, `Memory ON — project "${target}" (${memoryFileFor(cfg, target)})`);
	}

	function disable(ctx: ExtensionContext): void {
		state = { enabled: false, project: state.project };
		refreshStatus(ctx);
		notify(ctx, `Memory OFF${state.project ? ` (was "${state.project}")` : ""}`);
	}

	async function chooseProject(ctx: ExtensionContext, title: string): Promise<string | undefined> {
		if (!ctx.hasUI || projectNames(cfg).length === 0) return undefined;
		const holder = { state: loadOrder() };
		const picked = await openPicker(ctx, projectItems(cfg, holder.state), projectPickerOptions(cfg, holder, title));
		return picked?.[0];
	}

	async function toggle(ctx: ExtensionContext): Promise<void> {
		if (!reloadConfig(ctx)) return;
		if (state.enabled) { disable(ctx); return; }
		const candidates = candidatesFor(cfg, ctx.cwd);
		if (candidates.length === 1) { enable(ctx, candidates[0]); return; }
		if (!ctx.hasUI || projectNames(cfg).length === 0) { enable(ctx); return; }
		const picked = await chooseProject(ctx, "Enable memory for project");
		if (picked) enable(ctx, picked);
	}

	pi.on("session_start", async (_event, ctx) => {
		reloadConfig(ctx);
		state = { enabled: false };
		refreshStatus(ctx);
	});

	pi.on("before_agent_start", async (event) => {
		if (!state.enabled || !state.project || !cfg.projects?.[state.project]) return undefined;
		const file = memoryFileFor(cfg, state.project);
		let body = "";
		try {
			body = readMemoryFile(cfg, state.project);
		} catch (error) {
			console.warn("[project-memory] failed to read memory:", (error as Error).message);
		}
		if (body.length > MAX_INJECT_CHARS) body = body.slice(0, MAX_INJECT_CHARS) + "\n\n[…truncated — read the full file for the rest]";
		const repos = reposOf(cfg, state.project).map((repo) => `  - ${repo}`).join("\n");
		const block = `

## Project Memory — ${state.project}

You have long-term project memory for the **${state.project}** project.
Memory file (absolute path): \`${file}\`
This memory is shared across all repos mapped to this project:
${repos}

${body ? `### Current contents (authoritative project context)\n\n${body.trimEnd()}\n` : "_(memory file is currently empty — you'll seed it as you learn)_"}

### Memory protocol — you OWN this memory
1. **Read first.** Treat the contents above as authoritative unless contradicted.
2. **Record what you learn.** Update \`${file}\` with durable project facts, decisions, constraints, architecture, repo ownership, and gotchas. Keep it concise and prune stale entries.
3. **Subagents have no memory of their own.** Pass relevant facts or the memory path when delegating, then fold durable returned knowledge into memory yourself to avoid concurrent writes.
4. **Conflicts or uncertainty → ASK, don't overwrite.** Ask the user how to reconcile contradictory or uncertain information before changing memory.
`;
		return { systemPrompt: event.systemPrompt + block };
	});

	async function runCommand(raw: string, ctx: ExtensionCommandContext): Promise<void> {
		if (!reloadConfig(ctx)) return;
		const [sub, ...rest] = parseArgs(raw);
		switch (sub) {
			case undefined:
				await toggle(ctx);
				return;
			case "on":
				enable(ctx, rest[0]);
				return;
			case "off":
				disable(ctx);
				return;
			case "status": {
				const candidates = candidatesFor(cfg, ctx.cwd);
				notify(ctx, [
					`Memory: ${state.enabled ? "ON" : "OFF"}`,
					`Active project: ${state.project || "(none)"}`,
					`File: ${state.project ? memoryFileFor(cfg, state.project) : "(none)"}`,
					`Repos mapped: ${state.project ? reposOf(cfg, state.project).join(", ") : "(none)"}`,
					`cwd ${tilde(ctx.cwd)} matches: ${candidates.length ? candidates.join(", ") : "(none)"}`,
				].join("\n"));
				return;
			}
			case "list": {
				const order = loadOrder();
				const names = orderedProjects(cfg, order);
				if (!names.length) { notify(ctx, "No projects configured. Run /memory create <name>."); return; }
				const candidates = new Set(candidatesFor(cfg, ctx.cwd));
				const lines = names.map((name) => `${Object.hasOwn(order.favorites, name) ? "★" : " "}${candidates.has(name) ? "●" : " "} ${name}  [${reposOf(cfg, name).join(", ")}]`);
				notify(ctx, `Projects (★ favorite · ● matches cwd ${tilde(ctx.cwd)}):\n${lines.join("\n")}`);
				return;
			}
			case "path": {
				const project = rest[0] || state.project;
				if (!project || !cfg.projects?.[project]) { notify(ctx, "Usage: /memory path [project]", "warning"); return; }
				notify(ctx, memoryFileFor(cfg, project));
				return;
			}
			case "create": {
				let name: string | undefined = rest[0];
				if (!name && ctx.hasUI) name = await ctx.ui.input("New project name:", "");
				if (!name) { notify(ctx, "Usage: /memory create <project> [repo ...]", "warning"); return; }
				validateProjectName(name);
				if (cfg.projects?.[name]) { notify(ctx, `Project "${name}" already exists; use /memory map or unmap to change it.`, "warning"); return; }
				const missing: string[] = [];
				let repos: string[];
				if (rest.length > 1) {
					repos = [...new Set(rest.slice(1).map(repoArgument))];
					for (const repo of repos) if (!fs.existsSync(repo)) missing.push(tilde(repo));
				} else if (ctx.hasUI) {
					const picked = await openPicker(ctx, repoItems(), {
						multi: true,
						title: `Select repos for "${name}"`,
						subtitle: `Memory file: ${tilde(memoryFileFor(cfg, name))}`,
						hint: "type to narrow · ↑↓ navigate · tab complete · enter toggle · esc finish · ctrl+C cancel",
					});
					if (!picked?.length) { notify(ctx, `No repos selected for "${name}". Aborting.`, "warning"); return; }
					repos = picked;
				} else {
					notify(ctx, "Usage: /memory create <project> <repo ...> (no UI in this mode)", "warning");
					return;
				}
				const previous = cfg;
				const next = { ...cfg, projects: { ...(cfg.projects || {}), [name]: repos } };
				saveConfig(next);
				let file: string;
				try {
					file = ensureMemoryFile(next, name, templateFor(next, name));
					ensureInOrder(next, name);
				} catch (error) {
					try { deleteMemoryProject(next, name); } catch { /* preserve the original failure */ }
					try { saveConfig(previous); } catch { /* preserve the original failure */ }
					throw error;
				}
				cfg = next;
				state = { enabled: true, project: name };
				refreshStatus(ctx);
				notify(ctx, `Created project "${name}" → mapped ${repos.map(tilde).join(", ")}\nMemory: ${file}${missing.length ? `\n⚠ not found: ${missing.join(", ")}` : ""}`, missing.length ? "warning" : "info");
				return;
			}
			case "edit": {
				let project = rest[0] || state.project;
				if (!project) project = await chooseProject(ctx, "Edit memory for project");
				if (!project || !cfg.projects?.[project]) { notify(ctx, "Usage: /memory edit [project]", "warning"); return; }
				const file = ensureMemoryFile(cfg, project, templateFor(cfg, project));
				if (!ctx.hasUI) { notify(ctx, `Non-interactive mode — edit directly: ${file}`); return; }
				const edited = await ctx.ui.editor(`Edit memory — ${project}`, fs.readFileSync(file, "utf-8"));
				if (typeof edited === "string") { writeMemoryFile(cfg, project, edited); notify(ctx, `Saved memory for "${project}"`); }
				return;
			}
			case "delete": {
				const project = rest[0];
				if (!project || !cfg.projects?.[project]) { notify(ctx, "Usage: /memory delete <project>", "warning"); return; }
				if (!ctx.hasUI) { notify(ctx, "Project deletion requires an interactive confirmation.", "warning"); return; }
				const ok = await ctx.ui.confirm(`Delete "${project}"?`, `Permanently removes ${memoryFileFor(cfg, project)} and its repo mapping.`);
				if (!ok) return;
				const projects = { ...(cfg.projects || {}) };
				delete projects[project];
				const defaults = Object.fromEntries(Object.entries(cfg.default || {}).filter(([, value]) => value !== project));
				const next = { ...cfg, projects, default: defaults };
				saveConfig(next);
				try {
					deleteMemoryProject(cfg, project);
				} catch (error) {
					saveConfig(cfg);
					throw error;
				}
				cfg = next;
				removeFromOrder(project);
				if (state.project === project) state = { enabled: false };
				refreshStatus(ctx);
				notify(ctx, `Deleted project "${project}"`);
				return;
			}
			case "map": {
				const project = rest[0];
				if (!project || !cfg.projects?.[project]) { notify(ctx, "Usage: /memory map <project> [repo ...]", "warning"); return; }
				let additions: string[];
				if (rest.length > 1) additions = rest.slice(1).map(repoArgument);
				else {
					const exclude = new Set(cfg.projects[project].map(norm));
					additions = await openPicker(ctx, repoItems(exclude), {
						multi: true, title: `Add repos to "${project}"`, subtitle: `Memory file: ${tilde(memoryFileFor(cfg, project))}`,
						hint: "type to narrow · ↑↓ navigate · tab complete · enter toggle · esc finish · ctrl+C cancel",
					}) ?? [];
				}
				if (!additions.length) { notify(ctx, "No repos selected."); return; }
				const repos = [...new Set([...cfg.projects[project].map(norm), ...additions.map(norm)])];
				const next = { ...cfg, projects: { ...(cfg.projects || {}), [project]: repos } };
				saveConfig(next); cfg = next;
				notify(ctx, `"${project}" now maps to: ${repos.map(tilde).join(", ")}`);
				return;
			}
			case "unmap": {
				const project = rest[0];
				if (!project || !cfg.projects?.[project] || rest.length < 2) { notify(ctx, "Usage: /memory unmap <project> <repo ...>", "warning"); return; }
				const dropped = new Set(rest.slice(1).map(repoArgument));
				const repos = cfg.projects[project].filter((repo) => !dropped.has(norm(repo)));
				const next = { ...cfg, projects: { ...(cfg.projects || {}), [project]: repos } };
				saveConfig(next); cfg = next;
				notify(ctx, `"${project}" now maps to: ${repos.map(tilde).join(", ") || "(none)"}`);
				return;
			}
			case "pick": {
				const project = await chooseProject(ctx, "Switch active project");
				if (project) enable(ctx, project);
				return;
			}
			case "favorite":
			case "star": {
				const project = rest[0] || state.project;
				if (!project || !cfg.projects?.[project]) { notify(ctx, "Usage: /memory favorite <project>", "warning"); return; }
				const order = loadOrder();
				if (!Object.hasOwn(order.favorites, project)) saveOrder(toggleFavorite(order, project));
				notify(ctx, `★ Favorited "${project}"`);
				return;
			}
			case "unfavorite":
			case "unstar": {
				const project = rest[0] || state.project;
				if (!project || !cfg.projects?.[project]) { notify(ctx, "Usage: /memory unfavorite <project>", "warning"); return; }
				const order = loadOrder();
				if (Object.hasOwn(order.favorites, project)) saveOrder(toggleFavorite(order, project));
				notify(ctx, `Unfavorited "${project}"`);
				return;
			}
			default:
				if (cfg.projects?.[sub]) enable(ctx, sub);
				else notify(ctx, `Unknown subcommand/project "${sub}". Try /memory list.`, "warning");
		}
	}

	pi.registerCommand("memory", {
		description: "Project memory: toggle / on / off / status / list / pick / favorite / create / edit / delete / map / unmap / path",
		handler: async (raw: string, ctx: ExtensionCommandContext) => {
			await ctx.waitForIdle();
			try {
				await runCommand(raw, ctx);
			} catch (error) {
				console.warn("[project-memory] command failed:", error);
				notify(ctx, `Project memory command failed: ${(error as Error).message}`, "error");
			}
		},
	});

	pi.registerShortcut(Key.alt("m"), {
		description: "Toggle project memory on/off",
		handler: async (ctx) => {
			try { await toggle(ctx); }
			catch (error) { notify(ctx, `Project memory failed: ${(error as Error).message}`, "error"); }
		},
	});
}
