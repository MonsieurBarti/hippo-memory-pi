import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { RecallOptions } from "../types";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const RecallParams = Type.Object({
	query: Type.String({ description: "Search query" }),
	budget: Type.Optional(Type.Number({ description: "Token budget" })),
	limit: Type.Optional(Type.Number({ description: "Max results" })),
	why: Type.Optional(Type.Boolean({ description: "Include match explanations" })),
	scope: Type.Optional(
		Type.Union([Type.Literal("project"), Type.Literal("global"), Type.Literal("both")]),
	),
});

export type RecallInput = Static<typeof RecallParams>;

export function createRecallTool(service: MemoryService): ToolDefinition<typeof RecallParams> {
	return {
		name: "tff-memory_recall",
		readOnly: true,
		label: "Recall",
		description:
			"Search hippo memory. Returns ranked matches with strength, confidence, tags, and optional match explanations.",
		promptSnippet: "Search memory with BM25 or hybrid ranking.",
		promptGuidelines: [
			"Use for: 'do we have X?', 'when did we Y?', user referring to prior work.",
			"Pass why: true to surface match explanations.",
			"Default scope is 'both' (project + global).",
		],
		parameters: RecallParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const opts: RecallOptions = {};
			if (input.budget !== undefined) opts.budget = input.budget;
			if (input.limit !== undefined) opts.limit = input.limit;
			if (input.why !== undefined) opts.why = input.why;
			if (input.scope !== undefined) opts.scope = input.scope;
			const result = await service.recall(input.query, opts);
			return {
				content: [
					{
						type: "text",
						text: `Recalled ${result.results.length} memories (${result.mode})`,
					},
				],
				details: {
					count: result.results.length,
					mode: result.mode,
					tokensUsed: result.tokensUsed,
					results: result.results.map((r) => ({
						id: r.entry.id,
						content: r.entry.content,
						score: r.score,
						strength: r.entry.strength,
						confidence: r.entry.confidence,
						tags: r.entry.tags,
						explanation: r.explanation ?? null,
					})),
				},
			};
		},
	};
}
