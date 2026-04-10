import type { MemoryService } from "../memory-service";
import type { CommandContext, CommandDefinition } from "./types";

export function createMemoryStatusCommand(service: MemoryService): CommandDefinition {
	return {
		name: "memory-status",
		description: "Show hippo memory store statistics",
		async handler(_args: string, ctx: CommandContext) {
			const s = await service.status();
			const message =
				`Project: ${s.projectTotal} (episodic ${s.episodic}, semantic ${s.semantic}, ` +
				`buffer ${s.buffer}), global: ${s.globalTotal}, ` +
				`avg strength ${s.averageStrength.toFixed(2)}, ` +
				`search ${s.searchMode}, new since sleep ${s.newSinceLastSleep}`;
			ctx.ui.notify(message, "info");
		},
	};
}
