import type { HippoMemoryConfig } from "../config";
import type { MemoryService } from "../memory-service";

export type NotifyLevel = "info" | "warning" | "error";
export type NotifyFn = (message: string, level?: NotifyLevel) => void;

export interface SessionStartEvent {
	reason: "startup" | "new" | "resume" | "fork" | "reload";
}

export interface SessionStartContext {
	cwd: string;
}

export interface SessionStartDeps {
	service: MemoryService;
	config: HippoMemoryConfig;
	notify: NotifyFn;
}

export type SessionStartHook = (
	event: SessionStartEvent,
	ctx: SessionStartContext,
) => Promise<void>;

export function createSessionStartHook(deps: SessionStartDeps): SessionStartHook {
	return async function onSessionStart(_event, ctx) {
		try {
			await deps.service.init(ctx.cwd);
			deps.notify("🧠 Hippo memory ready (project + global)", "info");

			// Best-effort: fire and forget. A git-learn failure must not block
			// session start (the agent should still work if git is unavailable).
			if (deps.config.autoLearnGit) {
				deps.service.learnFromGit({ days: 30 }).catch(() => undefined);
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";
			deps.notify(`Hippo memory failed to initialize: ${message}`, "error");
		}
	};
}
