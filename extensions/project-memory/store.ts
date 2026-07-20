import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export const EXT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const CONFIG_PATH = path.join(EXT_DIR, "config.json");
export const ORDER_PATH = path.join(EXT_DIR, "order.json");
export const MEMORY_FILE = "MEMORY.md";
export const DEFAULT_MEMORY_ROOT = path.join(os.homedir(), ".pi", "agent", "memory");

export interface Config {
	memoryRoot?: string;
	projects?: Record<string, string[]>;
	default?: Record<string, string>;
}

export interface OrderState {
	order: string[];
	favorites: Record<string, number>;
}

export function expandHome(p: string): string {
	return p.startsWith("~/") ? path.join(os.homedir(), p.slice(2)) : p;
}

export function norm(p: string): string {
	return path.resolve(expandHome(p));
}

export function tilde(p: string): string {
	const home = os.homedir();
	return p === home || p.startsWith(home + path.sep) ? "~" + p.slice(home.length) : p;
}

export function validateProjectName(name: string): string {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
		throw new Error(`Invalid project name "${name}". Use letters, numbers, dots, underscores, or hyphens.`);
	}
	return name;
}

function parseConfig(value: unknown): Config {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("config must be a JSON object");
	const raw = value as Record<string, unknown>;
	if (raw.memoryRoot !== undefined && typeof raw.memoryRoot !== "string") throw new Error("memoryRoot must be a string");

	const projects: Record<string, string[]> = {};
	if (raw.projects !== undefined) {
		if (!raw.projects || typeof raw.projects !== "object" || Array.isArray(raw.projects)) throw new Error("projects must be an object");
		for (const [name, repos] of Object.entries(raw.projects as Record<string, unknown>)) {
			validateProjectName(name);
			if (!Array.isArray(repos) || !repos.every((repo) => typeof repo === "string")) {
				throw new Error(`projects.${name} must be an array of paths`);
			}
			projects[name] = [...new Set(repos.map(norm))];
		}
	}

	const defaults: Record<string, string> = {};
	if (raw.default !== undefined) {
		if (!raw.default || typeof raw.default !== "object" || Array.isArray(raw.default)) throw new Error("default must be an object");
		for (const [repo, project] of Object.entries(raw.default as Record<string, unknown>)) {
			if (typeof project !== "string" || !projects[project]) throw new Error(`default for ${repo} names an unknown project`);
			defaults[norm(repo)] = project;
		}
	}

	return { memoryRoot: raw.memoryRoot as string | undefined, projects, default: defaults };
}

function atomicWrite(file: string, contents: string): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
	try {
		fs.writeFileSync(temp, contents, { encoding: "utf-8", mode: 0o600 });
		fs.renameSync(temp, file);
	} catch (error) {
		try { fs.unlinkSync(temp); } catch { /* best effort */ }
		throw error;
	}
}

export function loadConfig(): Config {
	if (!fs.existsSync(CONFIG_PATH)) return { projects: {}, default: {} };
	return parseConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")));
}

export function saveConfig(cfg: Config): void {
	const checked = parseConfig(cfg);
	atomicWrite(CONFIG_PATH, JSON.stringify(checked, null, 2) + "\n");
}

export function memoryRoot(cfg: Config): string {
	return norm(cfg.memoryRoot || DEFAULT_MEMORY_ROOT);
}

export function projectDirFor(cfg: Config, project: string): string {
	validateProjectName(project);
	const root = memoryRoot(cfg);
	const dir = path.resolve(root, project);
	const relative = path.relative(root, dir);
	if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error(`Unsafe project memory path for "${project}"`);
	}
	return dir;
}

export function memoryFileFor(cfg: Config, project: string): string {
	return path.join(projectDirFor(cfg, project), MEMORY_FILE);
}

function rejectSymlink(target: string, label: string): void {
	if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error(`${label} cannot be a symbolic link: ${target}`);
}

export function ensureMemoryFile(cfg: Config, project: string, template: string): string {
	const dir = projectDirFor(cfg, project);
	fs.mkdirSync(dir, { recursive: true });
	rejectSymlink(dir, "Project memory directory");
	const file = path.join(dir, MEMORY_FILE);
	rejectSymlink(file, "Project memory file");
	if (!fs.existsSync(file)) atomicWrite(file, template);
	return file;
}

export function writeMemoryFile(cfg: Config, project: string, contents: string): void {
	const file = memoryFileFor(cfg, project);
	rejectSymlink(path.dirname(file), "Project memory directory");
	rejectSymlink(file, "Project memory file");
	atomicWrite(file, contents);
}

export function readMemoryFile(cfg: Config, project: string): string {
	const file = memoryFileFor(cfg, project);
	rejectSymlink(path.dirname(file), "Project memory directory");
	rejectSymlink(file, "Project memory file");
	return fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
}

export function deleteMemoryProject(cfg: Config, project: string): void {
	const dir = projectDirFor(cfg, project);
	rejectSymlink(dir, "Project memory directory");
	fs.rmSync(dir, { recursive: true, force: true });
}

export function projectNames(cfg: Config): string[] {
	return Object.keys(cfg.projects || {});
}

export function candidatesFor(cfg: Config, cwd: string): string[] {
	const normalizedCwd = norm(cwd);
	return Object.entries(cfg.projects || {}).filter(([, repos]) => repos.some((repo) => {
		const normalizedRepo = norm(repo);
		return normalizedCwd === normalizedRepo || normalizedCwd.startsWith(normalizedRepo + path.sep);
	})).map(([name]) => name);
}

export function resolveProject(cfg: Config, cwd: string): string | undefined {
	const candidates = candidatesFor(cfg, cwd);
	if (candidates.length <= 1) return candidates[0];
	const normalizedCwd = norm(cwd);
	for (const [repo, project] of Object.entries(cfg.default || {})) {
		const normalizedRepo = norm(repo);
		if ((normalizedCwd === normalizedRepo || normalizedCwd.startsWith(normalizedRepo + path.sep)) && candidates.includes(project)) return project;
	}
	return candidates[0];
}

export function reposOf(cfg: Config, project: string): string[] {
	return (cfg.projects?.[project] || []).map(tilde);
}

export function loadOrder(): OrderState {
	if (!fs.existsSync(ORDER_PATH)) return { order: [], favorites: {} };
	const raw = JSON.parse(fs.readFileSync(ORDER_PATH, "utf-8")) as Record<string, unknown>;
	const order = Array.isArray(raw.order) ? raw.order.filter((name): name is string => typeof name === "string") : [];
	const favorites: Record<string, number> = {};
	if (raw.favorites && typeof raw.favorites === "object" && !Array.isArray(raw.favorites)) {
		for (const [name, timestamp] of Object.entries(raw.favorites as Record<string, unknown>)) {
			if (typeof timestamp === "number" && Number.isFinite(timestamp)) favorites[name] = timestamp;
		}
	}
	return { order: [...new Set(order)], favorites };
}

export function saveOrder(state: OrderState): void {
	atomicWrite(ORDER_PATH, JSON.stringify(state, null, 2) + "\n");
}

export function orderedProjects(cfg: Config, state: OrderState): string[] {
	const all = new Set(projectNames(cfg));
	const favorites = Object.entries(state.favorites)
		.filter(([name]) => all.has(name))
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.map(([name]) => name);
	const seen = new Set(favorites);
	const rest: string[] = [];
	for (const name of state.order) if (all.has(name) && !seen.has(name)) { rest.push(name); seen.add(name); }
	for (const name of [...all].sort()) if (!seen.has(name)) rest.push(name);
	return [...favorites, ...rest];
}

export function toggleFavorite(state: OrderState, name: string): OrderState {
	const favorites = { ...state.favorites };
	let order = state.order.slice();
	if (Object.hasOwn(favorites, name)) {
		delete favorites[name];
		if (!order.includes(name)) order.push(name);
	} else {
		const newest = Math.max(Date.now(), ...Object.values(favorites).map((value) => value + 1));
		favorites[name] = newest;
		order = order.filter((entry) => entry !== name);
	}
	return { order, favorites };
}

export function moveProject(cfg: Config, state: OrderState, name: string, direction: "up" | "down"): OrderState {
	if (Object.hasOwn(state.favorites, name)) return state;
	const order = orderedProjects(cfg, state).filter((entry) => !Object.hasOwn(state.favorites, entry));
	const index = order.indexOf(name);
	const target = direction === "up" ? index - 1 : index + 1;
	if (index < 0 || target < 0 || target >= order.length) return state;
	const current = order[index]!;
	order[index] = order[target]!;
	order[target] = current;
	return { ...state, order };
}

export function ensureInOrder(cfg: Config, name: string): void {
	const state = loadOrder();
	if (!state.order.includes(name) && !Object.hasOwn(state.favorites, name)) {
		state.order = orderedProjects(cfg, state).filter((entry) => !Object.hasOwn(state.favorites, entry));
		saveOrder(state);
	}
}

export function removeFromOrder(name: string): void {
	const state = loadOrder();
	const order = state.order.filter((entry) => entry !== name);
	const favorites = { ...state.favorites };
	delete favorites[name];
	if (order.length !== state.order.length || Object.hasOwn(state.favorites, name)) saveOrder({ order, favorites });
}
