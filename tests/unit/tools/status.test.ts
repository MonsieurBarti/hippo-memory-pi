import { describe, expect, test, vi } from "vitest";
import { createStatusTool } from "../../../src/tools/status";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_status tool", () => {
	test("returns formatted stats", async () => {
		const service = createFakeService();
		const statusMock = vi.mocked(service.status);
		statusMock.mockResolvedValue({
			projectTotal: 12,
			globalTotal: 3,
			episodic: 5,
			semantic: 6,
			buffer: 1,
			averageStrength: 0.42,
			newSinceLastSleep: 2,
			lastSleepAt: "2026-04-08T00:00:00.000Z",
			searchMode: "hybrid",
		});

		const tool = createStatusTool(service);
		const result = await tool.execute("call-1", {});

		const firstText = result.content[0];
		expect(firstText?.text).toContain("Project: 12");
		expect(firstText?.text).toContain("global: 3");
		expect(firstText?.text).toContain("avg strength 0.42");
		expect(result.details.projectTotal).toBe(12);
		expect(result.details.searchMode).toBe("hybrid");
	});

	test("exposes identity fields", () => {
		const tool = createStatusTool(createFakeService());
		expect(tool.name).toBe("tff-memory_status");
		expect(tool.label).toBe("Memory Status");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
