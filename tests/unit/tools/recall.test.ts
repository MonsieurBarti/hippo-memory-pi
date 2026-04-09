import { describe, expect, test, vi } from "vitest";
import { createRecallTool } from "../../../src/tools/recall";
import { createFakeEntry, createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_recall tool", () => {
	test("forwards query and options, formats response", async () => {
		const service = createFakeService();
		const recallMock = vi.mocked(service.recall);
		recallMock.mockResolvedValue({
			query: "needle",
			mode: "hybrid",
			tokensUsed: 42,
			results: [
				{
					entry: createFakeEntry({ id: "hit-1", content: "haystack" }),
					score: 0.9,
					explanation: "matched 'needle'",
				},
			],
		});

		const tool = createRecallTool(service);
		const result = await tool.execute("call-1", {
			query: "needle",
			budget: 500,
			why: true,
			scope: "both",
		});

		expect(recallMock).toHaveBeenCalledWith("needle", {
			budget: 500,
			why: true,
			scope: "both",
		});
		const firstText = result.content[0];
		expect(firstText?.text).toContain("Recalled 1 memories (hybrid)");
		expect(result.details.count).toBe(1);
		expect(result.details.mode).toBe("hybrid");
		expect(result.details.tokensUsed).toBe(42);
	});

	test("exposes identity fields", () => {
		const tool = createRecallTool(createFakeService());
		expect(tool.name).toBe("tff-memory_recall");
		expect(tool.label).toBe("Recall");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
