import { describe, expect, test, vi } from "vitest";
import { createPinTool } from "../../../src/tools/pin";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_pin tool", () => {
	test("pins a memory", async () => {
		const service = createFakeService();
		const pinMock = vi.mocked(service.pin);

		const tool = createPinTool(service);
		const result = await tool.execute("call-1", { id: "mem-1", pinned: true });

		expect(pinMock).toHaveBeenCalledWith("mem-1", true);
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Pinned mem-1");
		expect(result.details.id).toBe("mem-1");
		expect(result.details.pinned).toBe(true);
	});

	test("unpins a memory", async () => {
		const service = createFakeService();
		const tool = createPinTool(service);
		const result = await tool.execute("call-1", { id: "mem-2", pinned: false });
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Unpinned mem-2");
	});

	test("exposes identity fields", () => {
		const tool = createPinTool(createFakeService());
		expect(tool.name).toBe("tff-memory_pin");
		expect(tool.label).toBe("Pin");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
