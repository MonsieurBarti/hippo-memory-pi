import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const WmReadParams = Type.Object({
	scope: Type.String(),
});

export type WmReadInput = Static<typeof WmReadParams>;

export function createWmReadTool(service: MemoryService): ToolDefinition<typeof WmReadParams> {
	return {
		name: "tff-memory_wm_read",
		label: "Working Memory Read",
		description: "Read working memory items for a scope.",
		promptSnippet: "Read all working-memory items in a scope.",
		promptGuidelines: ["Scopes are free-form (e.g., task id, file path)."],
		parameters: WmReadParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const items = await service.wmRead(input.scope);
			return {
				content: [
					{
						type: "text",
						text: `${items.length} items in wm[${input.scope}]`,
					},
				],
				details: {
					scope: input.scope,
					count: items.length,
					items: items.map((i) => ({
						scope: i.scope,
						content: i.content,
						importance: i.importance ?? null,
					})),
				},
			};
		},
	};
}
