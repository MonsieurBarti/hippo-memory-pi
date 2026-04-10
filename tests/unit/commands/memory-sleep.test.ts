import { describe, expect, test, vi } from "vitest";
import { createMemorySleepCommand } from "../../../src/commands/memory-sleep";
import { createFakeCommandContext } from "../../fixtures/fake-command-context";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("/memory-sleep command", () => {
	test("runs a real sleep by default", async () => {
		const service = createFakeService();
		const sleepMock = vi.mocked(service.sleep);
		sleepMock.mockResolvedValue({
			decayed: 3,
			merged: 1,
			conflicts: 0,
			promoted: 2,
			durationMs: 17,
		});

		const cmd = createMemorySleepCommand(service);
		const ctx = createFakeCommandContext();
		await cmd.handler("", ctx);

		expect(sleepMock).toHaveBeenCalledWith({ dryRun: false });
		const last = ctx.notifications.at(-1);
		expect(last?.message).toContain("💤 Sleep");
		expect(last?.message).toContain("decayed=3");
		expect(last?.message).toContain("merged=1");
		expect(last?.message).toContain("promoted=2");
	});

	test("parses --dry-run flag from args", async () => {
		const service = createFakeService();
		const sleepMock = vi.mocked(service.sleep);
		const cmd = createMemorySleepCommand(service);
		const ctx = createFakeCommandContext();

		await cmd.handler("--dry-run", ctx);
		expect(sleepMock).toHaveBeenCalledWith({ dryRun: true });
		expect(ctx.notifications.at(-1)?.message).toContain("dry-run");
	});
});
