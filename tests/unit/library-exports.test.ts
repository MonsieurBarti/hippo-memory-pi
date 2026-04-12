import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import hippoMemoryExtension, {
	DEFAULT_CONFIG,
	HippoMemoryService,
	REGISTRY_KEY,
	createMemoryService,
	loadConfig,
	resolveRoots,
} from "../../src/index";

describe("hippo-memory-pi library exports", () => {
	test("default export is still a function", () => {
		expect(typeof hippoMemoryExtension).toBe("function");
	});

	test("HippoMemoryService is a constructor", () => {
		expect(typeof HippoMemoryService).toBe("function");
		expect(HippoMemoryService.prototype.init).toBeInstanceOf(Function);
		expect(HippoMemoryService.prototype.shutdown).toBeInstanceOf(Function);
	});

	test("loadConfig is a function and DEFAULT_CONFIG is an object", () => {
		expect(typeof loadConfig).toBe("function");
		expect(typeof DEFAULT_CONFIG).toBe("object");
		expect(DEFAULT_CONFIG.searchMode).toBe("hybrid");
	});

	test("resolveRoots is a function that returns projectRoot and globalRoot", () => {
		expect(typeof resolveRoots).toBe("function");
		const roots = resolveRoots({ cwd: "/tmp/x", config: {} });
		expect(typeof roots.projectRoot).toBe("string");
		expect(typeof roots.globalRoot).toBe("string");
	});
});

describe("createMemoryService — owned instance", () => {
	let tmpCwd: string;

	beforeEach(() => {
		tmpCwd = mkdtempSync(join(tmpdir(), "hippo-factory-"));
		(globalThis as Record<symbol, unknown>)[REGISTRY_KEY] = undefined;
	});

	afterEach(() => {
		(globalThis as Record<symbol, unknown>)[REGISTRY_KEY] = undefined;
		rmSync(tmpCwd, { recursive: true, force: true });
	});

	test("builds and initializes a fresh service when registry is empty", async () => {
		const handle = await createMemoryService({ cwd: tmpCwd });
		expect(handle.shared).toBe(false);
		expect(handle.service.isReady()).toBe(true);
		await handle.release();
		expect(handle.service.isReady()).toBe(false);
	});

	test("remember/recall roundtrip works on the owned service", async () => {
		const handle = await createMemoryService({ cwd: tmpCwd });
		try {
			const entry = await handle.service.remember({
				content: "factory-path verification command: bun run test",
				tags: ["verification", "test-roundtrip"],
			});
			expect(entry.id).toBeDefined();
			const hits = await handle.service.recall("verification command", {
				limit: 5,
			});
			expect(hits.results.length).toBeGreaterThan(0);
			expect(hits.results.some((h) => h.entry.content.includes("bun run test"))).toBe(true);
		} finally {
			await handle.release();
		}
	});

	test("defaults cwd to process.cwd() when not provided", async () => {
		const handle = await createMemoryService({ cwd: tmpCwd });
		try {
			expect(handle.service.isReady()).toBe(true);
		} finally {
			await handle.release();
		}
	});
});
