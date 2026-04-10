import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const PinParams = Type.Object({
	id: Type.String(),
	pinned: Type.Boolean(),
});

export type PinInput = Static<typeof PinParams>;

export function createPinTool(service: MemoryService): ToolDefinition<typeof PinParams> {
	return {
		name: "tff-memory_pin",
		label: "Pin",
		description: "Pin (infinite half-life) or unpin a memory. Escape hatch — use sparingly.",
		promptSnippet: "Pin or unpin a memory to prevent decay.",
		promptGuidelines: ["Use only for memories that cannot earn strength through repetition."],
		parameters: PinParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			await service.pin(input.id, input.pinned);
			return {
				content: [
					{
						type: "text",
						text: `${input.pinned ? "Pinned" : "Unpinned"} ${input.id}`,
					},
				],
				details: { id: input.id, pinned: input.pinned },
			};
		},
	};
}
