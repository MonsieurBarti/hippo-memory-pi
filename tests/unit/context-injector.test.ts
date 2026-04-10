import { describe, expect, test } from "vitest";
import { buildInjection } from "../../src/context-injector";
import type { ContextResult } from "../../src/types";

function fakeContext(overrides: Partial<ContextResult> = {}): ContextResult {
	return {
		ids: ["id-1", "id-2"],
		summary: "Retrieved 2 memories (~420 tokens)",
		formattedBlock:
			"## Prior observations (hippo memory, observe framing)\n\n- [2026-03-14, verified, strength 0.82] auth uses argon2id",
		framing: "observe",
		tokensUsed: 420,
		...overrides,
	};
}

describe("buildInjection", () => {
	test("returns undefined when no memories", () => {
		const empty = fakeContext({ ids: [], summary: "", formattedBlock: "", tokensUsed: 0 });
		expect(buildInjection(empty, "original prompt", "original system")).toBeUndefined();
	});

	test("returns undefined when formattedBlock is empty even with ids (defensive)", () => {
		const weird = fakeContext({ ids: ["id-1"], formattedBlock: "" });
		expect(buildInjection(weird, "prompt", "system")).toBeUndefined();
	});

	test("appends formatted block to system prompt", () => {
		const ctx = fakeContext();
		const result = buildInjection(ctx, "refactor auth", "You are pi.");
		expect(result?.systemPrompt).toContain("You are pi.");
		expect(result?.systemPrompt).toContain("Prior observations");
		expect(result?.systemPrompt).toContain("argon2id");
	});

	test("creates a custom message with memory ids in details", () => {
		const ctx = fakeContext();
		const result = buildInjection(ctx, "refactor auth", "You are pi.");
		expect(result?.message.customType).toBe("hippo-memory-recall");
		expect(result?.message.display).toBe(true);
		expect(result?.message.details.memoryIds).toEqual(["id-1", "id-2"]);
		expect(result?.message.details.query).toBe("refactor auth");
		expect(result?.message.details.framing).toBe("observe");
		expect(result?.message.details.budgetUsed).toBe(420);
	});

	test("separates block from system prompt with a double newline", () => {
		const ctx = fakeContext();
		const result = buildInjection(ctx, "q", "system prompt here");
		expect(result?.systemPrompt).toBe(`system prompt here\n\n${ctx.formattedBlock}`);
	});
});
