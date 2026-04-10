import type { MemoryService } from "../memory-service";
import type { CommandContext, CommandDefinition } from "./types";

export function createMemoryConflictsCommand(service: MemoryService): CommandDefinition {
	return {
		name: "memory-conflicts",
		description: "List detected memory conflicts",
		async handler(_args: string, ctx: CommandContext) {
			const conflicts = await service.listConflicts("open");
			if (conflicts.length === 0) {
				ctx.ui.notify("No open memory conflicts", "info");
				return;
			}
			const lines = conflicts.map((c) => {
				const overlap = (c.overlap * 100).toFixed(0);
				return (
					`  [${c.id}] ${c.conflictType} (${overlap}% overlap) — ` +
					`first=${c.first}, second=${c.second}`
				);
			});
			ctx.ui.notify(`${conflicts.length} open conflicts:\n${lines.join("\n")}`, "info");
		},
	};
}
