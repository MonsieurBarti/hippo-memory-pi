import { describe, expect, test, vi } from "vitest";
import { createWmReadTool } from "../../../src/tools/wm-read";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_wm_read tool", () => {
	test("returns items for scope", async () => {
		const service = createFakeService();
		const readMock = vi.mocked(service.wmRead);
		readMock.mockResolvedValue([
			{ scope: "task-1", content: "a", importance: 2 },
			{ scope: "task-1", content: "b" },
		]);

		const tool = createWmReadTool(service);
		const result = await tool.execute("call-1", { scope: "task-1" });

		expect(readMock).toHaveBeenCalledWith("task-1");
		const firstText = result.content[0];
		expect(firstText?.text).toBe("2 items in wm[task-1]");
		expect(result.details.count).toBe(2);
	});

	test("exposes identity fields", () => {
		const tool = createWmReadTool(createFakeService());
		expect(tool.name).toBe("tff-memory_wm_read");
		expect(tool.label).toBe("Working Memory Read");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
