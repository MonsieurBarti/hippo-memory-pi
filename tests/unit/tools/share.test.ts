import { describe, expect, test, vi } from "vitest";
import { createShareTool } from "../../../src/tools/share";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_share tool", () => {
	test("shares by id", async () => {
		const service = createFakeService();
		const shareMock = vi.mocked(service.share);
		shareMock.mockResolvedValue({
			promoted: ["mem-1"],
			skipped: [],
			dryRun: false,
		});

		const tool = createShareTool(service);
		const result = await tool.execute("call-1", { id: "mem-1" });

		expect(shareMock).toHaveBeenCalledWith("mem-1", false);
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Promoted 1, skipped 0 (dryRun=false)");
	});

	test("uses auto mode when auto: true", async () => {
		const service = createFakeService();
		const shareMock = vi.mocked(service.share);
		shareMock.mockResolvedValue({
			promoted: ["a", "b"],
			skipped: ["c"],
			dryRun: true,
		});

		const tool = createShareTool(service);
		const result = await tool.execute("call-1", { auto: true, dryRun: true });

		expect(shareMock).toHaveBeenCalledWith("auto", true);
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Promoted 2, skipped 1 (dryRun=true)");
	});

	test("returns error when neither id nor auto is provided", async () => {
		const service = createFakeService();
		const tool = createShareTool(service);
		const result = await tool.execute("call-1", {});
		const firstText = result.content[0];
		expect(firstText?.text).toContain("Provide either id or auto");
		expect(result.details.error).toBe("missing-id-or-auto");
	});

	test("exposes identity fields", () => {
		const tool = createShareTool(createFakeService());
		expect(tool.name).toBe("tff-memory_share");
		expect(tool.label).toBe("Share to Global");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
