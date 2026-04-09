import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { DecideInput as DecideServiceInput } from "../types";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const DecideParams = Type.Object({
	decision: Type.String(),
	context: Type.Optional(Type.String()),
	supersedes: Type.Optional(Type.String()),
});

export type DecideInput = Static<typeof DecideParams>;

export function createDecideTool(service: MemoryService): ToolDefinition<typeof DecideParams> {
	return {
		name: "tff-memory_decide",
		label: "Decide",
		description:
			"Record an architectural decision. 90-day base half-life, verified confidence. Use for long-term choices, not ephemeral workarounds.",
		promptSnippet: "Record a long-lived architectural decision.",
		promptGuidelines: [
			"Pair with context explaining *why* the decision was made.",
			"Pass supersedes with the id of the decision this one replaces.",
		],
		parameters: DecideParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const payload: DecideServiceInput = { decision: input.decision };
			if (input.context !== undefined) payload.context = input.context;
			if (input.supersedes !== undefined) payload.supersedes = input.supersedes;
			const entry = await service.decide(payload);
			return {
				content: [
					{
						type: "text",
						text: `Decision ${entry.id} recorded (half-life ${entry.halfLifeDays}d, ${entry.confidence})`,
					},
				],
				details: {
					id: entry.id,
					halfLifeDays: entry.halfLifeDays,
					confidence: entry.confidence,
				},
			};
		},
	};
}
