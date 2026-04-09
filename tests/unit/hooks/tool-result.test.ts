import { describe, expect, test, vi } from "vitest";
import { DEFAULT_CONFIG } from "../../../src/config";
import { ErrorCapture, type ToolResultLike } from "../../../src/error-capture";
import { createToolResultHook } from "../../../src/hooks/tool-result";
import { createFakeService } from "../../fixtures/fake-memory-service";

function errorEvent(): ToolResultLike {
	return {
		toolName: "bash",
		content: [{ type: "text", text: "Error: TypeError in auth.spec.ts" }],
		details: { exitCode: 1 },
		isError: true,
	};
}

describe("tool-result hook", () => {
	test("captures errors into memory with the right tags", async () => {
		const service = createFakeService();
		const captureMock = vi.mocked(service.captureError);

		const hook = createToolResultHook({
			service,
			config: { ...DEFAULT_CONFIG, autoCapture: true },
			errorCapture: new ErrorCapture({ debounceMs: 0 }),
		});

		await hook(errorEvent(), {});
		expect(captureMock).toHaveBeenCalledWith({
			content: expect.stringContaining("TypeError"),
			tags: ["error", "auto", "tool:bash"],
			source: "auto:tool_result:bash",
		});
	});

	test("skips when autoCapture is false", async () => {
		const service = createFakeService();
		const captureMock = vi.mocked(service.captureError);

		const hook = createToolResultHook({
			service,
			config: { ...DEFAULT_CONFIG, autoCapture: false },
			errorCapture: new ErrorCapture({ debounceMs: 0 }),
		});

		await hook(errorEvent(), {});
		expect(captureMock).not.toHaveBeenCalled();
	});

	test("skips memory tools (no feedback loops)", async () => {
		const service = createFakeService();
		const captureMock = vi.mocked(service.captureError);
		const hook = createToolResultHook({
			service,
			config: { ...DEFAULT_CONFIG, autoCapture: true },
			errorCapture: new ErrorCapture({ debounceMs: 0 }),
		});
		await hook(
			{
				toolName: "tff-memory_remember",
				content: [{ type: "text", text: "Error: inner failure" }],
				details: {},
				isError: true,
			},
			{},
		);
		expect(captureMock).not.toHaveBeenCalled();
	});

	test("swallows captureError failures", async () => {
		const service = createFakeService();
		vi.mocked(service.captureError).mockRejectedValue(new Error("db offline"));

		const hook = createToolResultHook({
			service,
			config: { ...DEFAULT_CONFIG, autoCapture: true },
			errorCapture: new ErrorCapture({ debounceMs: 0 }),
		});

		await expect(hook(errorEvent(), {})).resolves.not.toThrow();
	});

	test("does not capture benign results", async () => {
		const service = createFakeService();
		const captureMock = vi.mocked(service.captureError);
		const hook = createToolResultHook({
			service,
			config: { ...DEFAULT_CONFIG, autoCapture: true },
			errorCapture: new ErrorCapture({ debounceMs: 0 }),
		});

		await hook(
			{
				toolName: "bash",
				content: [{ type: "text", text: "all good" }],
				details: { exitCode: 0 },
				isError: false,
			},
			{},
		);
		expect(captureMock).not.toHaveBeenCalled();
	});
});
