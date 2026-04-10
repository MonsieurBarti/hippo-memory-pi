import { describe, expect, test, vi } from "vitest";
import { createMemoryInspectCommand } from "../../../src/commands/memory-inspect";
import { createFakeCommandContext } from "../../fixtures/fake-command-context";
import { createFakeEntry, createFakeService } from "../../fixtures/fake-memory-service";

describe("/memory-inspect command", () => {
	test("notifies usage when id is empty", async () => {
		const service = createFakeService();
		const cmd = createMemoryInspectCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("   ", ctx);
		expect(ctx.notifications.at(-1)?.level).toBe("warning");
	});

	test("notifies not-found when service returns null", async () => {
		const service = createFakeService();
		vi.mocked(service.inspect).mockResolvedValue(null);
		const cmd = createMemoryInspectCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("mem_nope", ctx);
		expect(ctx.notifications.at(-1)?.message).toContain("Not found: mem_nope");
	});

	test("prints the entry details when found", async () => {
		const service = createFakeService();
		vi.mocked(service.inspect).mockResolvedValue(
			createFakeEntry({
				id: "mem_42",
				content: "observable fact about auth",
				tags: ["auth", "decision"],
				confidence: "verified",
				strength: 0.73,
				halfLifeDays: 90,
				pinned: true,
			}),
		);
		const cmd = createMemoryInspectCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("mem_42", ctx);
		const message = ctx.notifications.at(-1)?.message ?? "";
		expect(message).toContain("id: mem_42");
		expect(message).toContain("confidence: verified");
		expect(message).toContain("tags: auth, decision");
		expect(message).toContain("pinned: true");
		expect(message).toContain("observable fact about auth");
	});
});
