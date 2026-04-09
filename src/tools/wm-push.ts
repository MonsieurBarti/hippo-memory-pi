import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { WorkingMemoryItem } from "../types";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const WmPushParams = Type.Object({
	scope: Type.String(),
	content: Type.String(),
	importance: Type.Optional(Type.Number({ minimum: 1, maximum: 5 })),
});

export type WmPushInput = Static<typeof WmPushParams>;

export function createWmPushTool(service: MemoryService): ToolDefinition<typeof WmPushParams> {
	return {
		name: "tff-memory_wm_push",
		label: "Working Memory Push",
		description:
			"Push to bounded working memory (session scratchpad). Max 20 per scope, importance-evicted, no decay.",
		promptSnippet: "Push an ephemeral note into working memory.",
		promptGuidelines: [
			"Use for ephemeral task state (current step, next action).",
			"Not persisted across sessions by default.",
		],
		parameters: WmPushParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const item: WorkingMemoryItem = {
				scope: input.scope,
				content: input.content,
			};
			if (input.importance !== undefined) item.importance = input.importance;
			await service.wmPush(item);
			return {
				content: [{ type: "text", text: `Pushed to wm[${input.scope}]` }],
				details: { scope: input.scope },
			};
		},
	};
}
