import { describe, expect, test, vi } from "vitest";
import { createOutcomeTool } from "../../../src/tools/outcome";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_outcome tool", () => {
	test("forwards id and result to service.outcome", async () => {
		const service = createFakeService();
		const outcomeMock = vi.mocked(service.outcome);

		const tool = createOutcomeTool(service);
		const result = await tool.execute("call-1", { id: "mem-1", result: "good" });

		expect(outcomeMock).toHaveBeenCalledWith("mem-1", "good");
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Outcome good applied to mem-1");
		expect(result.details.id).toBe("mem-1");
		expect(result.details.result).toBe("good");
	});

	test("exposes identity fields", () => {
		const tool = createOutcomeTool(createFakeService());
		expect(tool.name).toBe("tff-memory_outcome");
		expect(tool.label).toBe("Outcome");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
