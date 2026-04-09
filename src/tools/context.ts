import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ContextOptions } from "../types";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const ContextParams = Type.Object({
	query: Type.Optional(Type.String()),
	budget: Type.Optional(Type.Number()),
	framing: Type.Optional(
		Type.Union([Type.Literal("observe"), Type.Literal("suggest"), Type.Literal("assert")]),
	),
});

export type ContextInput = Static<typeof ContextParams>;

export function createContextTool(service: MemoryService): ToolDefinition<typeof ContextParams> {
	return {
		name: "tff-memory_context",
		label: "Memory Context",
		description:
			"Return formatted memory context (observe/suggest/assert framing) for the current query.",
		promptSnippet: "Get a formatted block of prior memories for the current query.",
		promptGuidelines: [
			"Use when the automatic before_agent_start injection did not run and you want memory context explicitly.",
			"Default framing is 'observe' — memories are presented as observations, not instructions.",
		],
		parameters: ContextParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const opts: ContextOptions = {};
			if (input.query !== undefined) opts.query = input.query;
			if (input.budget !== undefined) opts.budget = input.budget;
			if (input.framing !== undefined) opts.framing = input.framing;
			const ctx = await service.context(opts);
			return {
				content: [
					{
						type: "text",
						text: ctx.ids.length === 0 ? "No relevant memories" : ctx.summary,
					},
				],
				details: {
					ids: ctx.ids,
					framing: ctx.framing,
					tokensUsed: ctx.tokensUsed,
					block: ctx.formattedBlock,
				},
			};
		},
	};
}
