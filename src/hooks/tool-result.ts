import type { HippoMemoryConfig } from "../config";
import type { ErrorCapture, ToolResultLike } from "../error-capture";
import type { MemoryService } from "../memory-service";

export interface ToolResultHookDeps {
	service: MemoryService;
	config: HippoMemoryConfig;
	errorCapture: ErrorCapture;
}

export type ToolResultHook = (event: ToolResultLike, ctx: unknown) => Promise<void>;

export function createToolResultHook(deps: ToolResultHookDeps): ToolResultHook {
	return async function onToolResult(event, _ctx) {
		if (!deps.config.autoCapture) return;
		if (!deps.errorCapture.shouldCapture(event)) return;

		const summary = deps.errorCapture.extractSummary(event, 200);
		try {
			await deps.service.captureError({
				content: summary,
				tags: ["error", "auto", `tool:${event.toolName}`],
				source: `auto:tool_result:${event.toolName}`,
			});
		} catch {
			// Must never throw — this runs inside the tool-result loop.
		}
	};
}
