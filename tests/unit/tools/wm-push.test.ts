import { describe, expect, test, vi } from "vitest";
import { createWmPushTool } from "../../../src/tools/wm-push";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_wm_push tool", () => {
	test("forwards item to service.wmPush", async () => {
		const service = createFakeService();
		const pushMock = vi.mocked(service.wmPush);

		const tool = createWmPushTool(service);
		const result = await tool.execute("call-1", {
			scope: "task-1",
			content: "next step",
			importance: 3,
		});

		expect(pushMock).toHaveBeenCalledWith({
			scope: "task-1",
			content: "next step",
			importance: 3,
		});
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Pushed to wm[task-1]");
		expect(result.details.scope).toBe("task-1");
	});

	test("omits importance when not provided", async () => {
		const service = createFakeService();
		const pushMock = vi.mocked(service.wmPush);
		const tool = createWmPushTool(service);
		await tool.execute("call-1", { scope: "s", content: "c" });
		expect(pushMock).toHaveBeenCalledWith({ scope: "s", content: "c" });
	});

	test("exposes identity fields", () => {
		const tool = createWmPushTool(createFakeService());
		expect(tool.name).toBe("tff-memory_wm_push");
		expect(tool.label).toBe("Working Memory Push");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
