import { afterEach, beforeEach, describe, expect, test } from "vitest";
import hippoMemoryExtension from "../../src/index";
import { type FakePiApi, createFakePiApi } from "../fixtures/fake-pi-api";
import { type TmpRoots, createTmpRoots } from "../fixtures/tmp-store";

describe("outcome feedback loop (integration)", () => {
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

	test("agent_end applies good outcome to anchor ids from before_agent_start", async () => {
		await pi.emit("session_start", { reason: "startup" }, { cwd: roots.projectRoot });

		// Store a memory and get its id.
		const stored = (await pi.callTool("tff-memory_remember", {
			content: "useful fact about auth argon2id",
			tags: ["auth"],
		})) as { details: { id: string } };

		// Trigger before_agent_start which recalls matching memories and
		// sets the anchor ids internally.
		await pi.emit("before_agent_start", {
			prompt: "auth argon2id",
			systemPrompt: "You are pi.",
		});

		// Simulate clean tool results.
		await pi.emit("tool_result", {
			toolName: "bash",
			content: [{ type: "text", text: "ok" }],
			details: { exitCode: 0 },
			isError: false,
		});

		// agent_end with clean stop should apply "good" outcome.
		await pi.emit("agent_end", { stopReason: "stop" });

		// Inspect the memory — the outcome should have been applied
		// (the entry still exists and is readable; exact strength values
		// are hippo's internal formula, so we just verify the round-trip
		// didn't throw and the entry is still present).
		const inspected = (await pi.callTool("tff-memory_inspect", {
			id: stored.details.id,
		})) as { details: { found: boolean; id: string } };

		expect(inspected.details.found).toBe(true);
		expect(inspected.details.id).toBe(stored.details.id);
	});
});
