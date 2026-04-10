import { describe, expect, test, vi } from "vitest";
import { createMemoryConflictsCommand } from "../../../src/commands/memory-conflicts";
import { createFakeCommandContext } from "../../fixtures/fake-command-context";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("/memory-conflicts command", () => {
	test("reports empty state cleanly", async () => {
		const service = createFakeService();
		vi.mocked(service.listConflicts).mockResolvedValue([]);
		const cmd = createMemoryConflictsCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("", ctx);
		expect(ctx.notifications.at(-1)?.message).toBe("No open memory conflicts");
	});

	test("lists conflicts with ids and overlap percentages", async () => {
		const service = createFakeService();
		vi.mocked(service.listConflicts).mockResolvedValue([
			{
				id: "1",
				first: "mem_a",
				second: "mem_b",
				overlap: 0.75,
				conflictType: "polarity",
				status: "open",
				detectedAt: "2026-04-09T12:00:00.000Z",
			},
			{
				id: "2",
				first: "mem_c",
				second: "mem_d",
				overlap: 0.52,
				conflictType: "negation",
				status: "open",
				detectedAt: "2026-04-09T12:01:00.000Z",
			},
		]);
		const cmd = createMemoryConflictsCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("", ctx);
		const message = ctx.notifications.at(-1)?.message ?? "";
		expect(message).toContain("2 open conflicts");
		expect(message).toContain("[1]");
		expect(message).toContain("75%");
		expect(message).toContain("polarity");
		expect(message).toContain("mem_a");
		expect(message).toContain("mem_d");
	});
});
