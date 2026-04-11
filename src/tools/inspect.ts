import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolDetailValue, ToolExecuteResult } from "./types";

export const InspectParams = Type.Object({
	id: Type.String(),
});

export type InspectInput = Static<typeof InspectParams>;

export function createInspectTool(service: MemoryService): ToolDefinition<typeof InspectParams> {
	return {
		name: "tff-memory_inspect",
		readOnly: true,
		label: "Inspect",
		description: "Return full details of a single memory entry.",
		promptSnippet: "Fetch a single memory by id.",
		promptGuidelines: ["Use before resolving a conflict or deciding to forget/invalidate."],
		parameters: InspectParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const entry = await service.inspect(input.id);
			if (entry === null) {
				return {
					content: [{ type: "text", text: "Not found" }],
					details: { found: false, id: input.id },
				};
			}
			const details: Record<string, ToolDetailValue> = {
				found: true,
				id: entry.id,
				content: entry.content,
				layer: entry.layer,
				tags: entry.tags,
				strength: entry.strength,
				halfLifeDays: entry.halfLifeDays,
				confidence: entry.confidence,
				emotionalValence: entry.emotionalValence,
				pinned: entry.pinned,
				retrievalCount: entry.retrievalCount,
				createdAt: entry.createdAt,
				lastRetrievedAt: entry.lastRetrievedAt,
				root: entry.root,
			};
			return {
				content: [
					{
						type: "text",
						text: `Entry ${entry.id} (strength ${entry.strength.toFixed(2)})`,
					},
				],
				details,
			};
		},
	};
}
