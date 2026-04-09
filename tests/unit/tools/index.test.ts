import { describe, expect, test } from "vitest";
import { createAllTools } from "../../../src/tools";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("createAllTools", () => {
	test("returns all 17 tools with tff-memory_ prefix", () => {
		const tools = createAllTools(createFakeService());
		expect(tools).toHaveLength(17);
		for (const tool of tools) {
			expect(tool.name).toMatch(/^tff-memory_/);
		}
	});

	test("each tool name is unique", () => {
		const tools = createAllTools(createFakeService());
		const names = new Set(tools.map((t) => t.name));
		expect(names.size).toBe(17);
	});

	test("every tool exposes the structural ToolDefinition shape", () => {
		const tools = createAllTools(createFakeService());
		for (const tool of tools) {
			expect(typeof tool.name).toBe("string");
			expect(typeof tool.label).toBe("string");
			expect(typeof tool.description).toBe("string");
			expect(typeof tool.promptSnippet).toBe("string");
			expect(Array.isArray(tool.promptGuidelines)).toBe(true);
			expect(tool.parameters).toBeDefined();
			expect(typeof tool.execute).toBe("function");
		}
	});
});
