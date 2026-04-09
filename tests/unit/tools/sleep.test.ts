import { describe, expect, test, vi } from "vitest";
import { createSleepTool } from "../../../src/tools/sleep";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_sleep tool", () => {
	test("forwards dryRun and formats summary", async () => {
		const service = createFakeService();
		const sleepMock = vi.mocked(service.sleep);
		sleepMock.mockResolvedValue({
			decayed: 2,
			merged: 1,
			conflicts: 0,
			promoted: 3,
			durationMs: 124,
		});

		const tool = createSleepTool(service);
		const result = await tool.execute("call-1", { dryRun: true });

		expect(sleepMock).toHaveBeenCalledWith({ dryRun: true });
		const firstText = result.content[0];
		expect(firstText?.text).toContain("decayed=2");
		expect(firstText?.text).toContain("merged=1");
		expect(firstText?.text).toContain("124ms");
		expect(result.details.decayed).toBe(2);
		expect(result.details.promoted).toBe(3);
	});

	test("exposes identity fields", () => {
		const tool = createSleepTool(createFakeService());
		expect(tool.name).toBe("tff-memory_sleep");
		expect(tool.label).toBe("Sleep");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
