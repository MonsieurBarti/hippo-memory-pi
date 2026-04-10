import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ShareResult } from "../types";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const ShareParams = Type.Object({
	id: Type.Optional(Type.String()),
	auto: Type.Optional(Type.Boolean()),
	dryRun: Type.Optional(Type.Boolean()),
});

export type ShareInput = Static<typeof ShareParams>;

export function createShareTool(service: MemoryService): ToolDefinition<typeof ShareParams> {
	return {
		name: "tff-memory_share",
		label: "Share to Global",
		description: "Promote a memory (or auto-select high-transfer memories) to the global store.",
		promptSnippet: "Promote a memory (or auto-picked set) to the global store.",
		promptGuidelines: [
			"Pass auto: true to let hippo pick memories via transfer scoring.",
			"Use dryRun to preview.",
		],
		parameters: ShareParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const dryRun = input.dryRun === true;
			let result: ShareResult;
			if (input.auto === true) {
				result = await service.share("auto", dryRun);
			} else if (typeof input.id === "string" && input.id.length > 0) {
				result = await service.share(input.id, dryRun);
			} else {
				return {
					content: [{ type: "text", text: "Provide either id or auto: true." }],
					details: { error: "missing-id-or-auto" },
				};
			}
			return {
				content: [
					{
						type: "text",
						text: `Promoted ${result.promoted.length}, skipped ${result.skipped.length} (dryRun=${result.dryRun})`,
					},
				],
				details: {
					promoted: result.promoted,
					skipped: result.skipped,
					dryRun: result.dryRun,
				},
			};
		},
	};
}
