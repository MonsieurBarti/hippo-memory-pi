import { describe, expect, test, vi } from "vitest";
import { createContextTool } from "../../../src/tools/context";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_context tool", () => {
	test("returns summary when context has ids", async () => {
		const service = createFakeService();
		const contextMock = vi.mocked(service.context);
		contextMock.mockResolvedValue({
			ids: ["m-1", "m-2"],
			summary: "Two memories",
			formattedBlock: "## Memory context\n- a\n- b",
			framing: "suggest",
			tokensUsed: 33,
		});

		const tool = createContextTool(service);
		const result = await tool.execute("call-1", { query: "q", framing: "suggest" });

		expect(contextMock).toHaveBeenCalledWith({ query: "q", framing: "suggest" });
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Two memories");
		expect(result.details.framing).toBe("suggest");
		expect(result.details.tokensUsed).toBe(33);
	});

	test("shows 'No relevant memories' when empty", async () => {
		const service = createFakeService();
		const tool = createContextTool(service);
		const result = await tool.execute("call-1", {});
		const firstText = result.content[0];
		expect(firstText?.text).toBe("No relevant memories");
	});

	test("exposes identity fields", () => {
		const tool = createContextTool(createFakeService());
		expect(tool.name).toBe("tff-memory_context");
		expect(tool.label).toBe("Memory Context");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
