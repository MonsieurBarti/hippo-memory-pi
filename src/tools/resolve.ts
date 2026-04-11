import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const ResolveParams = Type.Object({
	conflictId: Type.String(),
	keep: Type.Union([Type.Literal("first"), Type.Literal("second")]),
});

export type ResolveInput = Static<typeof ResolveParams>;

export function createResolveTool(service: MemoryService): ToolDefinition<typeof ResolveParams> {
	return {
		name: "tff-memory_resolve",
		readOnly: false,
		label: "Resolve Conflict",
		description:
			"Resolve a memory conflict by choosing which side to keep. The other side is deleted.",
		promptSnippet: "Resolve a conflict by picking first or second.",
		promptGuidelines: [
			"Inspect both memories with tff-memory_inspect before picking.",
			"v1 only supports first/second — not both/neither.",
		],
		parameters: ResolveParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			await service.resolveConflict(input.conflictId, input.keep);
			return {
				content: [
					{
						type: "text",
						text: `Resolved ${input.conflictId} (keep: ${input.keep})`,
					},
				],
				details: { conflictId: input.conflictId, keep: input.keep },
			};
		},
	};
}
