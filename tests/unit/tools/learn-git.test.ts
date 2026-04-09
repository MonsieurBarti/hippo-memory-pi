import { describe, expect, test, vi } from "vitest";
import { createLearnGitTool } from "../../../src/tools/learn-git";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("tff-memory_learn_git tool", () => {
	test("forwards options and formats summary", async () => {
		const service = createFakeService();
		const learnMock = vi.mocked(service.learnFromGit);
		learnMock.mockResolvedValue({ scanned: 40, added: 5, skipped: 2 });

		const tool = createLearnGitTool(service);
		const result = await tool.execute("call-1", { days: 14, repos: ["./"] });

		expect(learnMock).toHaveBeenCalledWith({ days: 14, repos: ["./"] });
		const firstText = result.content[0];
		expect(firstText?.text).toBe("Scanned 40 commits, added 5 lessons");
		expect(result.details.scanned).toBe(40);
		expect(result.details.added).toBe(5);
		expect(result.details.skipped).toBe(2);
	});

	test("exposes identity fields", () => {
		const tool = createLearnGitTool(createFakeService());
		expect(tool.name).toBe("tff-memory_learn_git");
		expect(tool.label).toBe("Learn From Git");
		expect(tool.description).toBeTruthy();
		expect(tool.promptSnippet).toBeTruthy();
		expect(tool.promptGuidelines.length).toBeGreaterThan(0);
	});
});
