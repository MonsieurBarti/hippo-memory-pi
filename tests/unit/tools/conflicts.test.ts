import { describe, expect, test, vi } from "vitest";
import { createConflictsTool } from "../../../src/tools/conflicts";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_conflicts tool", () => {
	test("defaults to 'open' status and maps conflicts", async () => {
		const service = createFakeService();
		const listMock = vi.mocked(service.listConflicts);
		listMock.mockResolvedValue([
			{
				id: "c-1",
				first: "mem-a",
				second: "mem-b",
				overlap: 0.7,
				conflictType: "contradiction",
				status: "open",
				detectedAt: "2026-04-01T00:00:00.000Z",
			},
		]);

		const tool = createConflictsTool(service);
		const result = await tool.execute("call-1", {});

		expect(listMock).toHaveBeenCalledWith("open");
		const firstText = result.content[0];
		expect(firstText?.text).toBe("1 conflicts");
		expect(result.details.count).toBe(1);
	});

	test("passes status through when provided", async () => {
		const service = createFakeService();
		const listMock = vi.mocked(service.listConflicts);
		const tool = createConflictsTool(service);
		await tool.execute("call-1", { status: "all" });
		expect(listMock).toHaveBeenCalledWith("all");
	});

	test("exposes identity fields", () => {
		const tool = createConflictsTool(createFakeService());
		expect(tool.name).toBe("tff-memory_conflicts");
		expect(tool.label).toBe("Conflicts");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
