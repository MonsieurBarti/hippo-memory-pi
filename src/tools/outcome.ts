import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const OutcomeParams = Type.Object({
	id: Type.String(),
	result: Type.Union([Type.Literal("good"), Type.Literal("bad")]),
});

export type OutcomeInput = Static<typeof OutcomeParams>;

export function createOutcomeTool(service: MemoryService): ToolDefinition<typeof OutcomeParams> {
	return {
		name: "tff-memory_outcome",
		label: "Outcome",
		description:
			"Apply reward signal to a memory (good/bad). Updates effective half-life via hippo's reward propagation.",
		promptSnippet: "Report whether a memory helped or misled.",
		promptGuidelines: [
			"Call after a task that used a recalled memory succeeded (good) or failed (bad).",
			"Anchor ids live in the hippo-memory-recall custom message's details.memoryIds.",
		],
		parameters: OutcomeParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			await service.outcome(input.id, input.result);
			return {
				content: [
					{
						type: "text",
						text: `Outcome ${input.result} applied to ${input.id}`,
					},
				],
				details: { id: input.id, result: input.result },
			};
		},
	};
}
