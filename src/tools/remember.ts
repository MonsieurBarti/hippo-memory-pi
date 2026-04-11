import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const RememberParams = Type.Object({
	content: Type.String({ description: "Text to remember" }),
	tags: Type.Optional(Type.Array(Type.String())),
	kind: Type.Optional(
		Type.Union([Type.Literal("observed"), Type.Literal("inferred"), Type.Literal("verified")]),
	),
	error: Type.Optional(Type.Boolean()),
	pin: Type.Optional(Type.Boolean()),
	global: Type.Optional(Type.Boolean()),
});

export type RememberInput = Static<typeof RememberParams>;

export function createRememberTool(service: MemoryService): ToolDefinition<typeof RememberParams> {
	return {
		name: "tff-memory_remember",
		readOnly: false,
		label: "Remember",
		description:
			"Store an observation in hippo memory. Errors get extra half-life. Use sparingly — only for non-obvious, non-derivable facts.",
		promptSnippet: "Store a memory (tags, error/pin/verified flags).",
		promptGuidelines: [
			"Use for: corrections, incidents, architectural decisions, non-obvious facts.",
			"Do NOT use for: code patterns, project structure, git history — those are derivable.",
			"Pass error: true for failure lessons (doubles half-life).",
		],
		parameters: RememberParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const entry = await service.remember(input);
			return {
				content: [
					{
						type: "text",
						text: `Stored ${entry.id} (strength ${entry.strength.toFixed(2)}, half-life ${entry.halfLifeDays}d)`,
					},
				],
				details: {
					id: entry.id,
					strength: entry.strength,
					confidence: entry.confidence,
				},
			};
		},
	};
}
