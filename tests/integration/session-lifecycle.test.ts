import { afterEach, beforeEach, describe, expect, test } from "vitest";
import hippoMemoryExtension from "../../src/index";
import { type FakePiApi, createFakePiApi } from "../fixtures/fake-pi-api";
import { type TmpRoots, createTmpRoots } from "../fixtures/tmp-store";

describe("session lifecycle (integration)", () => {
	let roots: TmpRoots;
	let pi: FakePiApi;

	beforeEach(() => {
		roots = createTmpRoots();
		process.env.HIPPO_PROJECT_ROOT = roots.projectRoot;
		process.env.HIPPO_GLOBAL_ROOT = roots.globalRoot;
		process.env.HIPPO_MEMORY_AUTO_LEARN_GIT = "false";
		process.env.HIPPO_MEMORY_SEARCH_MODE = "bm25";
		pi = createFakePiApi(roots.projectRoot);
		hippoMemoryExtension(pi.api);
	});

	afterEach(async () => {
		try {
			await pi.emit("session_shutdown", {});
		} catch {
			// Double shutdown is a no-op; swallow if service already closed.
		}
		for (const key of [
			"HIPPO_PROJECT_ROOT",
			"HIPPO_GLOBAL_ROOT",
			"HIPPO_MEMORY_AUTO_LEARN_GIT",
			"HIPPO_MEMORY_SEARCH_MODE",
		]) {
			delete process.env[key];
		}
		roots.cleanup();
	});

	test("registers 17 tools and 6 commands", () => {
		expect(pi.tools).toHaveLength(17);
		expect(pi.commands).toHaveLength(6);
		for (const t of pi.tools) {
			expect(t.name).toMatch(/^tff-memory_/);
		}
	});

	test("session_start → remember → recall round-trip", async () => {
		await pi.emit("session_start", { reason: "startup" }, { cwd: roots.projectRoot });

		await pi.callTool("tff-memory_remember", {
			content: "auth uses argon2id with jwt rotation",
			tags: ["auth", "decision"],
		});

		const recall = (await pi.callTool("tff-memory_recall", {
			query: "argon2id",
			budget: 1000,
			limit: 5,
		})) as { content: Array<{ text: string }>; details: { count: number } };

		expect(recall.details.count).toBeGreaterThan(0);
	});

	test("before_agent_start injects context when memories match prompt", async () => {
		await pi.emit("session_start", { reason: "startup" }, { cwd: roots.projectRoot });

		await pi.callTool("tff-memory_remember", {
			content: "auth uses argon2id with jwt rotation",
			tags: ["auth"],
		});

		const result = (await pi.emit(
			"before_agent_start",
			{
				prompt: "refactor auth middleware",
				systemPrompt: "You are pi.",
			},
			{ cwd: roots.projectRoot },
		)) as { systemPrompt: string; message: { details: { memoryIds: string[] } } } | undefined;

		expect(result).toBeDefined();
		expect(result?.systemPrompt).toContain("argon2id");
		const ids = result?.message?.details?.memoryIds;
		expect(ids).toBeDefined();
		expect(ids?.length).toBeGreaterThan(0);
	});

	test("/toggle-hippo-memory disables auto-inject for the session", async () => {
		await pi.emit("session_start", { reason: "startup" }, { cwd: roots.projectRoot });

		await pi.callTool("tff-memory_remember", {
			content: "auth uses argon2id",
			tags: ["auth"],
		});

		// First: injection works
		const before = await pi.emit("before_agent_start", {
			prompt: "auth",
			systemPrompt: "system",
		});
		expect(before).toBeDefined();

		// Toggle off
		await pi.callCommand("toggle-hippo-memory", "");

		// Second: injection disabled
		const after = await pi.emit("before_agent_start", {
			prompt: "auth",
			systemPrompt: "system",
		});
		expect(after).toBeUndefined();
	});
});
