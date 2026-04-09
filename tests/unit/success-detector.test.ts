import { describe, expect, test } from "vitest";
import { SuccessDetector } from "../../src/success-detector";

describe("SuccessDetector.assess", () => {
	const detector = new SuccessDetector();

	test("stopReason=stop with clean tool results → good", () => {
		expect(
			detector.assess({
				stopReason: "stop",
				recentToolResults: [{ isError: false }, { isError: false }, { isError: false }],
			}),
		).toBe("good");
	});

	test("stopReason=stop with no tool results → good", () => {
		expect(detector.assess({ stopReason: "stop", recentToolResults: [] })).toBe("good");
	});

	test("stopReason=error → bad", () => {
		expect(detector.assess({ stopReason: "error", recentToolResults: [] })).toBe("bad");
	});

	test("stopReason=aborted → bad", () => {
		expect(detector.assess({ stopReason: "aborted", recentToolResults: [] })).toBe("bad");
	});

	test("stopReason=stop with a recent error → bad", () => {
		expect(
			detector.assess({
				stopReason: "stop",
				recentToolResults: [{ isError: false }, { isError: true }, { isError: false }],
			}),
		).toBe("bad");
	});

	test("stopReason=stop only looks at last 3 tool results", () => {
		expect(
			detector.assess({
				stopReason: "stop",
				recentToolResults: [
					{ isError: true }, // older, ignored
					{ isError: false },
					{ isError: false },
					{ isError: false },
				],
			}),
		).toBe("good");
	});

	test("stopReason=length → ambiguous", () => {
		expect(detector.assess({ stopReason: "length", recentToolResults: [] })).toBe("ambiguous");
	});

	test("stopReason=toolUse → ambiguous", () => {
		expect(detector.assess({ stopReason: "toolUse", recentToolResults: [] })).toBe("ambiguous");
	});

	test("unknown stopReason → ambiguous", () => {
		expect(detector.assess({ stopReason: "foo-bar", recentToolResults: [] })).toBe("ambiguous");
	});
});
