import type { MemoryService } from "../memory-service";
import { createConflictsTool } from "./conflicts";
import { createContextTool } from "./context";
import { createDecideTool } from "./decide";
import { createForgetTool } from "./forget";
import { createInspectTool } from "./inspect";
import { createInvalidateTool } from "./invalidate";
import { createLearnGitTool } from "./learn-git";
import { createOutcomeTool } from "./outcome";
import { createPinTool } from "./pin";
import { createRecallTool } from "./recall";
import { createRememberTool } from "./remember";
import { createResolveTool } from "./resolve";
import { createShareTool } from "./share";
import { createSleepTool } from "./sleep";
import { createStatusTool } from "./status";
import type { ToolDefinition } from "./types";
import { createWmPushTool } from "./wm-push";
import { createWmReadTool } from "./wm-read";

export type { ToolDefinition, ToolDetailValue, ToolExecuteResult } from "./types";

export function createAllTools(service: MemoryService): ToolDefinition[] {
	return [
		createRememberTool(service),
		createRecallTool(service),
		createContextTool(service),
		createOutcomeTool(service),
		createSleepTool(service),
		createDecideTool(service),
		createPinTool(service),
		createForgetTool(service),
		createInvalidateTool(service),
		createConflictsTool(service),
		createResolveTool(service),
		createStatusTool(service),
		createInspectTool(service),
		createWmPushTool(service),
		createWmReadTool(service),
		createShareTool(service),
		createLearnGitTool(service),
	];
}
