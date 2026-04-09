import { describe, expect, test, vi } from "vitest";
import { createMemoryStatusCommand } from "../../../src/commands/memory-status";
import { createFakeCommandContext } from "../../fixtures/fake-command-context";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("/memory-status command", () => {
	test("prints the store stats via notify", async () => {
		const service = createFakeService();
		vi.mocked(service.status).mockResolvedValue({
			projectTotal: 12,
			globalTotal: 3,
			episodic: 9,
			semantic: 2,
			buffer: 1,
			averageStrength: 0.64,
			newSinceLastSleep: 4,
			lastSleepAt: null,
			searchMode: "hybrid",
		});
		const cmd = createMemoryStatusCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("", ctx);
		const last = ctx.notifications.at(-1);
		expect(last?.level).toBe("info");
		expect(last?.message).toContain("Project: 12");
		expect(last?.message).toContain("avg strength 0.64");
		expect(last?.message).toContain("new since sleep 4");
	});

	test("exposes name + description", () => {
		const cmd = createMemoryStatusCommand(createFakeService());
		expect(cmd.name).toBe("memory-status");
		expect(cmd.description).toBeTruthy();
	});
});
