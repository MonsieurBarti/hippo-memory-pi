import { beforeEach, describe, expect, test } from "vitest";
import { ErrorCapture, type ToolResultLike } from "../../src/error-capture";

function fakeEvent(over: Partial<ToolResultLike> = {}): ToolResultLike {
	return {
		toolName: "bash",
		content: [{ type: "text", text: "Error: auth.spec.ts failed with TypeError" }],
		details: { exitCode: 1 },
		isError: true,
		...over,
	};
}

describe("ErrorCapture.detect", () => {
	let capture: ErrorCapture;

	beforeEach(() => {
		capture = new ErrorCapture({ debounceMs: 60_000 });
	});

	test("detects isError=true events", () => {
		expect(capture.detect(fakeEvent())).toBe(true);
	});

	test("detects content-based error signals when isError is absent", () => {
		const e = fakeEvent({
			isError: false,
			content: [{ type: "text", text: "Traceback (most recent call last):" }],
			details: {},
		});
		expect(capture.detect(e)).toBe(true);
	});

	test("detects non-zero exitCode in details", () => {
		const e = fakeEvent({
			isError: false,
			content: [{ type: "text", text: "ok" }],
			details: { exitCode: 1 },
		});
		expect(capture.detect(e)).toBe(true);
	});

	test("detects non-empty stderr in details", () => {
		const e = fakeEvent({
			isError: false,
			content: [{ type: "text", text: "ran" }],
			details: { stderr: "warning: deprecated flag" },
		});
		expect(capture.detect(e)).toBe(true);
	});

	test("ignores zero exitCode", () => {
		const e = fakeEvent({
			isError: false,
			content: [{ type: "text", text: "ok" }],
			details: { exitCode: 0 },
		});
		expect(capture.detect(e)).toBe(false);
	});

	test("skips memory tools to avoid feedback loops", () => {
		const e = fakeEvent({ toolName: "tff-memory_remember" });
		expect(capture.detect(e)).toBe(false);
	});

	test("returns false for benign output", () => {
		const e = fakeEvent({
			isError: false,
			content: [{ type: "text", text: "hello world" }],
			details: {},
		});
		expect(capture.detect(e)).toBe(false);
	});
});

describe("ErrorCapture.extractSummary", () => {
	const capture = new ErrorCapture();

	test("returns first error-line trimmed to max length", () => {
		const e: ToolResultLike = {
			toolName: "bash",
			content: [
				{
					type: "text",
					text: "Line 1 noise\nError: auth.spec.ts failed with TypeError: undefined is not a function\nSubsequent stack frames",
				},
			],
			details: {},
			isError: true,
		};
		const summary = capture.extractSummary(e, 60);
		expect(summary).toContain("TypeError");
		expect(summary.length).toBeLessThanOrEqual(60);
	});

	test("returns first non-empty line when no pattern matches", () => {
		const e: ToolResultLike = {
			toolName: "bash",
			content: [{ type: "text", text: "\n   some content here   \nmore" }],
			details: {},
		};
		const summary = capture.extractSummary(e, 200);
		expect(summary).toBe("some content here");
	});

	test("returns empty string when content is empty", () => {
		const e: ToolResultLike = { toolName: "bash", content: [], details: {} };
		expect(capture.extractSummary(e, 200)).toBe("");
	});

	test("truncates with an ellipsis when over max length", () => {
		const longText = `Error: ${"x".repeat(200)}`;
		const e: ToolResultLike = {
			toolName: "bash",
			content: [{ type: "text", text: longText }],
			details: {},
			isError: true,
		};
		const summary = capture.extractSummary(e, 50);
		expect(summary.length).toBeLessThanOrEqual(50);
		expect(summary.endsWith("…")).toBe(true);
	});
});

describe("ErrorCapture.shouldCapture (debouncing)", () => {
	test("returns true the first time, false on repeat within window", () => {
		const capture = new ErrorCapture({ debounceMs: 60_000 });
		const e: ToolResultLike = {
			toolName: "bash",
			content: [{ type: "text", text: "Error: same signature" }],
			details: {},
			isError: true,
		};
		expect(capture.shouldCapture(e)).toBe(true);
		expect(capture.shouldCapture(e)).toBe(false);
	});

	test("allows a different error signature through", () => {
		const capture = new ErrorCapture({ debounceMs: 60_000 });
		const a: ToolResultLike = {
			toolName: "bash",
			content: [{ type: "text", text: "Error: first thing" }],
			details: {},
			isError: true,
		};
		const b: ToolResultLike = {
			toolName: "bash",
			content: [{ type: "text", text: "Error: second thing" }],
			details: {},
			isError: true,
		};
		expect(capture.shouldCapture(a)).toBe(true);
		expect(capture.shouldCapture(b)).toBe(true);
	});

	test("skips non-error events via detect() filter", () => {
		const capture = new ErrorCapture({ debounceMs: 60_000 });
		const benign: ToolResultLike = {
			toolName: "bash",
			content: [{ type: "text", text: "ok" }],
			details: { exitCode: 0 },
			isError: false,
		};
		expect(capture.shouldCapture(benign)).toBe(false);
	});
});
