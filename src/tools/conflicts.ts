import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const ConflictsParams = Type.Object({
	status: Type.Optional(
		Type.Union([Type.Literal("open"), Type.Literal("resolved"), Type.Literal("all")]),
	),
});

export type ConflictsInput = Static<typeof ConflictsParams>;

export function createConflictsTool(
	service: MemoryService,
): ToolDefinition<typeof ConflictsParams> {
	return {
		name: "tff-memory_conflicts",
		readOnly: true,
		label: "Conflicts",
		description: "List memory conflicts detected during sleep consolidation.",
		promptSnippet: "List open or resolved memory conflicts.",
		promptGuidelines: [
			"Inspect both memories with tff-memory_inspect before resolving.",
			"Default status is 'open'.",
		],
		parameters: ConflictsParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const conflicts = await service.listConflicts(input.status ?? "open");
			return {
				content: [{ type: "text", text: `${conflicts.length} conflicts` }],
				details: {
					count: conflicts.length,
					conflicts: conflicts.map((c) => ({
						id: c.id,
						first: c.first,
						second: c.second,
						overlap: c.overlap,
						conflictType: c.conflictType,
						status: c.status,
						detectedAt: c.detectedAt,
					})),
				},
			};
		},
	};
}
