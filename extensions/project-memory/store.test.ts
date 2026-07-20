import { describe, expect, test } from "bun:test";
import * as path from "node:path";
import {
	type Config,
	moveProject,
	orderedProjects,
	projectDirFor,
	toggleFavorite,
	validateProjectName,
} from "./store.ts";

const config: Config = {
	memoryRoot: "/tmp/project-memory-tests",
	projects: { alpha: [], beta: [], gamma: [] },
	default: {},
};

describe("safe memory paths", () => {
	test("accepts portable project names", () => expect(validateProjectName("heatsink-native.v2")).toBe("heatsink-native.v2"));
	for (const name of ["..", "../repos", "/tmp/project", "a/b", "name with spaces", ""]) {
		test(`rejects ${JSON.stringify(name)}`, () => expect(() => validateProjectName(name)).toThrow());
	}
	test("keeps project directories beneath memoryRoot", () => {
		const dir = projectDirFor(config, "alpha");
		expect(path.relative(config.memoryRoot!, dir)).toBe("alpha");
	});
});

describe("project ordering", () => {
	test("moves projects when persisted order is empty", () => {
		const moved = moveProject(config, { order: [], favorites: {} }, "beta", "up");
		expect(orderedProjects(config, moved)).toEqual(["beta", "alpha", "gamma"]);
	});

	test("normalizes partial and stale order entries", () => {
		const moved = moveProject(config, { order: ["stale", "gamma"], favorites: {} }, "alpha", "down");
		expect(orderedProjects(config, moved)).toEqual(["gamma", "beta", "alpha"]);
	});

	test("pins favorites above manual order", () => {
		const favorited = toggleFavorite({ order: ["gamma", "alpha", "beta"], favorites: {} }, "beta");
		expect(orderedProjects(config, favorited)).toEqual(["beta", "gamma", "alpha"]);
		expect(moveProject(config, favorited, "beta", "down")).toBe(favorited);
	});
});
