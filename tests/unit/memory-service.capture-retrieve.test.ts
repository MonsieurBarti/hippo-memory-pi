import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config";
import { HippoMemoryService } from "../../src/hippo-memory-service";
import { type TmpRoots, createTmpRoots } from "../fixtures/tmp-store";

function makeService(roots: TmpRoots, overrides: Partial<Record<string, unknown>> = {}) {
	return new HippoMemoryService({
		...DEFAULT_CONFIG,
		projectRoot: roots.projectRoot,
		globalRoot: roots.globalRoot,
		autoLearnGit: false,
		// BM25-only for speed. Hybrid tests exist in dedicated files.
		searchMode: "bm25",
		...overrides,
	});
}

describe("HippoMemoryService.remember", () => {
	let roots: TmpRoots;
	let svc: HippoMemoryService;

	beforeEach(async () => {
		roots = createTmpRoots();
		svc = makeService(roots);
		await svc.init("/unused");
	});

	afterEach(async () => {
		await svc.shutdown();
		roots.cleanup();
	});

	test("stores an observation and returns a view", async () => {
		const entry = await svc.remember({
			content: "auth uses argon2id",
			tags: ["auth", "decision"],
		});

		expect(entry.id).toBeTruthy();
		expect(entry.content).toBe("auth uses argon2id");
		expect(entry.tags).toContain("auth");
		expect(entry.tags).toContain("decision");
		expect(entry.layer).toBe("episodic");
		expect(entry.confidence).toBe("observed"); // explicit override of hippo's "verified" default
		expect(entry.root).toBe("project");
	});

	test("with error=true adds error tag, negative valence, and extended half-life", async () => {
		const entry = await svc.remember({
			content: "tests fail when mocking the db",
			tags: ["testing"],
			error: true,
		});

		expect(entry.tags).toContain("error");
		expect(entry.emotionalValence).toBe("negative");
		expect(entry.halfLifeDays).toBeGreaterThan(7);
	});

	test("with pin=true sets pinned flag", async () => {
		const entry = await svc.remember({
			content: "never delete the audit log",
			pin: true,
		});
		expect(entry.pinned).toBe(true);
	});

	test("with global=true and global store available writes to global root", async () => {
		const entry = await svc.remember({
			content: "universal lesson",
			tags: ["universal"],
			global: true,
		});
		expect(entry.root).toBe("global");

		// Verify by inspecting — should come from global
		const fetched = await svc.inspect(entry.id);
		expect(fetched?.root).toBe("global");
	});
});

describe("HippoMemoryService.captureError", () => {
	let roots: TmpRoots;
	let svc: HippoMemoryService;

	beforeEach(async () => {
		roots = createTmpRoots();
		svc = makeService(roots);
		await svc.init("/unused");
	});

	afterEach(async () => {
		await svc.shutdown();
		roots.cleanup();
	});

	test("returns an error-tagged entry with negative valence", async () => {
		const entry = await svc.captureError({
			content: "TypeError in auth.spec.ts",
			tags: ["auto", "tool:bash"],
			source: "auto:tool_result:bash",
		});

		expect(entry).not.toBeNull();
		if (entry === null) throw new Error("unreachable");
		expect(entry.tags).toContain("error");
		expect(entry.emotionalValence).toBe("negative");
		expect(entry.confidence).toBe("observed");
	});
});

describe("HippoMemoryService.decide", () => {
	let roots: TmpRoots;
	let svc: HippoMemoryService;

	beforeEach(async () => {
		roots = createTmpRoots();
		svc = makeService(roots);
		await svc.init("/unused");
	});

	afterEach(async () => {
		await svc.shutdown();
		roots.cleanup();
	});

	test("sets 90-day half-life, verified confidence, and decision tag", async () => {
		const entry = await svc.decide({
			decision: "use argon2id + jwt rotation for auth",
			context: "flagged by legal for compliance",
		});
		expect(entry.halfLifeDays).toBeGreaterThanOrEqual(90);
		expect(entry.confidence).toBe("verified");
		expect(entry.tags).toContain("decision");
		expect(entry.content).toContain("flagged by legal");
	});
});

describe("HippoMemoryService.recall + context + inspect + listConflicts", () => {
	let roots: TmpRoots;
	let svc: HippoMemoryService;

	beforeEach(async () => {
		roots = createTmpRoots();
		svc = makeService(roots);
		await svc.init("/unused");
	});

	afterEach(async () => {
		await svc.shutdown();
		roots.cleanup();
	});

	test("recall returns stored memories ranked by relevance", async () => {
		await svc.remember({ content: "auth uses argon2id with jwt rotation", tags: ["auth"] });
		await svc.remember({ content: "frontend uses react and vite", tags: ["frontend"] });
		await svc.remember({ content: "database is postgres 16 with pgvector", tags: ["db"] });

		const result = await svc.recall("auth argon", { budget: 1000, limit: 5 });
		expect(result.mode).toBe("bm25");
		expect(result.results.length).toBeGreaterThan(0);
		// The top result should be the argon2id one
		expect(result.results[0]?.entry.content).toContain("argon2id");
	});

	test("recall with why=true includes explanations", async () => {
		await svc.remember({ content: "auth uses argon2id", tags: ["auth"] });
		// NOTE: hippo's BM25 tokenizer does exact-match (no substring/stemming),
		// so the query term must match a whole token in the content.
		const result = await svc.recall("argon2id", { why: true });
		expect(result.results.length).toBeGreaterThan(0);
		expect(result.results[0]?.explanation).toBeTruthy();
	});

	test("recall bumps retrieval_count via markRetrieved", async () => {
		const stored = await svc.remember({ content: "marker content" });
		const before = await svc.inspect(stored.id);
		expect(before?.retrievalCount).toBe(0);

		await svc.recall("marker content");

		const after = await svc.inspect(stored.id);
		expect(after?.retrievalCount).toBeGreaterThan(0);
	});

	test("context returns formatted block with observe framing by default", async () => {
		await svc.remember({
			content: "integration tests for auth must hit a real postgres",
			tags: ["testing", "auth"],
		});
		const result = await svc.context({ query: "auth test strategy", limit: 3 });
		expect(result.ids.length).toBeGreaterThan(0);
		expect(result.formattedBlock).toContain("Prior observations");
		expect(result.formattedBlock).toContain("integration tests");
		expect(result.framing).toBe("observe");
	});

	test("context returns empty when query has no matches", async () => {
		const result = await svc.context({ query: "completely unrelated topic xyz" });
		expect(result.ids).toEqual([]);
		expect(result.formattedBlock).toBe("");
	});

	test("context returns empty when query is missing", async () => {
		const result = await svc.context({ query: "" });
		expect(result.ids).toEqual([]);
		expect(result.formattedBlock).toBe("");
	});

	test("inspect returns null for unknown id", async () => {
		const result = await svc.inspect("mem_does_not_exist");
		expect(result).toBeNull();
	});

	test("inspect returns the stored entry by id", async () => {
		const stored = await svc.remember({ content: "observable fact" });
		const fetched = await svc.inspect(stored.id);
		expect(fetched?.id).toBe(stored.id);
		expect(fetched?.content).toBe("observable fact");
	});

	test("listConflicts returns empty array on fresh store", async () => {
		const conflicts = await svc.listConflicts();
		expect(Array.isArray(conflicts)).toBe(true);
		expect(conflicts).toHaveLength(0);
	});
});
