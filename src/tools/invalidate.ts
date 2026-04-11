import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const InvalidateParams = Type.Object({
	pattern: Type.String(),
	reason: Type.Optional(Type.String()),
});

export type InvalidateInput = Static<typeof InvalidateParams>;

export function createInvalidateTool(
	service: MemoryService,
): ToolDefinition<typeof InvalidateParams> {
	return {
		name: "tff-memory_invalidate",
		readOnly: false,
		label: "Invalidate",
		description:
			"Actively weaken memories matching a pattern (content or tags). Use on migrations (X → Y) — don't wait for decay.",
		promptSnippet: "Weaken memories matching a content/tag substring.",
		promptGuidelines: [
			"Capped at 1000 memories per call.",
			"Pass reason to tag affected memories for auditability.",
		],
		parameters: InvalidateParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const count = await service.invalidate(input.pattern, input.reason);
			return {
				content: [
					{
						type: "text",
						text: `Invalidated ${count} memories matching "${input.pattern}"`,
					},
				],
				details: {
					count,
					pattern: input.pattern,
					reason: input.reason ?? null,
				},
			};
		},
	};
}
