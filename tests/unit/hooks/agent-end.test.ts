import { describe, expect, test, vi } from "vitest";
import { DEFAULT_CONFIG } from "../../../src/config";
import { createAgentEndHook } from "../../../src/hooks/agent-end";
import { SuccessDetector, type ToolResultSummary } from "../../../src/success-detector";
import { createFakeService } from "../../fixtures/fake-memory-service";

function makeDeps(options: {
	anchors?: readonly string[];
	recent?: readonly ToolResultSummary[];
	autoOutcome?: boolean;
}) {
	const service = createFakeService();
	const detector = new SuccessDetector();
	const hook = createAgentEndHook({
		service,
		config: { ...DEFAULT_CONFIG, autoOutcome: options.autoOutcome ?? true },
		successDetector: detector,
		getAnchorIds: () => options.anchors ?? [],
		getRecentToolResults: () => options.recent ?? [],
	});
	return { service, hook };
}

describe("agent-end hook", () => {
	test("applies good outcome on clean finish", async () => {
		const { service, hook } = makeDeps({
			anchors: ["m1", "m2"],
			recent: [{ isError: false }, { isError: false }],
		});
		await hook({ stopReason: "stop" }, {});
		const outcome = vi.mocked(service.outcome);
		expect(outcome).toHaveBeenCalledWith("m1", "good");
		expect(outcome).toHaveBeenCalledWith("m2", "good");
	});

	test("applies bad outcome on stopReason=error", async () => {
		const { service, hook } = makeDeps({ anchors: ["m1"], recent: [] });
		await hook({ stopReason: "error" }, {});
		expect(vi.mocked(service.outcome)).toHaveBeenCalledWith("m1", "bad");
	});

	test("does nothing when assessment is ambiguous", async () => {
		const { service, hook } = makeDeps({ anchors: ["m1"], recent: [] });
		await hook({ stopReason: "length" }, {});
		expect(vi.mocked(service.outcome)).not.toHaveBeenCalled();
	});

	test("skips entirely when autoOutcome is off", async () => {
		const { service, hook } = makeDeps({
			anchors: ["m1"],
			recent: [],
			autoOutcome: false,
		});
		await hook({ stopReason: "stop" }, {});
		expect(vi.mocked(service.outcome)).not.toHaveBeenCalled();
	});

	test("swallows per-id outcome errors and continues with next id", async () => {
		const service = createFakeService();
		const outcomeMock = vi.mocked(service.outcome);
		outcomeMock.mockImplementation(async (id: string) => {
			if (id === "m1") throw new Error("lost row");
		});
		const hook = createAgentEndHook({
			service,
			config: { ...DEFAULT_CONFIG, autoOutcome: true },
			successDetector: new SuccessDetector(),
			getAnchorIds: () => ["m1", "m2", "m3"],
			getRecentToolResults: () => [],
		});

		await expect(hook({ stopReason: "stop" }, {})).resolves.not.toThrow();
		expect(outcomeMock).toHaveBeenCalledTimes(3);
	});
});
