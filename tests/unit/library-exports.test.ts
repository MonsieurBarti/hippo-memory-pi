import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
		const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpCwd);
		try {
			const handle = await createMemoryService();
			try {
				expect(cwdSpy).toHaveBeenCalled();
				expect(handle.service.isReady()).toBe(true);
			} finally {
				await handle.release();
			}
		} finally {
			cwdSpy.mockRestore();
		}
	});

	test("release() is idempotent — second call is a no-op", async () => {
		const handle = await createMemoryService({ cwd: tmpCwd });
		expect(handle.service.isReady()).toBe(true);
		await handle.release();
		expect(handle.service.isReady()).toBe(false);
		// Second call must not throw and must not re-invoke shutdown.
		await expect(handle.release()).resolves.toBeUndefined();
		expect(handle.service.isReady()).toBe(false);
	});
});

describe("createMemoryService — shared instance via registry", () => {
	let tmpCwd: string;
	let prebuilt: HippoMemoryService | null = null;

	beforeEach(() => {
		tmpCwd = mkdtempSync(join(tmpdir(), "hippo-shared-"));
		(globalThis as Record<symbol, unknown>)[REGISTRY_KEY] = undefined;
	});

	afterEach(async () => {
		(globalThis as Record<symbol, unknown>)[REGISTRY_KEY] = undefined;
		if (prebuilt) {
			await prebuilt.shutdown();
			prebuilt = null;
		}
		rmSync(tmpCwd, { recursive: true, force: true });
	});

	test("returns the exact registry instance when it is ready", async () => {
		const projectRoot = join(tmpCwd, "project");
		const globalRoot = join(tmpCwd, "global");
		prebuilt = new HippoMemoryService({
			...DEFAULT_CONFIG,
			projectRoot,
			globalRoot,
			autoLearnGit: false,
		});
		await prebuilt.init(tmpCwd);
		(globalThis as Record<symbol, unknown>)[REGISTRY_KEY] = prebuilt;

		const handle = await createMemoryService({ cwd: tmpCwd });

		expect(handle.shared).toBe(true);
		expect(handle.service).toBe(prebuilt);
		expect(handle.service.isReady()).toBe(true);
	});

	test("release() is a no-op on a shared handle; original stays ready", async () => {
		const projectRoot = join(tmpCwd, "project");
		const globalRoot = join(tmpCwd, "global");
		prebuilt = new HippoMemoryService({
			...DEFAULT_CONFIG,
			projectRoot,
			globalRoot,
			autoLearnGit: false,
		});
		await prebuilt.init(tmpCwd);
		(globalThis as Record<symbol, unknown>)[REGISTRY_KEY] = prebuilt;

		const handle = await createMemoryService({ cwd: tmpCwd });
		await handle.release();

		expect(prebuilt.isReady()).toBe(true);
		expect(handle.service.isReady()).toBe(true);
	});
});
