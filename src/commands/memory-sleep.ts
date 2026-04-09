import type { MemoryService } from "../memory-service";
import type { CommandContext, CommandDefinition } from "./types";

export function createMemorySleepCommand(service: MemoryService): CommandDefinition {
	return {
		name: "memory-sleep",
		description: "Run hippo consolidation (--dry-run to preview)",
		async handler(args: string, ctx: CommandContext) {
			const dryRun = /(^|\s)--dry-run(\s|$)/.test(args);
			const result = await service.sleep({ dryRun });
			const prefix = dryRun ? "🌙 Sleep (dry-run)" : "💤 Sleep";
			ctx.ui.notify(
				`${prefix}: decayed=${result.decayed}, merged=${result.merged}, ` +
					`conflicts=${result.conflicts}, promoted=${result.promoted} ` +
					`(${result.durationMs}ms)`,
				"info",
			);
		},
	};
}
