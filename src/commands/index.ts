import type { MemoryService } from "../memory-service.js";
import { createMemoryConflictsCommand } from "./memory-conflicts.js";
import { createMemoryInspectCommand } from "./memory-inspect.js";
import { createMemoryRecallCommand } from "./memory-recall.js";
import { createMemorySleepCommand } from "./memory-sleep.js";
import { createMemoryStatusCommand } from "./memory-status.js";
import { createToggleAutoInjectCommand } from "./toggle-auto-inject.js";
import type { CommandDefinition, ToggleStore } from "./types.js";

export type {
	CommandContext,
	CommandDefinition,
	CommandUI,
	ToggleStore,
} from "./types.js";
export { createToggleStore } from "./toggle-auto-inject.js";

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
