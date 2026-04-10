import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const SleepParams = Type.Object({
	dryRun: Type.Optional(Type.Boolean()),
});

export type SleepInput = Static<typeof SleepParams>;

export function createSleepTool(service: MemoryService): ToolDefinition<typeof SleepParams> {
	return {
		name: "tff-memory_sleep",
		label: "Sleep",
		description:
			"Run hippo consolidation: decay → merge overlapping episodics into semantic patterns → detect conflicts → auto-share to global.",
		promptSnippet: "Run the consolidation pipeline (dryRun available).",
		promptGuidelines: [
			"Use sparingly — auto-sleep runs on session shutdown.",
			"Pass dryRun: true to preview the pipeline without persisting changes.",
		],
		parameters: SleepParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const opts: { dryRun?: boolean } = {};
			if (input.dryRun !== undefined) opts.dryRun = input.dryRun;
			const r = await service.sleep(opts);
			return {
				content: [
					{
						type: "text",
						text: `Sleep: decayed=${r.decayed}, merged=${r.merged}, conflicts=${r.conflicts}, promoted=${r.promoted} (${r.durationMs}ms)`,
					},
				],
				details: {
					decayed: r.decayed,
					merged: r.merged,
					conflicts: r.conflicts,
					promoted: r.promoted,
					durationMs: r.durationMs,
				},
			};
		},
	};
}
