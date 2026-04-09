import type { ContextResult } from "./types";

export interface InjectionResult {
	systemPrompt: string;
	message: {
		customType: "hippo-memory-recall";
		content: string;
		display: true;
		details: {
			memoryIds: string[];
			query: string;
			framing: "observe" | "suggest" | "assert";
			budgetUsed: number;
		};
	};
}

export function buildInjection(
	ctx: ContextResult,
	query: string,
	currentSystemPrompt: string,
): InjectionResult | undefined {
	if (ctx.ids.length === 0 || ctx.formattedBlock.length === 0) return undefined;

	return {
		systemPrompt: `${currentSystemPrompt}\n\n${ctx.formattedBlock}`,
		message: {
			customType: "hippo-memory-recall",
			content: ctx.summary,
			display: true,
			details: {
				memoryIds: ctx.ids,
				query,
				framing: ctx.framing,
				budgetUsed: ctx.tokensUsed,
			},
		},
	};
}
