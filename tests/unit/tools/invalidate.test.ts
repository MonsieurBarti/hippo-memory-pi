import { describe, expect, test, vi } from "vitest";
import { createInvalidateTool } from "../../../src/tools/invalidate";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_invalidate tool", () => {
	test("forwards pattern and reason, returns count", async () => {
		const service = createFakeService();
		const invalidateMock = vi.mocked(service.invalidate);
		invalidateMock.mockResolvedValue(7);

		const tool = createInvalidateTool(service);
		const result = await tool.execute("call-1", {
			pattern: "deprecated-api",
			reason: "migration",
		});

		expect(invalidateMock).toHaveBeenCalledWith("deprecated-api", "migration");
		const firstText = result.content[0];
		expect(firstText?.text).toContain("Invalidated 7");
		expect(result.details.count).toBe(7);
		expect(result.details.reason).toBe("migration");
	});

	test("handles missing reason", async () => {
		const service = createFakeService();
		const tool = createInvalidateTool(service);
		const result = await tool.execute("call-1", { pattern: "foo" });
		expect(result.details.reason).toBeNull();
	});

	test("exposes identity fields", () => {
		const tool = createInvalidateTool(createFakeService());
		expect(tool.name).toBe("tff-memory_invalidate");
		expect(tool.label).toBe("Invalidate");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
