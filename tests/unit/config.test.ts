import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_CONFIG, loadConfig } from "../../src/config";

describe("loadConfig", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		for (const key of Object.keys(process.env)) {
			if (key.startsWith("HIPPO_")) delete process.env[key];
		}
	});

	afterEach(() => {
		process.env = { ...originalEnv };
	});

	test("returns defaults when no env vars or config file", () => {
		const cfg = loadConfig({ cwd: "/nowhere-real" });
		expect(cfg).toEqual(DEFAULT_CONFIG);
	});

	test("env var overrides auto-inject", () => {
		process.env.HIPPO_MEMORY_AUTO_INJECT = "false";
		const cfg = loadConfig({ cwd: "/nowhere-real" });
		expect(cfg.autoInject).toBe(false);
	});

	test("env var overrides numeric recall budget", () => {
		process.env.HIPPO_MEMORY_RECALL_BUDGET = "2500";
		const cfg = loadConfig({ cwd: "/nowhere-real" });
		expect(cfg.recallBudget).toBe(2500);
	});

	test("ignores non-numeric env var for numeric field", () => {
		process.env.HIPPO_MEMORY_RECALL_BUDGET = "not-a-number";
		const cfg = loadConfig({ cwd: "/nowhere-real" });
		expect(cfg.recallBudget).toBe(DEFAULT_CONFIG.recallBudget);
	});

	test("env var overrides search mode", () => {
		process.env.HIPPO_MEMORY_SEARCH_MODE = "bm25";
		const cfg = loadConfig({ cwd: "/nowhere-real" });
		expect(cfg.searchMode).toBe("bm25");
	});
});
