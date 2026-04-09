import { describe, expect, test } from "vitest";
import { createSessionState } from "../../src/session-state";

describe("createSessionState", () => {
	test("anchor ids round-trip", () => {
		const state = createSessionState();
		expect(state.getAnchorIds()).toEqual([]);
		state.setAnchorIds(["m1", "m2"]);
		expect(state.getAnchorIds()).toEqual(["m1", "m2"]);
	});

	test("setAnchorIds takes a defensive copy so callers cannot mutate state", () => {
		const state = createSessionState();
		const input = ["m1", "m2"];
		state.setAnchorIds(input);
		input.push("m3");
		expect(state.getAnchorIds()).toEqual(["m1", "m2"]);
	});

	test("clearAnchorIds resets to empty", () => {
		const state = createSessionState();
		state.setAnchorIds(["a"]);
		state.clearAnchorIds();
		expect(state.getAnchorIds()).toEqual([]);
	});

	test("recent tool results ring buffer keeps the last N", () => {
		const state = createSessionState({ ringSize: 3 });
		state.recordToolResult({ isError: false });
		state.recordToolResult({ isError: true });
		state.recordToolResult({ isError: false });
		state.recordToolResult({ isError: false });
		const recent = state.getRecentToolResults();
		expect(recent).toHaveLength(3);
		expect(recent.map((r) => r.isError)).toEqual([true, false, false]);
	});

	test("default ring size is 10", () => {
		const state = createSessionState();
		for (let i = 0; i < 15; i++) {
			state.recordToolResult({ isError: i === 0 });
		}
		expect(state.getRecentToolResults()).toHaveLength(10);
	});
});
