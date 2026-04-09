import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config";
import { HippoMemoryService } from "../../src/hippo-memory-service";
import { type TmpRoots, createTmpRoots } from "../fixtures/tmp-store";

function makeService(roots: TmpRoots) {
	return new HippoMemoryService({
		...DEFAULT_CONFIG,
		projectRoot: roots.projectRoot,
		globalRoot: roots.globalRoot,
		autoLearnGit: false,
		searchMode: "bm25",
	});
}

// Isolate hippo's internal `initGlobal()` (used by autoShare / promoteToGlobal)
// from the real ~/.hippo directory. hippo resolves its global root from
// HIPPO_HOME → XDG_DATA_HOME → ~/.hippo.
let prevHippoHome: string | undefined;

function restoreHippoHome(prev: string | undefined): void {
	if (prev === undefined) {
		// Use Reflect to unset the env var (Biome disallows the delete operator).
		Reflect.deleteProperty(process.env, "HIPPO_HOME");
	} else {
		process.env.HIPPO_HOME = prev;
	}
}

describe("mutation methods", () => {
	let roots: TmpRoots;
	let svc: HippoMemoryService;

	beforeEach(async () => {
		roots = createTmpRoots();
		prevHippoHome = process.env.HIPPO_HOME;
		process.env.HIPPO_HOME = roots.globalRoot;
		svc = makeService(roots);
		await svc.init("/unused");
	});

	afterEach(async () => {
		await svc.shutdown();
		roots.cleanup();
		restoreHippoHome(prevHippoHome);
	});

	test("outcome(good) updates outcome counters and re-persists", async () => {
		const entry = await svc.remember({ content: "positive outcome target" });
		await svc.outcome(entry.id, "good");
		const after = await svc.inspect(entry.id);
		expect(after).not.toBeNull();
		expect(after?.id).toBe(entry.id);
	});

	test("outcome on unknown id is silent", async () => {
		await expect(svc.outcome("mem_nope", "good")).resolves.toBeUndefined();
	});

	test("pin sets pinned flag", async () => {
		const entry = await svc.remember({ content: "pin me" });
		await svc.pin(entry.id, true);
		const reloaded = await svc.inspect(entry.id);
		expect(reloaded?.pinned).toBe(true);
	});

	test("pin can also unset", async () => {
		const entry = await svc.remember({ content: "pin then unpin", pin: true });
		await svc.pin(entry.id, false);
		const reloaded = await svc.inspect(entry.id);
		expect(reloaded?.pinned).toBe(false);
	});

	test("forget removes the entry", async () => {
		const entry = await svc.remember({ content: "temporary" });
		await svc.forget(entry.id);
		const reloaded = await svc.inspect(entry.id);
		expect(reloaded).toBeNull();
	});

	test("invalidate returns count of weakened memories matching pattern", async () => {
		await svc.remember({ content: "we use oldLib 1.0 for charts" });
		await svc.remember({ content: "oldLib has a known csrf bug" });
		await svc.remember({ content: "completely unrelated observation" });

		const count = await svc.invalidate("oldlib", "migrated-to-newLib");
		expect(count).toBeGreaterThanOrEqual(2);
	});

	test("invalidate on empty pattern matches all (caller beware)", async () => {
		await svc.remember({ content: "a" });
		await svc.remember({ content: "b" });
		const count = await svc.invalidate("", "test");
		// Empty string is a substring of every entry → matches all
		expect(count).toBe(2);
	});

	test("resolveConflict throws for unknown id", async () => {
		await expect(svc.resolveConflict("conflict_nope", "first")).rejects.toThrow();
	});
});

describe("sleep and status", () => {
	let roots: TmpRoots;
	let svc: HippoMemoryService;

	beforeEach(async () => {
		roots = createTmpRoots();
		prevHippoHome = process.env.HIPPO_HOME;
		process.env.HIPPO_HOME = roots.globalRoot;
		svc = makeService(roots);
		await svc.init("/unused");
	});

	afterEach(async () => {
		await svc.shutdown();
		roots.cleanup();
		restoreHippoHome(prevHippoHome);
	});

	test("sleep(dryRun=true) does not persist changes", async () => {
		await svc.remember({ content: "a" });
		await svc.remember({ content: "b" });
		const before = await svc.status();
		await svc.sleep({ dryRun: true });
		const after = await svc.status();
		expect(after.projectTotal).toBe(before.projectTotal);
	});

	test("sleep returns a ConsolidationResult with numeric fields", async () => {
		for (let i = 0; i < 6; i++) {
			await svc.remember({ content: `observation ${i}`, tags: ["test"] });
		}
		const result = await svc.sleep();
		expect(typeof result.decayed).toBe("number");
		expect(typeof result.merged).toBe("number");
		expect(typeof result.conflicts).toBe("number");
		expect(typeof result.promoted).toBe("number");
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("status reflects stored entries", async () => {
		await svc.remember({ content: "one" });
		await svc.remember({ content: "two" });
		const s = await svc.status();
		expect(s.projectTotal).toBeGreaterThanOrEqual(2);
		expect(s.searchMode).toBe("bm25");
	});

	test("status on empty store has zero averageStrength", async () => {
		const s = await svc.status();
		expect(s.projectTotal).toBe(0);
		expect(s.averageStrength).toBe(0);
	});

	test("newSinceLastSleep counts captures across remember/captureError/decide", async () => {
		const before = await svc.status();
		expect(before.newSinceLastSleep).toBe(0);
		expect(before.lastSleepAt).toBeNull();

		await svc.remember({ content: "one" });
		await svc.remember({ content: "two" });
		await svc.captureError({
			content: "error occurred",
			tags: ["tool:bash"],
			source: "test",
		});
		await svc.decide({ decision: "use argon2id", context: "compliance" });

		const after = await svc.status();
		expect(after.newSinceLastSleep).toBe(4);
	});

	test("sleep(dryRun=true) does NOT reset newSinceLastSleep", async () => {
		await svc.remember({ content: "a" });
		await svc.remember({ content: "b" });
		await svc.sleep({ dryRun: true });
		const after = await svc.status();
		expect(after.newSinceLastSleep).toBe(2);
		expect(after.lastSleepAt).toBeNull();
	});

	test("sleep() resets newSinceLastSleep and sets lastSleepAt", async () => {
		await svc.remember({ content: "a" });
		await svc.remember({ content: "b" });
		await svc.remember({ content: "c" });

		const result = await svc.sleep();
		expect(result.durationMs).toBeGreaterThanOrEqual(0);

		const after = await svc.status();
		expect(after.newSinceLastSleep).toBe(0);
		expect(after.lastSleepAt).not.toBeNull();
		expect(typeof after.lastSleepAt).toBe("string");
		// Should be a valid ISO timestamp
		expect(new Date(after.lastSleepAt as string).toString()).not.toBe("Invalid Date");
	});

	test("newSinceLastSleep accumulates again after a sleep cycle", async () => {
		await svc.remember({ content: "a" });
		await svc.sleep();
		expect((await svc.status()).newSinceLastSleep).toBe(0);

		await svc.remember({ content: "b" });
		await svc.remember({ content: "c" });
		expect((await svc.status()).newSinceLastSleep).toBe(2);
	});
});

describe("working memory", () => {
	let roots: TmpRoots;
	let svc: HippoMemoryService;

	beforeEach(async () => {
		roots = createTmpRoots();
		prevHippoHome = process.env.HIPPO_HOME;
		process.env.HIPPO_HOME = roots.globalRoot;
		svc = makeService(roots);
		await svc.init("/unused");
	});

	afterEach(async () => {
		await svc.shutdown();
		roots.cleanup();
		restoreHippoHome(prevHippoHome);
	});

	test("wmPush / wmRead round-trip", async () => {
		await svc.wmPush({ scope: "task-1", content: "write the tests", importance: 3 });
		const items = await svc.wmRead("task-1");
		expect(items.length).toBeGreaterThan(0);
		expect(items[0]?.content).toContain("write the tests");
		expect(items[0]?.importance).toBe(3);
	});

	test("wmRead on empty scope returns empty array", async () => {
		const items = await svc.wmRead("never-used-scope");
		expect(items).toEqual([]);
	});

	test("wmFlush clears all scopes", async () => {
		await svc.wmPush({ scope: "task-a", content: "x" });
		await svc.wmPush({ scope: "task-b", content: "y" });
		await svc.wmFlush();
		expect(await svc.wmRead("task-a")).toEqual([]);
		expect(await svc.wmRead("task-b")).toEqual([]);
	});
});

describe("global store share", () => {
	let roots: TmpRoots;
	let svc: HippoMemoryService;

	beforeEach(async () => {
		roots = createTmpRoots();
		prevHippoHome = process.env.HIPPO_HOME;
		process.env.HIPPO_HOME = roots.globalRoot;
		svc = makeService(roots);
		await svc.init("/unused");
	});

	afterEach(async () => {
		await svc.shutdown();
		roots.cleanup();
		restoreHippoHome(prevHippoHome);
	});

	test("share(id) with dryRun does not move the entry", async () => {
		const entry = await svc.remember({ content: "local fact" });
		const result = await svc.share(entry.id, true);
		expect(result.promoted).toContain(entry.id);
		expect(result.dryRun).toBe(true);
		// Entry should still exist in project (not moved to global)
		const fetched = await svc.inspect(entry.id);
		expect(fetched?.root).toBe("project");
	});

	test("share('auto', dryRun=true) returns a ShareResult", async () => {
		await svc.remember({ content: "maybe universal lesson", tags: ["universal"] });
		const result = await svc.share("auto", true);
		expect(result.dryRun).toBe(true);
		expect(Array.isArray(result.promoted)).toBe(true);
		expect(Array.isArray(result.skipped)).toBe(true);
	});

	test("autoShare on empty store does not throw", async () => {
		const result = await svc.autoShare();
		expect(typeof result.promoted).toBe("number");
		expect(typeof result.considered).toBe("number");
	});
});

describe("learnFromGit", () => {
	let roots: TmpRoots;
	let svc: HippoMemoryService;

	beforeEach(async () => {
		roots = createTmpRoots();
		prevHippoHome = process.env.HIPPO_HOME;
		process.env.HIPPO_HOME = roots.globalRoot;
		svc = makeService(roots);
		await svc.init("/unused");
	});

	afterEach(async () => {
		await svc.shutdown();
		roots.cleanup();
		restoreHippoHome(prevHippoHome);
	});

	test("learnFromGit on a non-repo directory does not throw", async () => {
		// roots.projectRoot is a tmp dir created via os.tmpdir(); its ancestors
		// typically contain no .git, in which case hippo's fetchGitLog
		// internally swallows the error and returns an empty string. The public
		// wrapper should report numeric counts without throwing regardless.
		// We deliberately don't hard-assert scanned === 0: under parallel CI
		// load we've observed rare cases where git appears to walk upward to a
		// containing workspace; the behavioural contract we care about here is
		// graceful fallback (numeric fields, no throw), not zero counts.
		const result = await svc.learnFromGit({ days: 7, repos: [roots.projectRoot] });
		expect(typeof result.scanned).toBe("number");
		expect(typeof result.added).toBe("number");
		expect(typeof result.skipped).toBe("number");
		expect(result.scanned).toBeGreaterThanOrEqual(0);
	});

	test("learnFromGit on the hippo-memory-pi repo may find commits but should not throw", async () => {
		const actualProjectRoot = process.cwd();
		const result = await svc.learnFromGit({ days: 90, repos: [actualProjectRoot] });
		expect(typeof result.scanned).toBe("number");
		expect(typeof result.added).toBe("number");
		expect(typeof result.skipped).toBe("number");
	});
});
