import type { MemoryService } from "../memory-service";
import type { CommandContext, CommandDefinition } from "./types";

export function createMemoryInspectCommand(service: MemoryService): CommandDefinition {
	return {
		name: "memory-inspect",
		description: "Show full details of a memory entry",
		async handler(args: string, ctx: CommandContext) {
			const id = args.trim();
			if (id.length === 0) {
				ctx.ui.notify("Usage: /memory-inspect <id>", "warning");
				return;
			}
			const entry = await service.inspect(id);
			if (!entry) {
				ctx.ui.notify(`Not found: ${id}`, "warning");
				return;
			}
			const tags = entry.tags.length > 0 ? entry.tags.join(", ") : "(none)";
			const lines = [
				`id: ${entry.id}`,
				`layer: ${entry.layer}`,
				`root: ${entry.root}`,
				`confidence: ${entry.confidence}`,
				`strength: ${entry.strength.toFixed(3)}`,
				`half-life: ${entry.halfLifeDays}d`,
				`pinned: ${entry.pinned}`,
				`retrieval count: ${entry.retrievalCount}`,
				`emotional valence: ${entry.emotionalValence}`,
				`created: ${entry.createdAt}`,
				`last retrieved: ${entry.lastRetrievedAt}`,
				`tags: ${tags}`,
				"---",
				entry.content,
			];
			ctx.ui.notify(lines.join("\n"), "info");
		},
	};
}
