import { describe, expect, test, vi } from "vitest";
import { createMemoryRecallCommand } from "../../../src/commands/memory-recall";
import { createFakeCommandContext } from "../../fixtures/fake-command-context";
import { createFakeEntry, createFakeService } from "../../fixtures/fake-memory-service";

describe("/memory-recall command", () => {
	test("notifies usage when query is empty", async () => {
		const service = createFakeService();
		const recallMock = vi.mocked(service.recall);
		const cmd = createMemoryRecallCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("   ", ctx);
		expect(recallMock).not.toHaveBeenCalled();
		const last = ctx.notifications.at(-1);
		expect(last?.level).toBe("warning");
		expect(last?.message).toContain("Usage");
	});

	test("reports empty result", async () => {
		const service = createFakeService();
		vi.mocked(service.recall).mockResolvedValue({
			query: "argon",
			results: [],
			tokensUsed: 0,
			mode: "bm25",
		});
		const cmd = createMemoryRecallCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("argon", ctx);
		expect(ctx.notifications.at(-1)?.message).toContain('No memories matched "argon"');
	});

	test("lists ranked matches with strength and explanation", async () => {
		const service = createFakeService();
		vi.mocked(service.recall).mockResolvedValue({
			query: "auth",
			results: [
				{
					entry: createFakeEntry({
						id: "mem_1",
						content: "auth uses argon2id",
						confidence: "verified",
						strength: 0.82,
					}),
					score: 0.9,
					explanation: "BM25: matched terms [auth]",
				},
				{
					entry: createFakeEntry({
						id: "mem_2",
						content: "jwt rotation enabled",
						confidence: "observed",
						strength: 0.45,
					}),
					score: 0.6,
				},
			],
			tokensUsed: 42,
			mode: "hybrid",
		});

		const cmd = createMemoryRecallCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("auth", ctx);
		const message = ctx.notifications.at(-1)?.message ?? "";
		expect(message).toContain("2 results");
		expect(message).toContain("hybrid");
		expect(message).toContain("argon2id");
		expect(message).toContain("jwt rotation");
		expect(message).toContain("matched terms");
	});
});
