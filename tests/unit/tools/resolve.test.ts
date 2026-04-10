import { describe, expect, test, vi } from "vitest";
import { createResolveTool } from "../../../src/tools/resolve";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_resolve tool", () => {
	test("forwards conflictId and keep choice", async () => {
		const service = createFakeService();
		const resolveMock = vi.mocked(service.resolveConflict);

		const tool = createResolveTool(service);
		const result = await tool.execute("call-1", { conflictId: "c-1", keep: "first" });

		expect(resolveMock).toHaveBeenCalledWith("c-1", "first");
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Resolved c-1 (keep: first)");
		expect(result.details.conflictId).toBe("c-1");
		expect(result.details.keep).toBe("first");
	});

	test("exposes identity fields", () => {
		const tool = createResolveTool(createFakeService());
		expect(tool.name).toBe("tff-memory_resolve");
		expect(tool.label).toBe("Resolve Conflict");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
