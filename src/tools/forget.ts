import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const ForgetParams = Type.Object({
	id: Type.String(),
});

export type ForgetInput = Static<typeof ForgetParams>;

export function createForgetTool(service: MemoryService): ToolDefinition<typeof ForgetParams> {
	return {
		name: "tff-memory_forget",
		readOnly: false,
		label: "Forget",
		description: "Hard-delete a memory. Irreversible.",
		promptSnippet: "Hard-delete a memory entry by id.",
		promptGuidelines: [
			"Prefer tff-memory_invalidate for pattern-based weakening.",
			"Use forget only when the memory is wrong, not just stale.",
		],
		parameters: ForgetParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			await service.forget(input.id);
			return {
				content: [{ type: "text", text: `Forgot ${input.id}` }],
				details: { id: input.id },
			};
		},
	};
}
