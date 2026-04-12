import type { MemoryService } from "../memory-service.js";
import { createConflictsTool } from "./conflicts.js";
import { createContextTool } from "./context.js";
import { createDecideTool } from "./decide.js";
import { createForgetTool } from "./forget.js";
import { createInspectTool } from "./inspect.js";
import { createInvalidateTool } from "./invalidate.js";
import { createLearnGitTool } from "./learn-git.js";
import { createOutcomeTool } from "./outcome.js";
import { createPinTool } from "./pin.js";
import { createRecallTool } from "./recall.js";
import { createRememberTool } from "./remember.js";
import { createResolveTool } from "./resolve.js";
import { createShareTool } from "./share.js";
import { createSleepTool } from "./sleep.js";
import { createStatusTool } from "./status.js";
import type { ToolDefinition } from "./types.js";
import { createWmPushTool } from "./wm-push.js";
import { createWmReadTool } from "./wm-read.js";

export type { ToolDefinition, ToolDetailValue, ToolExecuteResult } from "./types.js";

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
