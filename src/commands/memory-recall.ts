import type { MemoryService } from "../memory-service";
import type { CommandContext, CommandDefinition } from "./types";

export function createMemoryRecallCommand(service: MemoryService): CommandDefinition {
	return {
		name: "memory-recall",
		description: "Search memory (user-triggered)",
		async handler(args: string, ctx: CommandContext) {
			const query = args.trim();
			if (query.length === 0) {
				ctx.ui.notify('Usage: /memory-recall "<query>"', "warning");
				return;
			}
			const result = await service.recall(query, { why: true });
			if (result.results.length === 0) {
				ctx.ui.notify(`No memories matched "${query}"`, "info");
				return;
			}
			const lines = result.results.map((r, i) => {
				const idx = i + 1;
				const strength = r.entry.strength.toFixed(2);
				const why = r.explanation ? ` — ${r.explanation}` : "";
				const prefix = `  ${idx}. [${r.entry.confidence}, strength ${strength}] `;
				return `${prefix}${r.entry.content}${why}`;
			});
			ctx.ui.notify(
				`${result.results.length} result${result.results.length === 1 ? "" : "s"} ` +
					`(${result.mode}, ~${result.tokensUsed} tokens):\n${lines.join("\n")}`,
				"info",
			);
		},
	};
}
