import { describe, expect, test, vi } from "vitest";
import { createRememberTool } from "../../../src/tools/remember";
import { createFakeEntry, createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_remember tool", () => {
	test("forwards input to service.remember", async () => {
		const service = createFakeService();
		const rememberMock = vi.mocked(service.remember);
		rememberMock.mockResolvedValue(createFakeEntry({ id: "abc", strength: 0.8, halfLifeDays: 14 }));

		const tool = createRememberTool(service);
		const result = await tool.execute("call-1", { content: "hello", tags: ["foo"] });

		expect(rememberMock).toHaveBeenCalledWith({ content: "hello", tags: ["foo"] });
		const firstText = result.content[0];
		expect(firstText?.text).toContain("Stored abc");
		expect(result.details.id).toBe("abc");
		expect(result.details.strength).toBe(0.8);
	});

	test("exposes the expected name, label, description, prompt hints", () => {
		const tool = createRememberTool(createFakeService());
		expect(tool.name).toBe("tff-memory_remember");
		expect(tool.label).toBe("Remember");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
