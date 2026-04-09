import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config";
import { HippoMemoryService } from "../../src/hippo-memory-service";
import { type TmpRoots, createTmpRoots } from "../fixtures/tmp-store";

describe("HippoMemoryService init/shutdown", () => {
	let roots: TmpRoots;

	beforeEach(() => {
		roots = createTmpRoots();
	});

	afterEach(() => {
		roots.cleanup();
	});

	test("init opens project and global stores and marks service ready", async () => {
		const svc = new HippoMemoryService({
			...DEFAULT_CONFIG,
			projectRoot: roots.projectRoot,
			globalRoot: roots.globalRoot,
			autoLearnGit: false,
		});

		expect(svc.isReady()).toBe(false);
		const result = await svc.init("/unused");

		expect(result.projectRoot).toBe(roots.projectRoot);
		expect(result.globalRoot).toBe(roots.globalRoot);
		expect(svc.isReady()).toBe(true);
		expect(existsSync(`${roots.projectRoot}/hippo.db`)).toBe(true);
		expect(existsSync(`${roots.globalRoot}/hippo.db`)).toBe(true);

		await svc.shutdown();
		expect(svc.isReady()).toBe(false);
	});

	test("init falls back to project-only when global root is unwritable", async () => {
		const svc = new HippoMemoryService({
			...DEFAULT_CONFIG,
			projectRoot: roots.projectRoot,
			globalRoot: "/dev/null/definitely-not-writable",
			autoLearnGit: false,
		});

		const result = await svc.init("/unused");

		expect(result.projectRoot).toBe(roots.projectRoot);
		expect(result.globalRoot).toBeNull();
		expect(svc.isReady()).toBe(true);

		await svc.shutdown();
	});

	test("init throws if projectRoot or globalRoot is missing from config", async () => {
		const svc = new HippoMemoryService({
			...DEFAULT_CONFIG,
			// intentionally omit both to trigger the guard
		});

		await expect(svc.init("/unused")).rejects.toThrow(/projectRoot and globalRoot/);
	});
});
