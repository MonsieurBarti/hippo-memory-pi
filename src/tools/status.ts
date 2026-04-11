import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const StatusParams = Type.Object({});

export type StatusInput = Static<typeof StatusParams>;

export function createStatusTool(service: MemoryService): ToolDefinition<typeof StatusParams> {
	return {
		name: "tff-memory_status",
		readOnly: true,
		label: "Memory Status",
		description:
			"Return memory store statistics: total, by layer, average strength, new since last sleep, search mode.",
		promptSnippet: "Get counts and average strength for the memory store.",
		promptGuidelines: ["Use this to check memory pressure (newSinceLastSleep)."],
		parameters: StatusParams,
		async execute(_toolCallId, _input): Promise<ToolExecuteResult> {
			const s = await service.status();
			return {
				content: [
					{
						type: "text",
						text: `Project: ${s.projectTotal} (episodic ${s.episodic}, semantic ${s.semantic}, buffer ${s.buffer}), global: ${s.globalTotal}, avg strength ${s.averageStrength.toFixed(2)}, search ${s.searchMode}`,
					},
				],
				details: {
					projectTotal: s.projectTotal,
					globalTotal: s.globalTotal,
					episodic: s.episodic,
					semantic: s.semantic,
					buffer: s.buffer,
					averageStrength: s.averageStrength,
					newSinceLastSleep: s.newSinceLastSleep,
					lastSleepAt: s.lastSleepAt,
					searchMode: s.searchMode,
				},
			};
		},
	};
}
