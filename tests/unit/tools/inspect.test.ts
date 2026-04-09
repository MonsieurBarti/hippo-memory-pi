import { describe, expect, test, vi } from "vitest";
import { createInspectTool } from "../../../src/tools/inspect";
import { createFakeEntry, createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_inspect tool", () => {
	test("returns full entry details when found", async () => {
		const service = createFakeService();
		const inspectMock = vi.mocked(service.inspect);
		inspectMock.mockResolvedValue(
			createFakeEntry({ id: "mem-1", strength: 0.73, tags: ["foo", "bar"] }),
		);

		const tool = createInspectTool(service);
		const result = await tool.execute("call-1", { id: "mem-1" });

		expect(inspectMock).toHaveBeenCalledWith("mem-1");
		const firstText = result.content[0];
		expect(firstText?.text).toContain("Entry mem-1");
		expect(firstText?.text).toContain("0.73");
		expect(result.details.found).toBe(true);
		expect(result.details.id).toBe("mem-1");
	});

	test("returns not-found details when entry is null", async () => {
		const service = createFakeService();
		const tool = createInspectTool(service);
		const result = await tool.execute("call-1", { id: "missing" });
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Not found");
		expect(result.details.found).toBe(false);
		expect(result.details.id).toBe("missing");
	});

	test("exposes identity fields", () => {
		const tool = createInspectTool(createFakeService());
		expect(tool.name).toBe("tff-memory_inspect");
		expect(tool.label).toBe("Inspect");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
