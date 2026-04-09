import { homedir } from "node:os";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveRoots } from "../../src/paths";

describe("resolveRoots", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env.HIPPO_HOME = undefined;
		process.env.HIPPO_PROJECT_ROOT = undefined;
		process.env.HIPPO_GLOBAL_ROOT = undefined;
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	test("default project root is cwd/.pi/hippo-memory", () => {
		const { projectRoot } = resolveRoots({ cwd: "/tmp/proj", config: {} });
		expect(projectRoot).toBe("/tmp/proj/.pi/hippo-memory");
	});

	test("default global root is ~/.pi/hippo-memory", () => {
		const { globalRoot } = resolveRoots({ cwd: "/tmp/proj", config: {} });
		expect(globalRoot).toBe(`${homedir()}/.pi/hippo-memory`);
	});

	test("HIPPO_HOME overrides global root", () => {
		process.env.HIPPO_HOME = "/custom/hippo";
		const { globalRoot } = resolveRoots({ cwd: "/tmp/proj", config: {} });
		expect(globalRoot).toBe("/custom/hippo");
	});

	test("config.projectRoot overrides default", () => {
		const { projectRoot } = resolveRoots({
			cwd: "/tmp/proj",
			config: { projectRoot: "/other/place" },
		});
		expect(projectRoot).toBe("/other/place");
	});

	test("config.globalRoot overrides HIPPO_HOME", () => {
		process.env.HIPPO_HOME = "/env/hippo";
		const { globalRoot } = resolveRoots({
			cwd: "/tmp/proj",
			config: { globalRoot: "/config/hippo" },
		});
		expect(globalRoot).toBe("/config/hippo");
	});
});
