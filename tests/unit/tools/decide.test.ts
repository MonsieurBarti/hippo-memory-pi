import { describe, expect, test, vi } from "vitest";
import { createDecideTool } from "../../../src/tools/decide";
import { createFakeEntry, createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_decide tool", () => {
	test("forwards input to service.decide", async () => {
		const service = createFakeService();
		const decideMock = vi.mocked(service.decide);
		decideMock.mockResolvedValue(
			createFakeEntry({ id: "dec-1", halfLifeDays: 90, confidence: "verified" }),
		);

		const tool = createDecideTool(service);
		const result = await tool.execute("call-1", {
			decision: "Use Postgres",
			context: "Team familiarity",
		});

		expect(decideMock).toHaveBeenCalledWith({
			decision: "Use Postgres",
			context: "Team familiarity",
		});
		const firstText = result.content[0];
		expect(firstText?.text).toContain("Decision dec-1 recorded");
		expect(firstText?.text).toContain("90d");
		expect(result.details.id).toBe("dec-1");
		expect(result.details.confidence).toBe("verified");
	});

	test("exposes identity fields", () => {
		const tool = createDecideTool(createFakeService());
		expect(tool.name).toBe("tff-memory_decide");
		expect(tool.label).toBe("Decide");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
