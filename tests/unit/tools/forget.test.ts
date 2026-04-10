import { describe, expect, test, vi } from "vitest";
import { createForgetTool } from "../../../src/tools/forget";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_forget tool", () => {
	test("forwards id to service.forget", async () => {
		const service = createFakeService();
		const forgetMock = vi.mocked(service.forget);

		const tool = createForgetTool(service);
		const result = await tool.execute("call-1", { id: "mem-1" });

		expect(forgetMock).toHaveBeenCalledWith("mem-1");
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Forgot mem-1");
		expect(result.details.id).toBe("mem-1");
	});

	test("exposes identity fields", () => {
		const tool = createForgetTool(createFakeService());
		expect(tool.name).toBe("tff-memory_forget");
		expect(tool.label).toBe("Forget");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
