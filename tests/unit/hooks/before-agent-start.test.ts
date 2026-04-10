import { describe, expect, test, vi } from "vitest";
import { DEFAULT_CONFIG } from "../../../src/config";
import { createBeforeAgentStartHook } from "../../../src/hooks/before-agent-start";
import { createFakeService } from "../../fixtures/fake-memory-service";

describe("before-agent-start hook", () => {
	test("returns undefined when autoInject is false", async () => {
		const service = createFakeService();
		const contextMock = vi.mocked(service.context);

		const hook = createBeforeAgentStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoInject: false },
			isToggledOff: () => false,
		});

		const result = await hook({ prompt: "refactor auth", systemPrompt: "You are pi." }, {});
		expect(result).toBeUndefined();
		expect(contextMock).not.toHaveBeenCalled();
	});

	test("returns undefined when per-session toggle is off", async () => {
		const service = createFakeService();
		const hook = createBeforeAgentStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoInject: true },
			isToggledOff: () => true,
		});
		const result = await hook({ prompt: "x", systemPrompt: "y" }, {});
		expect(result).toBeUndefined();
	});

	test("returns undefined when context returns no results", async () => {
		const service = createFakeService();
		vi.mocked(service.context).mockResolvedValue({
			ids: [],
			summary: "",
			formattedBlock: "",
			framing: "observe",
			tokensUsed: 0,
		});

		const hook = createBeforeAgentStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoInject: true },
			isToggledOff: () => false,
		});
		const result = await hook({ prompt: "obscure topic", systemPrompt: "You are pi." }, {});
		expect(result).toBeUndefined();
	});

	test("returns an injection when context has results", async () => {
		const service = createFakeService();
		vi.mocked(service.context).mockResolvedValue({
			ids: ["id-1", "id-2"],
			summary: "Retrieved 2 memories (~420 tokens)",
			formattedBlock:
				"## Prior observations (hippo memory, observe framing)\n\n- [2026-03-14, verified, strength 0.82] auth uses argon2id",
			framing: "observe",
			tokensUsed: 420,
		});

		const hook = createBeforeAgentStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoInject: true },
			isToggledOff: () => false,
		});

		const result = await hook({ prompt: "refactor auth", systemPrompt: "You are pi." }, {});

		expect(result).toBeDefined();
		expect(result?.systemPrompt).toContain("You are pi.");
		expect(result?.systemPrompt).toContain("Prior observations");
		expect(result?.message.customType).toBe("hippo-memory-recall");
		expect(result?.message.details.memoryIds).toEqual(["id-1", "id-2"]);
		expect(result?.message.details.query).toBe("refactor auth");
	});

	test("returns undefined when context call throws", async () => {
		const service = createFakeService();
		vi.mocked(service.context).mockRejectedValue(new Error("db offline"));

		const hook = createBeforeAgentStartHook({
			service,
			config: { ...DEFAULT_CONFIG, autoInject: true },
			isToggledOff: () => false,
		});

		const result = await hook({ prompt: "q", systemPrompt: "sys" }, {});
		expect(result).toBeUndefined();
	});
});
