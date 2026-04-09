import { type Static, Type } from "@sinclair/typebox";
import type { MemoryService } from "../memory-service";
import type { ToolDefinition, ToolExecuteResult } from "./types";

export const LearnGitParams = Type.Object({
	days: Type.Optional(Type.Number({ minimum: 1 })),
	repos: Type.Optional(Type.Array(Type.String())),
});

export type LearnGitInput = Static<typeof LearnGitParams>;

export function createLearnGitTool(service: MemoryService): ToolDefinition<typeof LearnGitParams> {
	return {
		name: "tff-memory_learn_git",
		label: "Learn From Git",
		description: "Scan git history for fix/revert/bug commits and extract lessons.",
		promptSnippet: "Extract lessons from recent git history.",
		promptGuidelines: [
			"Best-effort: returns zero on non-repo cwds.",
			"Default scan window is 30 days.",
		],
		parameters: LearnGitParams,
		async execute(_toolCallId, input): Promise<ToolExecuteResult> {
			const opts: { days?: number; repos?: string[] } = {};
			if (input.days !== undefined) opts.days = input.days;
			if (input.repos !== undefined) opts.repos = input.repos;
			const r = await service.learnFromGit(opts);
			return {
				content: [
					{
						type: "text",
						text: `Scanned ${r.scanned} commits, added ${r.added} lessons`,
					},
				],
				details: { scanned: r.scanned, added: r.added, skipped: r.skipped },
			};
		},
	};
}
