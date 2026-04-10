import type { MemoryService } from "../memory-service";
import { createMemoryConflictsCommand } from "./memory-conflicts";
import { createMemoryInspectCommand } from "./memory-inspect";
import { createMemoryRecallCommand } from "./memory-recall";
import { createMemorySleepCommand } from "./memory-sleep";
import { createMemoryStatusCommand } from "./memory-status";
import { createToggleAutoInjectCommand } from "./toggle-auto-inject";
import type { CommandDefinition, ToggleStore } from "./types";

export type {
	CommandContext,
	CommandDefinition,
	CommandUI,
	ToggleStore,
} from "./types";
export { createToggleStore } from "./toggle-auto-inject";

export interface CreateAllCommandsDeps {
	service: MemoryService;
	toggleStore: ToggleStore;
}

export function createAllCommands(deps: CreateAllCommandsDeps): CommandDefinition[] {
	return [
		createMemoryStatusCommand(deps.service),
		createMemorySleepCommand(deps.service),
		createMemoryConflictsCommand(deps.service),
		createMemoryRecallCommand(deps.service),
		createMemoryInspectCommand(deps.service),
		createToggleAutoInjectCommand(deps.toggleStore),
	];
}
