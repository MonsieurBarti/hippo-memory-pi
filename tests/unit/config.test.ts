import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

	test("accepts case-insensitive booleans: TRUE, yes, on", () => {
		for (const val of ["TRUE", "True", "YES", "yes", "On"]) {
			process.env.HIPPO_MEMORY_AUTO_INJECT = val;
			expect(loadConfig({ cwd: "/nowhere-real" }).autoInject).toBe(true);
		}
		for (const val of ["FALSE", "False", "NO", "no", "Off"]) {
			process.env.HIPPO_MEMORY_AUTO_INJECT = val;
			expect(loadConfig({ cwd: "/nowhere-real" }).autoInject).toBe(false);
		}
	});

	test("rejects fractional and garbage int env vars", () => {
		for (const val of ["1.5", "1000abc", "", " ", "-5", "+1"]) {
			process.env.HIPPO_MEMORY_RECALL_BUDGET = val;
			expect(loadConfig({ cwd: "/nowhere-real" }).recallBudget).toBe(DEFAULT_CONFIG.recallBudget);
		}
	});

	test("accepts zero for int env vars", () => {
		process.env.HIPPO_MEMORY_RECALL_BUDGET = "0";
		expect(loadConfig({ cwd: "/nowhere-real" }).recallBudget).toBe(0);
	});

	describe("config file sanitization", () => {
		let tmpCwd: string;

		beforeEach(() => {
			tmpCwd = mkdtempSync(join(tmpdir(), "hippo-config-"));
		});

		afterEach(() => {
			rmSync(tmpCwd, { recursive: true, force: true });
		});

		test("strips fields with wrong runtime types", () => {
			writeFileSync(
				join(tmpCwd, "hippo-memory.config.json"),
				JSON.stringify({
					recallBudget: "not-a-number",
					autoInject: "yes",
					searchMode: "bm25",
					framing: "assert",
					recallLimit: 3,
				}),
			);
			const cfg = loadConfig({ cwd: tmpCwd });
			// Invalid fields fall back to defaults
			expect(cfg.recallBudget).toBe(DEFAULT_CONFIG.recallBudget);
			expect(cfg.autoInject).toBe(DEFAULT_CONFIG.autoInject);
			// Valid fields are honored
			expect(cfg.searchMode).toBe("bm25");
			expect(cfg.framing).toBe("assert");
			expect(cfg.recallLimit).toBe(3);
		});

		test("ignores non-object json root", () => {
			writeFileSync(join(tmpCwd, "hippo-memory.config.json"), "42");
			expect(loadConfig({ cwd: tmpCwd })).toEqual(DEFAULT_CONFIG);
		});

		test("ignores malformed json with a stderr warning", () => {
			writeFileSync(join(tmpCwd, "hippo-memory.config.json"), "{ not json");
			// We don't assert on stderr content here to avoid capturing it;
			// the goal is that loadConfig does not throw and returns defaults.
			expect(() => loadConfig({ cwd: tmpCwd })).not.toThrow();
			expect(loadConfig({ cwd: tmpCwd })).toEqual(DEFAULT_CONFIG);
		});

		test("env var overrides sanitized file value", () => {
			writeFileSync(
				join(tmpCwd, "hippo-memory.config.json"),
				JSON.stringify({ recallBudget: 2000 }),
			);
			process.env.HIPPO_MEMORY_RECALL_BUDGET = "3000";
			expect(loadConfig({ cwd: tmpCwd }).recallBudget).toBe(3000);
		});
	});
});
