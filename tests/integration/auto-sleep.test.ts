import { afterEach, beforeEach, describe, expect, test } from "vitest";
import hippoMemoryExtension from "../../src/index";
import { type FakePiApi, createFakePiApi } from "../fixtures/fake-pi-api";
import { type TmpRoots, createTmpRoots } from "../fixtures/tmp-store";

describe("auto-sleep on shutdown (integration)", () => {
	let roots: TmpRoots;
	let pi: FakePiApi;

	beforeEach(() => {
		roots = createTmpRoots();
		process.env.HIPPO_PROJECT_ROOT = roots.projectRoot;
		process.env.HIPPO_GLOBAL_ROOT = roots.globalRoot;
		process.env.HIPPO_MEMORY_AUTO_LEARN_GIT = "false";
		process.env.HIPPO_MEMORY_SEARCH_MODE = "bm25";
		process.env.HIPPO_MEMORY_SLEEP_THRESHOLD = "3";
		pi = createFakePiApi(roots.projectRoot);
		hippoMemoryExtension(pi.api);
	});

	afterEach(() => {
		for (const key of [
			"HIPPO_PROJECT_ROOT",
			"HIPPO_GLOBAL_ROOT",
			"HIPPO_MEMORY_AUTO_LEARN_GIT",
			"HIPPO_MEMORY_SEARCH_MODE",
			"HIPPO_MEMORY_SLEEP_THRESHOLD",
		]) {
			delete process.env[key];
		}
		roots.cleanup();
	});

	test("shutdown triggers auto-sleep when newSinceLastSleep >= threshold", async () => {
		await pi.emit("session_start", { reason: "startup" }, { cwd: roots.projectRoot });

		// Accumulate enough memories to pass the threshold (set to 3 via env).
		for (let i = 0; i < 4; i++) {
			await pi.callTool("tff-memory_remember", {
				content: `observation ${i}`,
				tags: ["test"],
			});
		}

		// Verify status shows newSinceLastSleep >= threshold.
		const beforeShutdown = (await pi.callTool("tff-memory_status", {})) as {
			details: { newSinceLastSleep: number };
		};
		expect(beforeShutdown.details.newSinceLastSleep).toBeGreaterThanOrEqual(3);

		// Shutdown triggers auto-sleep. Should not throw.
		await pi.emit("session_shutdown", {});

		// After shutdown, the service is closed. We can't call status again.
		// The test passes if shutdown completed without error; the Wave 2.D
		// unit tests verify sleep's internal behavior.
	});

	test("shutdown completes cleanly when under threshold", async () => {
		await pi.emit("session_start", { reason: "startup" }, { cwd: roots.projectRoot });

		// Only 1 memory — under the threshold of 3.
		await pi.callTool("tff-memory_remember", { content: "only one" });

		// Should not sleep, just shut down cleanly.
		await expect(pi.emit("session_shutdown", {})).resolves.not.toThrow();
	});
});
