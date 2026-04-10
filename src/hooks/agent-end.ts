import type { HippoMemoryConfig } from "../config";
import type { MemoryService } from "../memory-service";
import type { SuccessDetector, ToolResultSummary } from "../success-detector";

export interface AgentEndEvent {
	stopReason: string;
}

export interface AgentEndDeps {
	service: MemoryService;
	config: HippoMemoryConfig;
	successDetector: SuccessDetector;
	getAnchorIds: () => readonly string[];
	getRecentToolResults: () => readonly ToolResultSummary[];
}

export type AgentEndHook = (event: AgentEndEvent, ctx: unknown) => Promise<void>;

export function createAgentEndHook(deps: AgentEndDeps): AgentEndHook {
	return async function onAgentEnd(event, _ctx) {
		if (!deps.config.autoOutcome) return;

		const recent = [...deps.getRecentToolResults()];
		const assessment = deps.successDetector.assess({
			stopReason: event.stopReason,
			recentToolResults: recent,
		});
		if (assessment === "ambiguous") return;

		const ids = deps.getAnchorIds();
		for (const id of ids) {
			try {
				await deps.service.outcome(id, assessment);
			} catch {
				// best-effort per id
			}
		}
	};
}
