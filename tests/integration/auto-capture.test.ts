import { afterEach, beforeEach, describe, expect, test } from "vitest";
import hippoMemoryExtension from "../../src/index";
import { type FakePiApi, createFakePiApi } from "../fixtures/fake-pi-api";
import { type TmpRoots, createTmpRoots } from "../fixtures/tmp-store";

describe("error auto-capture (integration)", () => {
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

	test("a failing tool_result is auto-captured as an error-tagged memory", async () => {
		await pi.emit("session_start", { reason: "startup" }, { cwd: roots.projectRoot });

		await pi.emit("tool_result", {
			toolName: "bash",
			content: [
				{
					type: "text",
					text: "Error: auth.spec.ts failed with TypeError: undefined is not a function",
				},
			],
			details: { exitCode: 1 },
			isError: true,
		});

		// The auto-capture hook should have stored an error memory.
		const recall = (await pi.callTool("tff-memory_recall", {
			query: "auth TypeError",
			limit: 5,
		})) as { details: { results: Array<{ tags: string[] }> } };

		expect(recall.details.results.length).toBeGreaterThan(0);
		const tags: string[] = recall.details.results.flatMap((r: { tags: string[] }) => r.tags);
		expect(tags).toContain("error");
	});

	test("benign tool_result is not captured", async () => {
		await pi.emit("session_start", { reason: "startup" }, { cwd: roots.projectRoot });

		await pi.emit("tool_result", {
			toolName: "bash",
			content: [{ type: "text", text: "ok" }],
			details: { exitCode: 0 },
			isError: false,
		});

		const status = (await pi.callTool("tff-memory_status", {})) as {
			details: { projectTotal: number };
		};
		expect(status.details.projectTotal).toBe(0);
	});
});
